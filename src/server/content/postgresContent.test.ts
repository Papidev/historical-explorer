import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { createPostgresContent, type catalogWriteSchema } from "./postgresContent";
import { readFile } from "node:fs/promises";
import { createContentHandler } from "./handler";
import { toVisitorCity } from "../visitorContent/adapters";
import { matchesPoiCategory } from "@/types/PoiCategory";
import { createCachedRead } from "../visitorContent/cache";
import { exampleStoryWrite as example } from "./__fixtures__/writes";

describe.skipIf(!process.env.HISTORICAL_EXPLORER_TEST_DATABASE_URL)(
  "PostgreSQL content storage",
  () => {
    let pool: Pool;
    let repository: ReturnType<typeof createPostgresContent>;
    beforeAll(async () => {
      const target = new URL(process.env.HISTORICAL_EXPLORER_TEST_DATABASE_URL!);
      if (
        !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
        target.pathname !== "/historical_explorer_test"
      )
        throw new Error(
          "Database integration tests require the dedicated local historical_explorer_test database.",
        );
      pool = new Pool({ connectionString: target.toString(), max: 5 });
      repository = createPostgresContent(pool);
      vi.stubEnv("CONTENT_API_TOKEN", "integration-test-token-with-at-least-32-bytes");
      await pool.query("DROP SCHEMA IF EXISTS content CASCADE");
      await pool.query(
        await readFile(new URL("./__fixtures__/001-content.sql", import.meta.url), "utf8"),
      );
      await pool.query(
        await readFile(new URL("./schema/002-poi-category-writes.sql", import.meta.url), "utf8"),
      );
      await pool.query(
        await readFile(new URL("./schema/003-poi-type-acquisitions.sql", import.meta.url), "utf8"),
      );
      await pool.query(
        await readFile(new URL("./schema/004-type-category-rules.sql", import.meta.url), "utf8"),
      );
    });
    beforeEach(async () => {
      await pool.query(
        "TRUNCATE content.type_category_rules, content.city_catalogs, content.categories, content.people CASCADE",
      );
    });
    afterAll(async () => {
      await pool?.end();
      vi.unstubAllEnvs();
    });

    const prepare = async (writes: ReturnType<typeof example>[]) => {
      const catalog: z.infer<typeof catalogWriteSchema> = {
        city: "rome",
        revision: randomUUID(),
        expectedRevision: null,
        pois: writes.map(({ detail }) => ({
          id: detail.id,
          name: detail.name,
          coordinates: detail.coordinates,
          wikidataId: "Q10285",
          osmIds: ["relation/1834818"],
          wikipediaPages: detail.sources.map((source) => ({
            language: source.language,
            pageId: source.pageId,
            title: source.title,
            url: source.url,
          })),
        })),
      };
      await repository.synchronizeCatalog(catalog);
      for (const write of writes) {
        const {
          rows: [poi],
        } = await pool.query("SELECT input_revision FROM content.pois WHERE id = $1", [
          write.detail.id,
        ]);
        write.inputRevision = poi.input_revision;
      }
      return catalog;
    };

    const typesWrite = async (poiId: string) => {
      const baseline = (await repository.getPoiTypes(poiId))!;
      return {
        poiId,
        inputRevision: baseline.inputRevision,
        expectedRevision: baseline.revision,
        revision: randomUUID(),
        acquisition: {
          wikidataId: baseline.wikidataId,
          types: [{ id: "Q1", label: "arena" }],
          skipped: false,
          acquiredAt: new Date().toISOString(),
        },
      };
    };

    const saveRule = async (typeId: string, categories: string[] | null) =>
      repository.saveTypeCategoryRule({
        typeId,
        categories,
        revision: randomUUID(),
        expectedStateDigest: (await repository.getTypeCategoryRules()).stateDigest,
      });

    it("persists automatic origin, reason and new definitions atomically with multi-POI assignments", async () => {
      const writes = [example(), example()];
      writes[1].detail.id = randomUUID();
      await prepare(writes);
      for (const write of writes) await repository.savePoiTypes(await typesWrite(write.detail.id));
      const input = {
        typeId: "Q1",
        categories: ["Arena"],
        origin: "automatic",
        reason: "Direct arena type.",
        definitions: [{ id: "Arena", name: "Arena" }],
        revision: randomUUID(),
        expectedStateDigest: (await repository.getTypeCategoryRules()).stateDigest,
      };
      const response = await createContentHandler(() => repository)(
        new Request("http://localhost/api/admin/content/v1/type-rules", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${process.env.CONTENT_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        }),
        { params: Promise.resolve({ segments: ["type-rules"] }) },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ revision: input.revision, affectedPois: 2 });
      expect((await repository.getTypeCategoryRules()).rules[0]).toMatchObject({
        typeId: "Q1",
        origin: "automatic",
        reason: "Direct arena type.",
        categoryIds: ["Arena"],
      });
      for (const write of writes) {
        expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds).toContain(
          "Arena",
        );
        expect(await repository.getStory(write.detail.id)).toBeUndefined();
      }
    });

    it.each(["mapped", "ignored", "unmapped"])(
      "protects manual %s decisions from automatic replacement",
      async (decision) => {
        const write = example();
        await prepare([write]);
        await repository.savePoiTypes(await typesWrite(write.detail.id));
        await pool.query(
          "INSERT INTO content.categories(id,name) VALUES ('Amphitheatre','Amphitheatre')",
        );
        await saveRule(
          "Q1",
          decision === "unmapped" ? null : decision === "ignored" ? [] : ["Amphitheatre"],
        );
        const before = await repository.getTypeCategoryRules();
        await expect(
          repository.saveTypeCategoryRule({
            typeId: "Q1",
            categories: ["Arena"],
            origin: "automatic",
            reason: "AI suggestion",
            definitions: [{ id: "Arena", name: "Arena" }],
            revision: randomUUID(),
            expectedStateDigest: before.stateDigest,
          }),
        ).rejects.toMatchObject({ reason: "conflict" });
        expect(await repository.getTypeCategoryRules()).toEqual(before);
      },
    );

    it("rejects stale AI results after an acquisition changes and rolls back invalid new definitions", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      const input = {
        typeId: "Q1",
        categories: ["Arena"],
        origin: "automatic",
        reason: "Arena type",
        definitions: [{ id: "Arena", name: "Arena" }],
        revision: randomUUID(),
        expectedStateDigest: (await repository.getTypeCategoryRules()).stateDigest,
      };
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      await expect(repository.saveTypeCategoryRule(input)).rejects.toMatchObject({
        reason: "conflict",
      });
      const before = await repository.getTypeCategoryRules();
      await expect(
        repository.saveTypeCategoryRule({
          ...input,
          categories: ["unknown"],
          expectedStateDigest: before.stateDigest,
        }),
      ).rejects.toMatchObject({ reason: "invalid" });
      expect(await repository.getTypeCategoryRules()).toEqual(before);
    });

    it("atomically changes multiple acquired POIs, preserves independent categories and filters visitors without publishing drafts", async () => {
      const published = example();
      const draft = example();
      draft.detail.id = randomUUID();
      const unrelated = example();
      unrelated.detail.id = randomUUID();
      await prepare([published, draft, unrelated]);
      await repository.saveStory(published);
      await repository.savePoiCategories(await categoryWrite(published));
      for (const write of [published, draft])
        await repository.savePoiTypes(await typesWrite(write.detail.id));
      await repository.savePoiTypes({
        ...(await typesWrite(unrelated.detail.id)),
        acquisition: {
          ...(await typesWrite(unrelated.detail.id)).acquisition,
          types: [{ id: "Q2", label: "unrelated" }],
        },
      });
      await pool.query("INSERT INTO content.categories(id,name) VALUES ('new','New')");
      const unrelatedBefore = await repository.getPoiCategoriesBaseline(unrelated.detail.id);
      const storyBefore = await repository.getStory(published.detail.id);
      const handle = createContentHandler(() => repository);
      const call = (body?: unknown) =>
        handle(
          new Request("http://localhost/api/admin/content/v1/type-rules", {
            method: body ? "PUT" : "GET",
            headers: {
              authorization: `Bearer ${process.env.CONTENT_API_TOKEN}`,
              "content-type": "application/json",
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
          { params: Promise.resolve({ segments: ["type-rules"] }) },
        );
      const baseline = await (await call()).json();
      expect(baseline.rules).toEqual([]);
      const response = await call({
        typeId: "Q1",
        categories: ["new"],
        revision: randomUUID(),
        expectedStateDigest: baseline.stateDigest,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: "saved", affectedPois: 2 });
      for (const write of [published, draft])
        expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds).toContain(
          "new",
        );
      expect(
        (await repository.getPoiCategoriesBaseline(published.detail.id))?.categoryIds,
      ).toContain("amphitheatre");
      expect(await repository.getPoiCategoriesBaseline(unrelated.detail.id)).toEqual(
        unrelatedBefore,
      );
      expect(await repository.getStory(draft.detail.id)).toBeUndefined();
      const city = await repository.getCity("rome");
      expect(
        city.pois
          .filter(({ categoryIds }) =>
            matchesPoiCategory(
              categoryIds,
              "new",
              city.categoryDefinitions.map(({ parentId, ...category }) => ({
                ...category,
                parent: parentId,
              })),
            ),
          )
          .map(({ id }) => id),
      ).toEqual([published.detail.id]);
      const visitor = await repository.getStory(published.detail.id);
      expect(visitor?.story).toEqual(storyBefore?.story);
      expect(JSON.stringify(visitor)).not.toMatch(/typeId|updatedAt|manual/);
      expect((await createPostgresContent(pool).getTypeCategoryRules()).rules).toMatchObject([
        { typeId: "Q1", origin: "manual", decision: "mapped", categoryIds: ["new"] },
      ]);
      await saveRule("Q1", []);
      expect(
        (await repository.getPoiCategoriesBaseline(published.detail.id))?.categoryIds,
      ).not.toContain("new");
      expect(
        (await repository.getPoiCategoriesBaseline(published.detail.id))?.categoryIds,
      ).toContain("amphitheatre");
      expect((await repository.getTypeCategoryRules()).rules[0]).toMatchObject({
        decision: "ignored",
        origin: "manual",
      });
      await saveRule("Q1", null);
      expect((await repository.getTypeCategoryRules()).rules[0]).toMatchObject({
        decision: "unmapped",
        origin: "manual",
        categoryIds: [],
      });
    });

    it("recalculates acquisitions against current rules and invalidates pending per-POI requests even when categories are unchanged", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      await pool.query("INSERT INTO content.categories(id,name) VALUES ('new','New')");
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      await saveRule("Q1", ["new"]);
      const pending = await categoryWrite(write);
      await saveRule("Q1", ["new"]);
      await expect(repository.savePoiCategories(pending)).rejects.toMatchObject({
        reason: "conflict",
      });
      const acquisition = await typesWrite(write.detail.id);
      await repository.savePoiTypes({
        ...acquisition,
        acquisition: { ...acquisition.acquisition, types: [] },
      });
      expect(
        (await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds,
      ).not.toContain("new");
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds).toContain(
        "new",
      );
    });

    it("rejects stale rule/catalog forms and invalid categories without changing accepted rules or assignments", async () => {
      const write = example();
      const catalog = await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      await pool.query("INSERT INTO content.categories(id,name) VALUES ('new','New')");
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      const input = {
        typeId: "Q1",
        categories: ["new"],
        revision: randomUUID(),
        expectedStateDigest: (await repository.getTypeCategoryRules()).stateDigest,
      };
      const categories = await repository.getPoiCategoriesBaseline(write.detail.id);
      await expect(
        repository.saveTypeCategoryRule({ ...input, categories: ["unknown"] }),
      ).rejects.toMatchObject({ reason: "invalid" });
      expect((await repository.getTypeCategoryRules()).rules).toEqual([]);
      expect(await repository.getPoiCategoriesBaseline(write.detail.id)).toEqual(categories);
      await repository.synchronizeCatalog({
        ...catalog,
        revision: randomUUID(),
        expectedRevision: catalog.revision,
        pois: catalog.pois.map((poi) => ({ ...poi, name: "Changed inputs" })),
      });
      await expect(repository.saveTypeCategoryRule(input)).rejects.toMatchObject({
        reason: "conflict",
      });
    });

    it("rejects a stale catalog revision even when only coordinates changed", async () => {
      const write = example();
      const catalog = await prepare([write]);
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      const expectedStateDigest = (await repository.getTypeCategoryRules()).stateDigest;
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: randomUUID(),
        pois: catalog.pois.map((poi) => ({ ...poi, coordinates: { lat: 42, lng: 12 } })),
      });
      await expect(
        repository.saveTypeCategoryRule({
          typeId: "Q1",
          categories: [],
          revision: randomUUID(),
          expectedStateDigest,
        }),
      ).rejects.toMatchObject({ reason: "conflict" });
      expect((await repository.getTypeCategoryRules()).rules).toEqual([]);
    });

    it("rolls back the rule and every assignment if recalculation of a later POI fails", async () => {
      const first = example();
      const second = example();
      second.detail.id = randomUUID();
      await prepare([first, second]);
      await repository.savePoiCategories(await categoryWrite(first));
      await pool.query("INSERT INTO content.categories(id,name) VALUES ('new','New')");
      for (const write of [first, second])
        await repository.savePoiTypes(await typesWrite(write.detail.id));
      const before = await repository.getTypeCategoryRules();
      const categories = await Promise.all(
        [first, second].map((write) => repository.getPoiCategoriesBaseline(write.detail.id)),
      );
      // Test-only database constraint fails after an earlier POI has been changed within the same transaction.
      const lastId = [first.detail.id, second.detail.id].sort().at(-1)!;
      await pool.query(
        `ALTER TABLE content.poi_type_category_assignments ADD CONSTRAINT test_recalculation_failure CHECK (poi_id <> '${lastId}'::uuid)`,
      );
      try {
        await expect(saveRule("Q1", ["new"])).rejects.toThrow();
      } finally {
        await pool.query(
          "ALTER TABLE content.poi_type_category_assignments DROP CONSTRAINT test_recalculation_failure",
        );
      }
      expect(await repository.getTypeCategoryRules()).toEqual(before);
      expect(
        await Promise.all(
          [first, second].map((write) => repository.getPoiCategoriesBaseline(write.detail.id)),
        ),
      ).toEqual(categories);
    });

    it("serializes simultaneous rule, acquisition and per-POI writes without restoring obsolete assignments", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      await pool.query("INSERT INTO content.categories(id,name) VALUES ('new','New')");
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      const expectedStateDigest = (await repository.getTypeCategoryRules()).stateDigest;
      const writes = await Promise.allSettled([
        repository.saveTypeCategoryRule({
          typeId: "Q1",
          categories: ["new"],
          revision: randomUUID(),
          expectedStateDigest,
        }),
        repository.saveTypeCategoryRule({
          typeId: "Q1",
          categories: [],
          revision: randomUUID(),
          expectedStateDigest,
        }),
      ]);
      expect(writes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(writes.find(({ status }) => status === "rejected")).toMatchObject({
        reason: { reason: "conflict" },
      });
      const pending = await categoryWrite(write);
      const acquisition = await typesWrite(write.detail.id);
      const results = await Promise.allSettled([
        repository.savePoiCategories(pending),
        repository.savePoiTypes(acquisition),
      ]);
      expect(results[1].status).toBe("fulfilled");
      const rule = (await repository.getTypeCategoryRules()).rules[0];
      const categories = (await repository.getPoiCategoriesBaseline(write.detail.id))!.categoryIds;
      expect(categories.includes("new")).toBe(rule.decision === "mapped");
      await expect(repository.savePoiCategories(pending)).rejects.toMatchObject({
        reason: "conflict",
      });
    });

    it("keeps categories supplied by another accepted rule when a shared type is ignored", async () => {
      const write = example();
      await prepare([write]);
      await pool.query("INSERT INTO content.categories(id,name) VALUES ('new','New')");
      const acquisition = await typesWrite(write.detail.id);
      await repository.savePoiTypes({
        ...acquisition,
        acquisition: {
          ...acquisition.acquisition,
          types: [
            { id: "Q1", label: "first" },
            { id: "Q2", label: "second" },
          ],
        },
      });
      await saveRule("Q1", ["new"]);
      await saveRule("Q2", ["new"]);
      await saveRule("Q1", []);
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds).toEqual([
        "new",
      ]);
      await saveRule("Q2", null);
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds).toEqual([]);
    });

    it("rolls back an acquisition and its category revision when recalculation fails", async () => {
      const write = example();
      await prepare([write]);
      await pool.query("INSERT INTO content.categories(id,name) VALUES ('new','New')");
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      await saveRule("Q1", ["new"]);
      const before = await repository.getPoiTypes(write.detail.id);
      const categories = await repository.getPoiCategoriesBaseline(write.detail.id);
      await pool.query(
        "ALTER TABLE content.poi_category_writes ADD CONSTRAINT test_acquisition_failure CHECK (revision = '" +
          categories!.revision +
          "'::uuid) NOT VALID",
      );
      try {
        await expect(repository.savePoiTypes(await typesWrite(write.detail.id))).rejects.toThrow();
      } finally {
        await pool.query(
          "ALTER TABLE content.poi_category_writes DROP CONSTRAINT test_acquisition_failure",
        );
      }
      expect(await repository.getPoiTypes(write.detail.id)).toEqual(before);
      expect(await repository.getPoiCategoriesBaseline(write.detail.id)).toEqual(categories);
    });

    it("does not let a freshly prepared legacy category replacement override accepted online rules", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      await saveRule("Q1", []);
      await expect(repository.savePoiCategories(await categoryWrite(write))).rejects.toMatchObject({
        reason: "conflict",
      });
    });

    it("retains hierarchy expansion and name-dependent interpretation during online recalculation", async () => {
      const write = example();
      write.detail.name = "Basilica Example";
      await prepare([write]);
      await pool.query(`INSERT INTO content.categories(id,name,parent_id) VALUES
        ('Churches & cathedrals','Churches & cathedrals',NULL),
        ('Church','Church','Churches & cathedrals'), ('Cathedral','Cathedral','Churches & cathedrals'),
        ('Basilica','Basilica','Churches & cathedrals')`);
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      await saveRule("Q1", ["Churches & cathedrals"]);
      expect((await repository.getTypeCategoryRules()).rules[0].categoryIds).toEqual(
        expect.arrayContaining(["Church", "Cathedral", "Basilica"]),
      );
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds).toEqual([
        "Basilica",
        "Church",
        "Churches & cathedrals",
      ]);
    });

    it("persists acquisitions through authenticated HTTP, reloads them and preserves visitor content and categories", async () => {
      const write = example();
      await prepare([write]);
      await repository.saveStory(write);
      await repository.savePoiCategories(await categoryWrite(write));
      const visitor = await repository.getCity("rome");
      const categories = await repository.getPoiCategoriesBaseline(write.detail.id);
      const body = await typesWrite(write.detail.id);
      const handle = createContentHandler(() => repository);
      const call = (segments: string[], input?: unknown) =>
        handle(
          new Request("http://localhost/api/admin/content/v1/" + segments.join("/"), {
            method: input ? "PUT" : "GET",
            headers: {
              authorization: `Bearer ${process.env.CONTENT_API_TOKEN}`,
              "content-type": "application/json",
            },
            ...(input ? { body: JSON.stringify(input) } : {}),
          }),
          { params: Promise.resolve({ segments }) },
        );
      expect(await (await call(["pois", body.poiId, "types"], body)).json()).toEqual({
        status: "saved",
        revision: body.revision,
      });
      expect(await (await call(["pois", body.poiId, "types"])).json()).toMatchObject({
        acquisition: body.acquisition,
        revision: body.revision,
      });
      expect(await (await call(["catalogs", "rome", "types"])).json()).toHaveLength(1);
      expect((await createPostgresContent(pool).getPoiTypes(body.poiId))?.acquisition).toEqual(
        body.acquisition,
      );
      expect(await repository.savePoiTypes(body)).toEqual({
        status: "already-saved",
        revision: body.revision,
      });
      await expect(
        repository.savePoiTypes({ ...body, acquisition: { ...body.acquisition, types: [] } }),
      ).rejects.toMatchObject({ reason: "invalid" });
      expect(await repository.getCity("rome")).toEqual(visitor);
      expect(await repository.getPoiCategoriesBaseline(body.poiId)).toEqual(categories);
    });

    it("distinguishes never acquired, successful empty and skipped states without publishing a POI", async () => {
      const write = example();
      const catalog = await prepare([write]);
      expect((await repository.getPoiTypes(write.detail.id))?.acquisition).toBeNull();
      const body = await typesWrite(write.detail.id);
      await repository.savePoiTypes({ ...body, acquisition: { ...body.acquisition, types: [] } });
      expect((await repository.getPoiTypes(body.poiId))?.acquisition).toMatchObject({
        types: [],
        skipped: false,
      });
      delete catalog.pois[0].wikidataId;
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: randomUUID(),
      });
      expect((await repository.getPoiTypes(body.poiId))?.acquisition).toBeNull();
      const skipped = await typesWrite(body.poiId);
      await repository.savePoiTypes({
        ...skipped,
        acquisition: { ...skipped.acquisition, types: [], skipped: true },
      });
      expect((await repository.getCityPoiTypes("rome"))[0].acquisition).toMatchObject({
        wikidataId: null,
        types: [],
        skipped: true,
      });
      expect((await repository.getCity("rome")).pois).toEqual([]);
      expect((await repository.getPoiCategoriesBaseline(body.poiId))?.categoryIds).toEqual([]);
    });

    it("rejects stale, conflicting and malformed acquisitions and leaves the accepted result intact", async () => {
      const write = example();
      const catalog = await prepare([write]);
      const body = await typesWrite(write.detail.id);
      const outcomes = await Promise.allSettled([
        repository.savePoiTypes(body),
        repository.savePoiTypes({ ...body, revision: randomUUID() }),
      ]);
      expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
      const before = await repository.getPoiTypes(body.poiId);
      for (const acquisition of [
        { ...body.acquisition, types: [...body.acquisition.types, ...body.acquisition.types] },
        { ...body.acquisition, skipped: true },
        { ...body.acquisition, wikidataId: null },
        { ...body.acquisition, error: "Wikidata failed" },
        { ...body.acquisition, types: [{ id: "wrong", label: "bad" }] },
      ])
        await expect(repository.savePoiTypes({ ...body, acquisition })).rejects.toThrow();
      await expect(
        repository.savePoiTypes({
          ...body,
          acquisition: { ...body.acquisition, wikidataId: "Q2" },
        }),
      ).rejects.toMatchObject({ reason: "obsolete" });
      expect(await repository.getPoiTypes(body.poiId)).toEqual(before);
      catalog.pois[0].name = "Changed input";
      const revision = randomUUID();
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision,
      });
      await expect(repository.savePoiTypes(body)).rejects.toMatchObject({ reason: "obsolete" });
      expect((await repository.getPoiTypes(body.poiId))?.acquisition).toBeNull();
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: revision,
        revision: randomUUID(),
        pois: [],
      });
      await expect(repository.savePoiTypes(body)).rejects.toMatchObject({ reason: "obsolete" });
      expect(await repository.getPoiTypes(body.poiId)).toBeUndefined();
      expect(await repository.getCityPoiTypes("rome")).toEqual([]);
    });

    it("allows only the writer to store acquisitions and never exposes them through visitor views", async () => {
      const write = example();
      await prepare([write]);
      const body = await typesWrite(write.detail.id);
      const client = await pool.connect();
      try {
        await client.query("SET ROLE historical_explorer_writer");
        await createPostgresContent(client as unknown as Pool).getPoiTypes(body.poiId);
        await client.query("INSERT INTO content.poi_type_acquisitions VALUES ($1,$2,$3,$4,$5)", [
          body.poiId,
          body.inputRevision,
          body.revision,
          "digest",
          body.acquisition,
        ]);
        await client.query("SET ROLE historical_explorer_reader");
        await expect(
          client.query("SELECT * FROM content.poi_type_acquisitions"),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await client.query("RESET ROLE");
        client.release();
      }
      expect((await repository.getCity("rome")).pois).toEqual([]);
    });

    const categoryWrite = async (write: ReturnType<typeof example>) => {
      const baseline = (await repository.getPoiCategoriesBaseline(write.detail.id))!;
      return {
        poiId: baseline.poiId,
        inputRevision: baseline.inputRevision,
        revision: randomUUID(),
        expectedRevision: baseline.revision,
        expectedStateDigest: baseline.stateDigest,
        categoryIds: ["amphitheatre"],
        definitions: [
          { id: "amphitheatre", name: "Amphitheatre", parentId: "architecture" },
          { id: "architecture", name: "Architecture" },
        ],
      };
    };

    it("reads and creates the authoritative category catalog through authenticated HTTP without publishing POIs", async () => {
      const write = example();
      await prepare([write]);
      const send = (body?: unknown) =>
        createContentHandler(() => repository)(
          new Request("http://localhost/api/admin/content/v1/categories", {
            method: body === undefined ? "GET" : "PUT",
            headers: {
              authorization: `Bearer ${process.env.CONTENT_API_TOKEN}`,
              "content-type": "application/json",
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
          { params: Promise.resolve({ segments: ["categories"] }) },
        );
      const initial = await (await send()).json();
      expect(initial.definitions).toEqual([]);
      const created = await send({
        name: "  Cultural   venue ",
        expectedStateDigest: initial.stateDigest,
      });
      expect(created.status).toBe(200);
      expect(await created.json()).toEqual({
        status: "saved",
        definition: { id: "Cultural venue", name: "Cultural venue" },
      });
      const fresh = await createPostgresContent(pool).getCategoryCatalog();
      expect(fresh.definitions).toEqual([{ id: "Cultural venue", name: "Cultural venue" }]);
      expect(fresh.stateDigest).not.toBe(initial.stateDigest);
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds).toEqual([]);
      expect((await repository.getCity("rome")).pois).toEqual([]);
      expect(
        (await send({ name: "Another", expectedStateDigest: initial.stateDigest })).status,
      ).toBe(409);
      expect(
        (await send({ name: "cultural venue", expectedStateDigest: fresh.stateDigest })).status,
      ).toBe(400);
      expect(await repository.getCategoryCatalog()).toEqual(fresh);
    });

    it("moves a shared category through authenticated HTTP and updates visitor filtering at the freshness boundary", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      await repository.createCategory({
        name: "Culture",
        expectedStateDigest: (await repository.getCategoryCatalog()).stateDigest,
      });
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      await saveRule("Q1", ["amphitheatre"]);
      await repository.saveStory(write);
      const story = await repository.getStory(write.detail.id);
      const person = await repository.getPerson("vespasian");
      const before = (await repository.getPoiCategoriesBaseline(write.detail.id))!;
      const oldRules = await repository.getTypeCategoryRules();
      let time = 0;
      const cached = createCachedRead(repository.getCityPreviews, () => time);
      expect(toVisitorCity(await cached("rome")).categoryDefinitions).toContainEqual({
        id: "amphitheatre",
        name: "Amphitheatre",
        parent: "architecture",
      });
      const response = await createContentHandler(() => repository)(
        new Request("http://localhost/api/admin/content/v1/categories/amphitheatre/move", {
          method: "PUT",
          headers: {
            authorization: `Bearer ${process.env.CONTENT_API_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            parentId: "Culture",
            expectedStateDigest: (await repository.getCategoryCatalog()).stateDigest,
          }),
        }),
        { params: Promise.resolve({ segments: ["categories", "amphitheatre", "move"] }) },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: "saved",
        definition: { id: "amphitheatre", name: "Amphitheatre", parentId: "Culture" },
      });
      expect((await createPostgresContent(pool).getCategoryCatalog()).definitions).toContainEqual({
        id: "amphitheatre",
        name: "Amphitheatre",
        parentId: "Culture",
      });
      const after = (await repository.getPoiCategoriesBaseline(write.detail.id))!;
      expect(after.categoryIds).toEqual(["Culture", "amphitheatre"]);
      expect(after.revision).not.toBe(before.revision);
      expect(after.stateDigest).not.toBe(before.stateDigest);
      const rule = (await repository.getTypeCategoryRules()).rules[0];
      expect(rule).toMatchObject({ categoryIds: ["amphitheatre", "Culture"], origin: "manual" });
      expect(rule.revision).not.toBe(oldRules.rules[0].revision);
      expect(await repository.getStory(write.detail.id)).toEqual({
        ...story,
        categoryIds: after.categoryIds,
      });
      expect(await repository.getPerson("vespasian")).toEqual({
        ...person,
        linkedPois: person!.linkedPois.map((poi) => ({ ...poi, categoryIds: after.categoryIds })),
      });
      time = 59_999;
      expect(
        toVisitorCity(await cached("rome")).categoryDefinitions.find(
          ({ id }) => id === "amphitheatre",
        )?.parent,
      ).toBe("architecture");
      time = 60_000;
      const visitor = toVisitorCity(await cached("rome"));
      expect(visitor.categoryDefinitions.find(({ id }) => id === "amphitheatre")?.parent).toBe(
        "Culture",
      );
      expect(
        matchesPoiCategory(visitor.pois[0].categories, "Culture", visitor.categoryDefinitions),
      ).toBe(true);
      expect(
        matchesPoiCategory(visitor.pois[0].categories, "architecture", visitor.categoryDefinitions),
      ).toBe(false);
      // A later type refresh retains the accepted organization.
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))!.categoryIds).toEqual(
        after.categoryIds,
      );
    });

    it("preserves siblings, independent categories and ownership across cities and POIs without Stories", async () => {
      const first = example(),
        second = example();
      second.detail.id = randomUUID();
      await prepare([first, second]);
      const input = await categoryWrite(first);
      input.definitions.push(
        { id: "tower", name: "Tower", parentId: "architecture" },
        { id: "culture", name: "Culture" },
        { id: "independent", name: "Independent" },
      );
      input.categoryIds = ["amphitheatre", "tower", "architecture", "independent", "culture"];
      await repository.savePoiCategories(input);
      await repository.savePoiCategories({
        ...(await categoryWrite(second)),
        categoryIds: ["amphitheatre", "architecture"],
      });
      await pool.query("INSERT INTO content.city_catalogs(city) VALUES ('milan')");
      await pool.query("UPDATE content.pois SET city = 'milan' WHERE id = $1", [second.detail.id]);
      await pool.query(
        "INSERT INTO content.poi_type_category_assignments VALUES ($1,'amphitheatre'),($1,'architecture'),($2,'amphitheatre'),($2,'architecture')",
        [first.detail.id, second.detail.id],
      );
      const revision = randomUUID();
      await pool.query(
        `INSERT INTO content.type_category_rules(type_id,decision,category_ids,origin,revision,reason)
        VALUES ('Q1','mapped','["architecture"]','automatic',$1,'Old reason'),('Q2','ignored','[]','manual',$2,NULL),('Q3','unmapped','[]','manual',$3,NULL)`,
        [revision, randomUUID(), randomUUID()],
      );
      const rules = await repository.getTypeCategoryRules();
      await repository.moveCategory({
        id: "amphitheatre",
        parentId: "culture",
        expectedStateDigest: (await repository.getCategoryCatalog()).stateDigest,
      });
      expect((await repository.getPoiCategoriesBaseline(first.detail.id))!.categoryIds).toEqual([
        "amphitheatre",
        "architecture",
        "culture",
        "independent",
        "tower",
      ]);
      expect((await repository.getPoiCategoriesBaseline(second.detail.id))!.categoryIds).toEqual([
        "amphitheatre",
        "culture",
      ]);
      const accepted = await repository.getTypeCategoryRules();
      expect(accepted.rules[0]).toMatchObject({
        categoryIds: ["architecture", "amphitheatre", "tower", "culture"],
        origin: "manual",
      });
      expect(accepted.rules[0].reason).toBeUndefined();
      expect(accepted.rules.slice(1)).toEqual(rules.rules.slice(1));
      expect(
        (
          await pool.query(
            "SELECT FROM content.poi_type_category_assignments WHERE poi_id=$1 AND category_id='culture'",
            [first.detail.id],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT FROM content.poi_type_category_assignments WHERE poi_id=$1 AND category_id='culture'",
            [second.detail.id],
          )
        ).rowCount,
      ).toBe(1);
      expect(await repository.getStory(first.detail.id)).toBeUndefined();
      expect(await repository.getStory(second.detail.id)).toBeUndefined();
      await repository.moveCategory({
        id: "amphitheatre",
        parentId: null,
        expectedStateDigest: (await repository.getCategoryCatalog()).stateDigest,
      });
      expect((await repository.getPoiCategoriesBaseline(second.detail.id))!.categoryIds).toEqual([
        "amphitheatre",
      ]);
    });

    it("updates the derived scope of a destination-parent-only rule immediately and after reacquisition", async () => {
      const writes = [example(), example()];
      writes[1].detail.id = randomUUID();
      await prepare(writes);
      await repository.savePoiCategories(await categoryWrite(writes[0]));
      await repository.createCategory({
        name: "Culture",
        expectedStateDigest: (await repository.getCategoryCatalog()).stateDigest,
      });
      await repository.savePoiTypes(await typesWrite(writes[0].detail.id));
      const acquisition = await typesWrite(writes[1].detail.id);
      acquisition.acquisition.types = [{ id: "Q2", label: "cultural place" }];
      await repository.savePoiTypes(acquisition);
      await saveRule("Q1", ["amphitheatre"]);
      await saveRule("Q2", ["Culture"]);
      expect((await repository.getPoiCategoriesBaseline(writes[1].detail.id))!.categoryIds).toEqual(
        ["Culture"],
      );
      await repository.moveCategory({
        id: "amphitheatre",
        parentId: "Culture",
        expectedStateDigest: (await repository.getCategoryCatalog()).stateDigest,
      });
      const after = (await repository.getPoiCategoriesBaseline(writes[1].detail.id))!;
      expect(after.categoryIds).toEqual(["Culture", "amphitheatre"]);
      const refreshed = await typesWrite(writes[1].detail.id);
      refreshed.acquisition.types = acquisition.acquisition.types;
      await repository.savePoiTypes(refreshed);
      expect((await repository.getPoiCategoriesBaseline(writes[1].detail.id))!.categoryIds).toEqual(
        after.categoryIds,
      );
    });

    it("rejects invalid or stale moves, leaves no-ops untouched and serializes competing global writes", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      await repository.createCategory({
        name: "Culture",
        expectedStateDigest: (await repository.getCategoryCatalog()).stateDigest,
      });
      const baseline = await repository.getCategoryCatalog();
      const assignments = await repository.getPoiCategoriesBaseline(write.detail.id);
      for (const [id, parentId] of [
        ["missing", null],
        ["amphitheatre", "missing"],
        ["amphitheatre", "amphitheatre"],
        ["Culture", "amphitheatre"],
        ["architecture", "Culture"],
      ])
        await expect(
          repository.moveCategory({ id, parentId, expectedStateDigest: baseline.stateDigest }),
        ).rejects.toMatchObject({ reason: "invalid" });
      await repository.moveCategory({
        id: "amphitheatre",
        parentId: "architecture",
        expectedStateDigest: baseline.stateDigest,
      });
      expect(await repository.getCategoryCatalog()).toEqual(baseline);
      expect(await repository.getPoiCategoriesBaseline(write.detail.id)).toEqual(assignments);
      const pending = await categoryWrite(write);
      const rules = await repository.getTypeCategoryRules();
      const outcomes = await Promise.allSettled([
        repository.moveCategory({
          id: "amphitheatre",
          parentId: "Culture",
          expectedStateDigest: baseline.stateDigest,
        }),
        repository.renameCategory({
          id: "amphitheatre",
          name: "Arena",
          expectedStateDigest: baseline.stateDigest,
        }),
      ]);
      expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
      await expect(
        repository.moveCategory({
          id: "amphitheatre",
          parentId: null,
          expectedStateDigest: baseline.stateDigest,
        }),
      ).rejects.toMatchObject({ reason: "conflict" });
      await expect(repository.savePoiCategories(pending)).rejects.toMatchObject({
        reason: "conflict",
      });
      await expect(
        repository.saveTypeCategoryRule({
          typeId: "Q1",
          categories: ["amphitheatre"],
          revision: randomUUID(),
          expectedStateDigest: rules.stateDigest,
        }),
      ).rejects.toMatchObject({ reason: "conflict" });
    });

    it("rolls back hierarchy, rules, contributions and memberships when any assignment update fails", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      await repository.savePoiTypes(await typesWrite(write.detail.id));
      await saveRule("Q1", ["amphitheatre"]);
      const baseline = await repository.getCategoryCatalog();
      const rules = await repository.getTypeCategoryRules();
      const assignments = await repository.getPoiCategoriesBaseline(write.detail.id);
      const derived = (
        await pool.query("SELECT * FROM content.poi_type_category_assignments ORDER BY category_id")
      ).rows;
      await pool.query(
        `ALTER TABLE content.poi_category_writes ADD CONSTRAINT test_move_revision CHECK (revision = '${assignments!.revision}')`,
      );
      try {
        await expect(
          repository.moveCategory({
            id: "amphitheatre",
            parentId: null,
            expectedStateDigest: baseline.stateDigest,
          }),
        ).rejects.toBeDefined();
      } finally {
        await pool.query(
          "ALTER TABLE content.poi_category_writes DROP CONSTRAINT test_move_revision",
        );
      }
      expect(await repository.getCategoryCatalog()).toEqual(baseline);
      expect(await repository.getTypeCategoryRules()).toEqual(rules);
      expect(await repository.getPoiCategoriesBaseline(write.detail.id)).toEqual(assignments);
      expect(
        (
          await pool.query(
            "SELECT * FROM content.poi_type_category_assignments ORDER BY category_id",
          )
        ).rows,
      ).toEqual(derived);
    });

    it("renames through authenticated HTTP without changing content or assignments, and refreshes visitor filters after 60 seconds", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      await repository.saveStory(write);
      const story = await repository.getStory(write.detail.id);
      const person = await repository.getPerson("vespasian");
      const assignments = await repository.getPoiCategoriesBaseline(write.detail.id);
      let time = 0;
      const cached = createCachedRead(repository.getCityPreviews, () => time);
      expect(toVisitorCity(await cached("rome")).categoryDefinitions).toContainEqual({
        id: "amphitheatre",
        name: "Amphitheatre",
        parent: "architecture",
      });
      const baseline = await repository.getCategoryCatalog();
      const response = await createContentHandler(() => repository)(
        new Request("http://localhost/api/admin/content/v1/categories/amphitheatre", {
          method: "PUT",
          headers: {
            authorization: `Bearer ${process.env.CONTENT_API_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: "  Roman   arena ",
            expectedStateDigest: baseline.stateDigest,
          }),
        }),
        { params: Promise.resolve({ segments: ["categories", "amphitheatre"] }) },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: "saved",
        definition: {
          id: "amphitheatre",
          name: "Roman arena",
          label: "Roman arena",
          parentId: "architecture",
        },
      });
      expect((await createPostgresContent(pool).getCategoryCatalog()).definitions).toContainEqual({
        id: "amphitheatre",
        name: "Roman arena",
        label: "Roman arena",
        parentId: "architecture",
      });
      expect(await repository.getStory(write.detail.id)).toEqual(story);
      expect(await repository.getPerson("vespasian")).toEqual(person);
      const after = await repository.getPoiCategoriesBaseline(write.detail.id);
      expect(after).toMatchObject({
        poiId: assignments!.poiId,
        inputRevision: assignments!.inputRevision,
        revision: assignments!.revision,
        categoryIds: assignments!.categoryIds,
      });
      expect(after!.stateDigest).not.toBe(assignments!.stateDigest);
      time = 59_999;
      expect(
        toVisitorCity(await cached("rome")).categoryDefinitions.find(
          ({ id }) => id === "amphitheatre",
        )?.name,
      ).toBe("Amphitheatre");
      time = 60_000;
      const visitor = toVisitorCity(await cached("rome"));
      expect(visitor.categoryDefinitions).toContainEqual({
        id: "amphitheatre",
        name: "Roman arena",
        label: "Roman arena",
        parent: "architecture",
      });
      expect(visitor.pois[0].categories).toEqual(["amphitheatre"]);
    });

    it("rejects invalid, duplicate and stale renames and preserves definitions", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      const baseline = await repository.getCategoryCatalog();
      for (const name of ["", " ", "<bad>", "a\nb", "x".repeat(81), "architecture"])
        await expect(
          repository.renameCategory({
            id: "amphitheatre",
            name,
            expectedStateDigest: baseline.stateDigest,
          }),
        ).rejects.toBeDefined();
      await expect(
        repository.renameCategory({
          id: "missing",
          name: "New",
          expectedStateDigest: baseline.stateDigest,
        }),
      ).rejects.toMatchObject({ reason: "invalid" });
      expect(await repository.getCategoryCatalog()).toEqual(baseline);
      await repository.renameCategory({
        id: "architecture",
        name: "Structures",
        expectedStateDigest: baseline.stateDigest,
      });
      await expect(
        repository.renameCategory({
          id: "amphitheatre",
          name: "New",
          expectedStateDigest: baseline.stateDigest,
        }),
      ).rejects.toMatchObject({ reason: "conflict" });
    });

    it("serializes competing renames and prevents older POI and rule writes from restoring a name", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      const pending = await categoryWrite(write);
      const rules = await repository.getTypeCategoryRules();
      const baseline = await repository.getCategoryCatalog();
      const results = await Promise.allSettled(
        ["Arena", "Stadium"].map((name) =>
          repository.renameCategory({
            id: "amphitheatre",
            name,
            expectedStateDigest: baseline.stateDigest,
          }),
        ),
      );
      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
      await expect(repository.savePoiCategories(pending)).rejects.toMatchObject({
        reason: "conflict",
      });
      await expect(
        repository.saveTypeCategoryRule({
          typeId: "Q1",
          categories: ["amphitheatre"],
          revision: randomUUID(),
          expectedStateDigest: rules.stateDigest,
        }),
      ).rejects.toMatchObject({ reason: "conflict" });
      // Refreshing the assignment baseline alone still cannot submit an old definition.
      const fresh = (await repository.getPoiCategoriesBaseline(write.detail.id))!;
      await expect(
        repository.savePoiCategories({ ...pending, expectedStateDigest: fresh.stateDigest }),
      ).rejects.toMatchObject({ reason: "conflict" });
      expect(
        (await repository.getCategoryCatalog()).definitions.find(({ id }) => id === "amphitheatre")
          ?.name,
      ).not.toBe("Amphitheatre");
    });

    it("allows only one concurrent category creation against the same catalog version", async () => {
      const baseline = await repository.getCategoryCatalog();
      const outcomes = await Promise.allSettled(
        ["Museum", "Theatre"].map((name) =>
          repository.createCategory({
            name,
            expectedStateDigest: baseline.stateDigest,
          }),
        ),
      );
      expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
      expect((await repository.getCategoryCatalog()).definitions).toHaveLength(1);
    });

    it("coordinates catalog creation with pending per-POI category writes in both directions", async () => {
      const write = example();
      await prepare([write]);
      const pending = await categoryWrite(write);
      const before = await repository.getCategoryCatalog();
      await repository.createCategory({ name: "Museum", expectedStateDigest: before.stateDigest });
      await expect(repository.savePoiCategories(pending)).rejects.toMatchObject({
        reason: "conflict",
      });
      const after = await repository.getCategoryCatalog();
      await repository.savePoiCategories(await categoryWrite(write));
      await expect(
        repository.createCategory({ name: "Theatre", expectedStateDigest: after.stateDigest }),
      ).rejects.toMatchObject({ reason: "conflict" });
      expect((await repository.getCategoryCatalog()).definitions.map(({ id }) => id)).toEqual([
        "Museum",
        "amphitheatre",
        "architecture",
      ]);
    });

    it("saves categories before publication and exposes them through all public relationships without changing content", async () => {
      const write = example();
      const other = example();
      other.detail.id = randomUUID();
      other.detail.publicationId = randomUUID();
      await prepare([write, other]);
      const input = await categoryWrite(write);
      expect(await repository.savePoiCategories(input)).toEqual({
        status: "saved",
        revision: input.revision,
      });
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.categoryIds).toEqual([
        "amphitheatre",
      ]);
      expect((await repository.getCity("rome")).pois).toEqual([]);
      expect(await repository.getStory(write.detail.id)).toBeUndefined();
      write.detail.gallery = [
        {
          id: "Colosseum.jpg",
          commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Colosseum.jpg",
          thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
          originalImageUrl: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
          license: "CC BY-SA 4.0",
          attribution: "Example photographer",
        },
      ];
      write.detail.mainImageId = "Colosseum.jpg";
      await repository.saveStory(write);
      await repository.saveStory(other);
      let time = 0;
      const cachedCity = createCachedRead(repository.getCity, () => time);
      expect(
        (await cachedCity("rome")).pois.find((poi) => poi.id === write.detail.id)?.categoryIds,
      ).toEqual(["amphitheatre"]);
      const story = await repository.getStory(write.detail.id);
      const person = await repository.getPerson("vespasian");
      const clear = { ...(await categoryWrite(write)), categoryIds: [], definitions: [] };
      await repository.savePoiCategories(clear);
      time = 59_999;
      expect(
        (await cachedCity("rome")).pois.find((poi) => poi.id === write.detail.id)?.categoryIds,
      ).toEqual(["amphitheatre"]);
      time = 60_000;
      expect(
        (await cachedCity("rome")).pois.find((poi) => poi.id === write.detail.id)?.categoryIds,
      ).toEqual([]);
      expect(await repository.getStory(write.detail.id)).toEqual({ ...story, categoryIds: [] });
      expect(await repository.getPerson("vespasian")).toEqual({
        ...person,
        linkedPois: person!.linkedPois.map((poi) =>
          poi.id === write.detail.id ? { ...poi, categoryIds: [] } : poi,
        ),
      });
      expect(
        (await repository.getCity("rome")).pois.every((poi) => poi.categoryIds.length === 0),
      ).toBe(true);
      await repository.savePoiCategories(await categoryWrite(other));
      expect(
        (await repository.getCityPreviews("rome")).pois.find((poi) => poi.id === other.detail.id)
          ?.categoryIds,
      ).toEqual(["amphitheatre"]);
      expect((await repository.getStory(write.detail.id))?.categoryIds).toEqual([]);
      // A later Story save still cannot replace independent categories.
      other.expectedPublicationId = other.detail.publicationId;
      other.detail.publicationId = randomUUID();
      other.detail.categoryIds = [];
      await repository.saveStory(other);
      expect((await repository.getStory(other.detail.id))?.categoryIds).toEqual(["amphitheatre"]);
      expect((await repository.getCity("rome")).categoryDefinitions).toEqual(
        expect.arrayContaining(input.definitions),
      );
    });

    it("acknowledges concurrent identical category retries and rejects changed payloads and superseded retries", async () => {
      const write = example();
      await prepare([write]);
      const input = await categoryWrite(write);
      expect(
        (
          await Promise.all([
            repository.savePoiCategories(input),
            repository.savePoiCategories(input),
          ])
        )
          .map(({ status }) => status)
          .sort(),
      ).toEqual(["already-saved", "saved"]);
      await expect(
        repository.savePoiCategories({ ...input, categoryIds: [] }),
      ).rejects.toMatchObject({ reason: "invalid" });
      await pool.query(
        "INSERT INTO content.categories(id, name) VALUES ('unrelated', 'Unrelated')",
      );
      expect(await repository.savePoiCategories(input)).toEqual({
        status: "already-saved",
        revision: input.revision,
      });
      await repository.savePoiCategories({
        ...(await categoryWrite(write)),
        categoryIds: [],
        definitions: [],
      });
      await expect(repository.savePoiCategories(input)).rejects.toMatchObject({
        reason: "conflict",
      });
    });

    it("rejects competing category writes and stale shared-definition baselines", async () => {
      const write = example();
      const other = example();
      other.detail.id = randomUUID();
      await prepare([write, other]);
      const input = await categoryWrite(write);
      const stale = await categoryWrite(other);
      const results = await Promise.allSettled([
        repository.savePoiCategories(input),
        repository.savePoiCategories({ ...input, revision: randomUUID(), categoryIds: [] }),
      ]);
      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(results.find(({ status }) => status === "rejected")).toMatchObject({
        reason: { reason: "conflict" },
      });
      await expect(repository.savePoiCategories(stale)).rejects.toMatchObject({
        reason: "conflict",
      });
      const fresh = await categoryWrite(other);
      await expect(
        repository.savePoiCategories({
          ...fresh,
          definitions: [{ id: "architecture", name: "Changed" }],
        }),
      ).rejects.toMatchObject({ reason: "conflict" });
      await pool.query("INSERT INTO content.poi_categories VALUES ($1, 'architecture')", [
        other.detail.id,
      ]);
      await expect(repository.savePoiCategories(fresh)).rejects.toMatchObject({
        reason: "conflict",
      });
    });

    it("rejects duplicate categories, missing references and cyclic hierarchies without persisting definitions", async () => {
      const write = example();
      await prepare([write]);
      const input = await categoryWrite(write);
      for (const invalid of [
        { ...input, categoryIds: ["amphitheatre", "amphitheatre"] },
        { ...input, definitions: [...input.definitions, input.definitions[0]] },
        { ...input, categoryIds: ["missing"] },
        {
          ...input,
          definitions: [{ id: "amphitheatre", name: "Amphitheatre", parentId: "missing" }],
        },
        {
          ...input,
          definitions: [{ id: "amphitheatre", name: "Amphitheatre", parentId: "amphitheatre" }],
        },
        {
          ...input,
          definitions: [
            input.definitions[0],
            { id: "architecture", name: "Architecture", parentId: "amphitheatre" },
          ],
        },
      ])
        await expect(repository.savePoiCategories(invalid)).rejects.toThrow();
      expect((await pool.query("SELECT FROM content.categories")).rowCount).toBe(0);
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.revision).toBeNull();
    });

    it("rolls back definitions, replacement assignments and retry metadata after a late database failure", async () => {
      const write = example();
      await prepare([write]);
      await repository.savePoiCategories(await categoryWrite(write));
      const baseline = await repository.getPoiCategoriesBaseline(write.detail.id);
      const input = {
        ...(await categoryWrite(write)),
        categoryIds: ["new"],
        definitions: [{ id: "new", name: "New" }],
      };
      await pool.query(
        "ALTER TABLE content.poi_category_writes ADD CONSTRAINT test_reject_revision CHECK (revision <> '" +
          input.revision +
          "'::uuid)",
      );
      try {
        await expect(repository.savePoiCategories(input)).rejects.toMatchObject({ code: "23514" });
        expect(await repository.getPoiCategoriesBaseline(write.detail.id)).toEqual(baseline);
      } finally {
        await pool.query(
          "ALTER TABLE content.poi_category_writes DROP CONSTRAINT test_reject_revision",
        );
      }
      expect(await repository.savePoiCategories(input)).toEqual({
        status: "saved",
        revision: input.revision,
      });
    });

    it("rejects missing, removed and changed-input POIs even for a committed retry", async () => {
      const write = example();
      const catalog = await prepare([write]);
      const input = await categoryWrite(write);
      await expect(
        repository.savePoiCategories({ ...input, poiId: randomUUID() }),
      ).rejects.toMatchObject({ reason: "obsolete" });
      await expect(
        repository.savePoiCategories({ ...input, inputRevision: randomUUID() }),
      ).rejects.toMatchObject({ reason: "obsolete" });
      await repository.savePoiCategories(input);
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: randomUUID(),
        pois: [],
      });
      expect(await repository.getPoiCategoriesBaseline(write.detail.id)).toBeUndefined();
      await expect(repository.savePoiCategories(input)).rejects.toMatchObject({
        reason: "obsolete",
      });
      const removed = await repository.getCatalogBaseline("rome");
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: removed.revision,
        revision: randomUUID(),
      });
      await expect(repository.savePoiCategories(input)).rejects.toMatchObject({
        reason: "obsolete",
      });
      expect((await repository.getPoiCategoriesBaseline(write.detail.id))?.revision).toBeNull();
    });

    it("serves authenticated category baselines, writes and retries through the HTTP contract", async () => {
      const write = example();
      await prepare([write]);
      const handle = createContentHandler(() => repository);
      const call = (action: string, body?: unknown) =>
        handle(
          new Request(
            "http://localhost/api/admin/content/v1/pois/" + write.detail.id + "/" + action,
            {
              method: body ? "PUT" : "GET",
              headers: {
                authorization: `Bearer ${process.env.CONTENT_API_TOKEN}`,
                "content-type": "application/json",
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
            },
          ),
          { params: Promise.resolve({ segments: ["pois", write.detail.id, action] }) },
        );
      const baseline = await call("categories-baseline");
      expect(baseline.headers.get("cache-control")).toBe("no-store");
      expect(await baseline.json()).toMatchObject({
        poiId: write.detail.id,
        revision: null,
        categoryIds: [],
        definitions: [],
      });
      const input = await categoryWrite(write);
      expect(await (await call("categories", input)).json()).toEqual({
        status: "saved",
        revision: input.revision,
      });
      expect(await (await call("categories", input)).json()).toEqual({
        status: "already-saved",
        revision: input.revision,
      });
      const conflict = await call("categories", { ...input, revision: randomUUID() });
      expect(conflict.status).toBe(409);
      expect(await conflict.json()).toMatchObject({ error: { code: "conflict" } });
    });

    it("publishes a complete Story with a placeholder and composes both relationship directions", async () => {
      const write = example();
      await prepare([write]);
      expect((await repository.getCity("rome")).pois).toEqual([]);
      expect(await repository.getPerson("vespasian")).toBeUndefined();
      expect(await repository.saveStory(write)).toBe("saved");
      expect(await repository.getStory(write.detail.id)).toMatchObject({
        id: write.detail.id,
        sources: write.detail.sources,
        gallery: [],
        mainImageId: null,
        story: write.detail.story,
      });
      expect((await repository.getCity("rome")).pois).toHaveLength(1);
      expect(await repository.getPerson("vespasian")).toMatchObject({
        id: "vespasian",
        linkedPois: [{ id: write.detail.id }],
      });
    });

    it("loads published previews with the selected image and hides removed POIs", async () => {
      const write = example();
      const catalog = await prepare([write]);
      expect((await repository.getCityPreviews("rome")).pois).toEqual([]);
      await repository.saveStory(write);
      expect((await repository.getCityPreviews("rome")).pois).toEqual([
        {
          id: write.detail.id,
          city: "rome",
          name: "Colosseum",
          coordinates: write.detail.coordinates,
          categoryIds: [],
          wikidataId: "Q10285",
          mainImage: null,
          introduction: "A Roman amphitheatre.",
        },
      ]);
      const image = {
        id: "Colosseum.jpg",
        commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Colosseum.jpg",
        thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
        originalImageUrl: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
        license: "CC BY-SA 4.0",
        attribution: "Example photographer",
      };
      write.expectedPublicationId = write.detail.publicationId;
      write.detail.publicationId = randomUUID();
      write.detail.gallery = [image];
      write.detail.mainImageId = image.id;
      await repository.saveStory(write);
      expect((await repository.getCityPreviews("rome")).pois[0].mainImage).toEqual(image);
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: randomUUID(),
        pois: [],
      });
      expect((await repository.getCityPreviews("rome")).pois).toEqual([]);
      expect((await repository.getCityPreviews("rome")).removedPois).toEqual([
        { id: write.detail.id, wikidataId: "Q10285" },
      ]);
      expect(await repository.getStory(write.detail.id)).toBeUndefined();
      expect(await repository.getPerson("vespasian")).toBeUndefined();
    });

    it("permits no Related People and rejects invalid data before persistence", async () => {
      const write = example();
      await prepare([write]);
      await expect(
        repository.saveStory({ ...write, privatePath: "/private/data" }),
      ).rejects.toThrow();
      write.detail.story.relatedPeople = [];
      write.people = [];
      await repository.saveStory(write);
      expect((await repository.getStory(write.detail.id))?.story.relatedPeople).toEqual([]);
    });

    it("requires publication Sources to match every current catalog page identity", async () => {
      const write = example();
      await prepare([write]);
      write.detail.sources[0].pageId = 999;
      await expect(repository.saveStory(write)).rejects.toMatchObject({ reason: "invalid" });
      expect(await repository.getStory(write.detail.id)).toBeUndefined();
      expect((await pool.query("SELECT FROM content.people")).rowCount).toBe(0);
    });

    it("acknowledges exact repeated saves, including concurrent retries, but rejects changed payloads", async () => {
      const write = example();
      await prepare([write]);
      expect(
        (await Promise.all([repository.saveStory(write), repository.saveStory(write)])).sort(),
      ).toEqual(["already-saved", "saved"]);
      await expect(
        repository.saveStory({ ...write, generation: { ...write.generation, model: "different" } }),
      ).rejects.toMatchObject({ reason: "invalid" });
    });

    it("serializes competing replacements so only one can replace the expected version", async () => {
      const write = example();
      await prepare([write]);
      const other = structuredClone(write);
      other.detail.publicationId = randomUUID();
      const results = await Promise.allSettled([
        repository.saveStory(write),
        repository.saveStory(other),
      ]);
      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(results.find(({ status }) => status === "rejected")).toMatchObject({
        reason: { reason: "conflict" },
      });
      const published = await repository.getStory(write.detail.id);
      expect([write.detail.publicationId, other.detail.publicationId]).toContain(
        published?.publicationId,
      );
    });

    it("keeps old complete reads visible until the replacement transaction commits", async () => {
      const write = example();
      await prepare([write]);
      await repository.saveStory(write);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const content = {
          textFormat: write.detail.story.textFormat,
          introduction: structuredClone(write.detail.story.introduction),
          topics: write.detail.story.topics,
        };
        content.introduction.text = "Replaced introduction.";
        await client.query("UPDATE content.published_stories SET content = $2 WHERE poi_id = $1", [
          write.detail.id,
          JSON.stringify(content),
        ]);
        await client.query("DELETE FROM content.poi_people WHERE poi_id = $1", [write.detail.id]);
        expect(await repository.getStory(write.detail.id)).toMatchObject({
          story: {
            introduction: { text: "A Roman amphitheatre." },
            relatedPeople: [{ personId: "vespasian" }],
          },
        });
        await client.query("COMMIT");
        expect(await repository.getStory(write.detail.id)).toMatchObject({
          story: {
            introduction: { text: "Replaced introduction." },
            relatedPeople: [],
          },
        });
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    });

    it("rolls back a new Person and retains the old complete Story on a later failure", async () => {
      const write = example();
      await prepare([write]);
      await repository.saveStory(write);
      const next = structuredClone(write);
      next.expectedPublicationId = write.detail.publicationId;
      next.detail.publicationId = randomUUID();
      next.people[0].person.id = "a-new";
      next.people[0].wikidataId = "Q100";
      next.people[0].profileVersion = randomUUID();
      next.detail.story.relatedPeople = [
        { personId: "a-new", name: "New Person", sourceIds: ["wikipedia"] },
        { personId: "z-missing", name: "Missing Person", sourceIds: ["wikipedia"] },
      ];
      await expect(repository.saveStory(next)).rejects.toMatchObject({ reason: "invalid" });
      expect((await repository.getStory(write.detail.id))?.publicationId).toBe(
        write.detail.publicationId,
      );
      expect((await pool.query("SELECT FROM content.people WHERE id = 'a-new'")).rowCount).toBe(0);
      expect((await repository.getPerson("vespasian"))?.linkedPois).toHaveLength(1);
    });

    it("keeps previous public content after changed names/Sources and rejects obsolete results", async () => {
      const write = example();
      const catalog = await prepare([write]);
      await repository.saveStory(write);
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: randomUUID(),
        pois: [
          {
            ...catalog.pois[0],
            name: "Changed attraction",
            wikipediaPages: [
              {
                ...catalog.pois[0].wikipediaPages[0],
                pageId: 123,
              },
            ],
          },
        ],
      });
      await expect(repository.saveStory(write)).rejects.toMatchObject({ reason: "obsolete" });
      expect((await repository.getStory(write.detail.id))?.name).toBe("Colosseum");
    });

    it("preserves corrected coordinates and category assignments when a queued Story is saved", async () => {
      const write = example();
      const catalog = await prepare([write]);
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: randomUUID(),
        pois: [{ ...catalog.pois[0], coordinates: { lat: 42, lng: 13 } }],
      });
      await pool.query(
        "INSERT INTO content.categories(id, name) VALUES ('architecture', 'Architecture')",
      );
      await pool.query(
        "INSERT INTO content.poi_categories(poi_id, category_id) VALUES ($1, 'architecture')",
        [write.detail.id],
      );
      await repository.saveStory(write);
      expect(await repository.getStory(write.detail.id)).toMatchObject({
        coordinates: { lat: 42, lng: 13 },
        categoryIds: ["architecture"],
      });
    });

    it("does not invalidate generation when only a Wikipedia title or URL changes", async () => {
      const write = example();
      const catalog = await prepare([write]);
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: randomUUID(),
        pois: [
          {
            ...catalog.pois[0],
            wikipediaPages: [
              {
                ...catalog.pois[0].wikipediaPages[0],
                title: "Renamed article",
                url: "https://en.wikipedia.org/wiki/Renamed_article",
              },
            ],
          },
        ],
      });
      expect(await repository.saveStory(write)).toBe("saved");
    });

    it("invalidates old results even if generation inputs change and later return to their old values", async () => {
      const write = example();
      const catalog = await prepare([write]);
      const changedRevision = randomUUID();
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: changedRevision,
        pois: [{ ...catalog.pois[0], name: "Changed name" }],
      });
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: changedRevision,
        revision: randomUUID(),
      });
      await expect(repository.saveStory(write)).rejects.toMatchObject({ reason: "obsolete" });
    });

    it("removes visibility, prunes unreferenced People and rejects old saves after reintroduction", async () => {
      const write = example();
      const catalog = await prepare([write]);
      await repository.saveStory(write);
      const removalRevision = randomUUID();
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: removalRevision,
        pois: [],
      });
      expect(await repository.getStory(write.detail.id)).toBeUndefined();
      expect(await repository.getPerson("vespasian")).toBeUndefined();
      expect((await pool.query("SELECT FROM content.people")).rowCount).toBe(0);
      await expect(repository.saveStory(write)).rejects.toMatchObject({ reason: "obsolete" });
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: removalRevision,
        revision: randomUUID(),
      });
      await expect(repository.saveStory(write)).rejects.toMatchObject({ reason: "obsolete" });
      expect(await repository.getStory(write.detail.id)).toBeUndefined();
    });

    it("updates one shared profile without letting delayed POI payloads overwrite it", async () => {
      const first = example();
      const second = example();
      const catalog = await prepare([first, second]);
      await repository.saveStory(first);
      const update = {
        ...first.people[0],
        expectedProfileVersion: first.people[0].profileVersion,
        profileVersion: randomUUID(),
        person: { ...first.people[0].person, name: "Updated Vespasian" },
      };
      expect(await repository.savePerson(update)).toBe("saved");
      expect(await repository.savePerson(update)).toBe("already-saved");
      await repository.saveStory(second);
      expect(await repository.getPerson("vespasian")).toMatchObject({ name: "Updated Vespasian" });
      expect((await repository.getPerson("vespasian"))?.linkedPois).toHaveLength(2);
      await expect(
        repository.savePerson({ ...update, profileVersion: randomUUID() }),
      ).rejects.toMatchObject({ reason: "conflict" });
      await repository.synchronizeCatalog({
        ...catalog,
        expectedRevision: catalog.revision,
        revision: randomUUID(),
        pois: [catalog.pois[1]],
      });
      expect((await repository.getPerson("vespasian"))?.linkedPois.map(({ id }) => id)).toEqual([
        second.detail.id,
      ]);
    });

    it("rejects delayed catalog mutations and revision reuse with different payloads", async () => {
      const write = example();
      const catalog = await prepare([write]);
      expect(await repository.synchronizeCatalog(catalog)).toBe("already-saved");
      await expect(repository.synchronizeCatalog({ ...catalog, pois: [] })).rejects.toMatchObject({
        reason: "invalid",
      });
      await expect(
        repository.synchronizeCatalog({ ...catalog, revision: randomUUID(), pois: [] }),
      ).rejects.toMatchObject({ reason: "conflict" });
      expect((await pool.query("SELECT FROM content.pois WHERE removed_at IS NULL")).rowCount).toBe(
        1,
      );
    });

    it("does not reassign a POI UUID to a different city", async () => {
      const write = example();
      const catalog = await prepare([write]);
      await expect(
        repository.synchronizeCatalog({ ...catalog, city: "milan", revision: randomUUID() }),
      ).rejects.toMatchObject({ reason: "conflict" });
      expect(
        (await pool.query("SELECT FROM content.city_catalogs WHERE city = 'milan'")).rowCount,
      ).toBe(0);
    });

    it("allows the reader role to read public views but denies base tables and mutations", async () => {
      const write = example();
      await prepare([write]);
      await repository.saveStory(write);
      const client = await pool.connect();
      try {
        await client.query("SET ROLE historical_explorer_reader");
        expect((await client.query("SELECT response FROM content.visitor_stories")).rowCount).toBe(
          1,
        );
        await expect(client.query("SELECT FROM content.pois")).rejects.toMatchObject({
          code: "42501",
        });
        for (const table of ["type_category_rules", "poi_type_category_assignments"])
          await expect(client.query(`SELECT FROM content.${table}`)).rejects.toMatchObject({
            code: "42501",
          });
        await expect(client.query("DELETE FROM content.published_stories")).rejects.toMatchObject({
          code: "42501",
        });
      } finally {
        await client.query("RESET ROLE");
        client.release();
      }
    });

    it("lets the writer role publish without granting schema ownership", async () => {
      const write = example();
      await prepare([write]);
      const writer = new Pool({
        connectionString: process.env.HISTORICAL_EXPLORER_TEST_DATABASE_URL,
        options: "-c role=historical_explorer_writer",
        max: 1,
      });
      try {
        const categories = await categoryWrite(write);
        expect(await createPostgresContent(writer).savePoiCategories(categories)).toEqual({
          status: "saved",
          revision: categories.revision,
        });
        expect(
          await createPostgresContent(writer).getPoiCategoriesBaseline(write.detail.id),
        ).toMatchObject({ revision: categories.revision });
        expect(await createPostgresContent(writer).saveStory(write)).toBe("saved");
        expect((await createPostgresContent(writer).getStory(write.detail.id))?.publicationId).toBe(
          write.detail.publicationId,
        );
        await createPostgresContent(writer).savePoiTypes(await typesWrite(write.detail.id));
        await createPostgresContent(writer).saveTypeCategoryRule({
          typeId: "Q1",
          categories: ["architecture"],
          revision: randomUUID(),
          expectedStateDigest: (await createPostgresContent(writer).getTypeCategoryRules())
            .stateDigest,
        });
        expect((await createPostgresContent(writer).getTypeCategoryRules()).rules[0].origin).toBe(
          "manual",
        );
        await expect(
          writer.query("CREATE TABLE content.forbidden(id integer)"),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await writer.end();
      }
    });

    it("reads unpublished POIs, unknown/empty catalogs and hidden People independently of visitor visibility", async () => {
      expect(await repository.getCatalogBaseline("unknown")).toEqual({
        city: "unknown",
        revision: null,
        pois: [],
      });
      const write = example();
      const catalog = await prepare([write]);
      expect(await repository.getCatalogBaseline("rome")).toMatchObject({
        revision: catalog.revision,
        pois: [
          {
            id: write.detail.id,
            inputRevision: write.inputRevision,
            name: "Colosseum",
            osmIds: ["relation/1834818"],
          },
        ],
      });
      expect(await repository.getPoiBaseline(write.detail.id)).toMatchObject({
        poiId: write.detail.id,
        publicationId: null,
        relatedPeople: [],
        inputRevision: write.inputRevision,
      });
      expect(await repository.getPoiBaseline(randomUUID())).toBeUndefined();
      expect(await repository.getPersonBaseline("missing")).toBeUndefined();
      await repository.saveStory(write);
      expect(await repository.getPoiBaseline(write.detail.id)).toMatchObject({
        publicationId: write.detail.publicationId,
        relatedPeople: [
          {
            personId: "vespasian",
            wikidataId: "Q1419",
            profileVersion: write.people[0].profileVersion,
          },
        ],
      });
      const replacement = structuredClone(write);
      replacement.expectedPublicationId = write.detail.publicationId;
      replacement.detail.publicationId = randomUUID();
      replacement.detail.story.relatedPeople = [];
      replacement.people = [];
      await repository.saveStory(replacement);
      expect(await repository.getPerson("vespasian")).toBeUndefined();
      expect(await repository.getPersonBaseline("vespasian")).toEqual({
        personId: "vespasian",
        wikidataId: "Q1419",
        profileVersion: write.people[0].profileVersion,
      });
      const revision = randomUUID();
      await repository.synchronizeCatalog({
        ...catalog,
        revision,
        expectedRevision: catalog.revision,
        pois: [],
      });
      expect(await repository.getCatalogBaseline("rome")).toEqual({
        city: "rome",
        revision,
        pois: [],
      });
      expect(await repository.getPoiBaseline(write.detail.id)).toBeUndefined();
    });

    it("serves all six HTTP operations with committed retry acknowledgements and safe SQL conflicts", async () => {
      const handle = createContentHandler(() => repository);
      const call = async (segments: string[], body?: unknown) => {
        const response = await handle(
          new Request(
            "http://localhost/api/admin/content/v1/" + segments.map(encodeURIComponent).join("/"),
            {
              method: body === undefined ? "GET" : "PUT",
              headers: {
                authorization: `Bearer ${process.env.CONTENT_API_TOKEN}`,
                "content-type": "application/json; charset=utf-8",
              },
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            },
          ),
          { params: Promise.resolve({ segments }) },
        );
        expect(response.headers.get("cache-control")).toBe("no-store");
        return { status: response.status, body: await response.json() };
      };
      const write = example();
      write.people[0].person.id = "opaque/id ? ü";
      write.detail.story.relatedPeople[0].personId = write.people[0].person.id;
      const catalog = {
        city: "rome",
        revision: randomUUID(),
        expectedRevision: null,
        pois: [
          {
            id: write.detail.id,
            name: write.detail.name,
            coordinates: write.detail.coordinates,
            osmIds: [],
            wikipediaPages: write.detail.sources.map(({ language, pageId, title, url }) => ({
              language,
              pageId,
              title,
              url,
            })),
          },
        ],
      };
      expect(await call(["catalogs", "rome"], catalog)).toEqual({
        status: 200,
        body: { status: "saved" },
      });
      expect(await call(["catalogs", "rome"], catalog)).toEqual({
        status: 200,
        body: { status: "already-saved" },
      });
      expect(await call(["catalogs", "rome"])).toMatchObject({
        status: 200,
        body: { revision: catalog.revision, pois: [{ id: write.detail.id }] },
      });
      const baseline = await call(["pois", write.detail.id, "baseline"]);
      expect(baseline).toMatchObject({ status: 200, body: { publicationId: null } });
      write.inputRevision = baseline.body.inputRevision;
      expect(await call(["pois", write.detail.id.toUpperCase(), "story"], write)).toEqual({
        status: 200,
        body: { status: "saved" },
      });
      expect(await call(["pois", write.detail.id, "story"], write)).toEqual({
        status: 200,
        body: { status: "already-saved" },
      });
      expect(await call(["people", write.people[0].person.id, "baseline"])).toMatchObject({
        status: 200,
        body: { profileVersion: write.people[0].profileVersion },
      });
      const update = {
        ...write.people[0],
        expectedProfileVersion: write.people[0].profileVersion,
        profileVersion: randomUUID(),
      };
      expect(await call(["people", update.person.id], update)).toEqual({
        status: 200,
        body: { status: "saved" },
      });
      expect(await call(["people", update.person.id], update)).toEqual({
        status: 200,
        body: { status: "already-saved" },
      });
      expect(await call(["people", "missing", "baseline"])).toMatchObject({
        status: 404,
        body: { error: { code: "not-found" } },
      });
      expect(
        await call(["people", update.person.id], { ...update, profileVersion: randomUUID() }),
      ).toMatchObject({ status: 409, body: { error: { code: "conflict" } } });
      // A distinct Person ID reusing the same Wikidata identity fails in PostgreSQL and rolls back the Story.
      const other = example();
      const nextCatalog = {
        ...catalog,
        revision: randomUUID(),
        expectedRevision: catalog.revision,
        pois: [...catalog.pois, { ...catalog.pois[0], id: other.detail.id }],
      };
      await call(["catalogs", "rome"], nextCatalog);
      other.inputRevision = (await call(["pois", other.detail.id, "baseline"])).body.inputRevision;
      expect(await call(["pois", other.detail.id, "story"], other)).toMatchObject({
        status: 409,
        body: { error: { code: "conflict" } },
      });
      expect(await repository.getStory(other.detail.id)).toBeUndefined();
    });
  },
);

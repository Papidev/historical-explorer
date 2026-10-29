import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { createPostgresContent, type catalogWriteSchema } from "./postgresContent";
import { readFile } from "node:fs/promises";
import { createContentHandler } from "./handler";
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
    });
    beforeEach(async () => {
      await pool.query(
        "TRUNCATE content.city_catalogs, content.categories, content.people CASCADE",
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

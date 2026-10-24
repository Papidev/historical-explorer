import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { createPostgresContent, type catalogWriteSchema } from "./postgresContent";
import { readFile } from "node:fs/promises";
import { createContentHandler } from "./handler";
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

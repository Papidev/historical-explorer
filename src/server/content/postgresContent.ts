// Adapted from Papidev/mira-admin, commit 2b7b203cb2ba35dadd5a36d6b0ea6eb1bf971b1d.
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { derivePoiCategories, expandCategorySelection } from "./categoryInterpretation";
import { z } from "zod";
import {
  publishedCategorySchema,
  publishedCityMapSchema,
  publishedCityPreviewSchema,
  publishedPersonSchema,
  publishedPoiDetailSchema,
  publishedPoiSummarySchema,
} from "./publishedContent";

// Display names are resolved on reads so existing publications need no regeneration.
const poiDisplayNameSql = `COALESCE((
  SELECT NULLIF(btrim(page->>'title'), '')
  FROM jsonb_array_elements(identity.wikipedia_pages) page
  WHERE page->>'language' IN ('en', 'it') AND NULLIF(btrim(page->>'title'), '') IS NOT NULL
    AND (identity.wikidata_id IS NULL OR page->>'wikidataId' IS NULL
      OR page->>'wikidataId' = identity.wikidata_id)
  ORDER BY CASE page->>'language' WHEN 'en' THEN 0 ELSE 1 END
  LIMIT 1
), identity.name)`;

const generationSchema = z
  .object({
    provider: z.string().trim().min(1),
    model: z.string().trim().min(1),
    completedAt: z.iso.datetime(),
  })
  .strict();
export const wikipediaPageSchema = z
  .object({
    language: z.string().regex(/^[a-z][a-z0-9-]*$/),
    pageId: z.number().int().positive(),
    title: z.string().min(1),
    url: z.url(),
    wikidataId: z
      .string()
      .regex(/^Q[1-9]\d*$/)
      .optional(),
  })
  .strict();

export const personWriteSchema = z
  .object({
    profileVersion: z.uuid().toLowerCase(),
    wikidataId: z.string().regex(/^Q[1-9]\d*$/),
    person: publishedPersonSchema,
    generation: generationSchema,
  })
  .strict();

export const personUpdateSchema = personWriteSchema.extend({
  expectedProfileVersion: z.uuid().toLowerCase(),
});

const catalogPoiSchema = publishedPoiSummarySchema.omit({ city: true, categoryIds: true }).extend({
  wikidataId: z
    .string()
    .regex(/^Q[1-9]\d*$/)
    .optional(),
  osmIds: z.array(z.string().min(1)),
  wikipediaPages: z
    .array(wikipediaPageSchema)
    .refine(
      (pages) =>
        new Set(pages.map(({ language, pageId }) => `${language}:${pageId}`)).size === pages.length,
      { message: "Duplicate Wikipedia page identity." },
    ),
});

export const catalogBaselineSchema = z
  .object({
    city: publishedPoiSummarySchema.shape.city,
    revision: z.uuid().toLowerCase().nullable(),
    pois: z.array(catalogPoiSchema.extend({ inputRevision: z.uuid().toLowerCase() })),
  })
  .strict();

export const personBaselineSchema = z
  .object({
    personId: z.string().min(1),
    wikidataId: z.string().regex(/^Q[1-9]\d*$/),
    profileVersion: z.uuid().toLowerCase(),
  })
  .strict();

export const poiBaselineSchema = catalogPoiSchema
  .omit({ id: true, coordinates: true, osmIds: true })
  .extend({
    poiId: z.uuid().toLowerCase(),
    city: publishedPoiSummarySchema.shape.city,
    inputRevision: z.uuid().toLowerCase(),
    publicationId: z.uuid().toLowerCase().nullable(),
    relatedPeople: z.array(personBaselineSchema),
  });

export const storyWriteSchema = z
  .object({
    inputRevision: z.uuid().toLowerCase(),
    expectedPublicationId: z.uuid().toLowerCase().nullable(),
    detail: publishedPoiDetailSchema,
    generation: generationSchema,
    people: z.array(personWriteSchema),
  })
  .strict()
  .refine(
    ({ detail, people }) =>
      new Set(people.map(({ person }) => person.id)).size === people.length &&
      people.every(({ person }) =>
        detail.story.relatedPeople.some(({ personId }) => personId === person.id),
      ),
    { message: "Supplied profiles must uniquely belong to the Story's Related People." },
  );

export const catalogWriteSchema = z
  .object({
    city: publishedPoiSummarySchema.shape.city,
    revision: z.uuid().toLowerCase(),
    expectedRevision: z.uuid().toLowerCase().nullable(),
    pois: z.array(catalogPoiSchema),
  })
  .strict()
  .refine(({ pois }) => new Set(pois.map(({ id }) => id)).size === pois.length, {
    message: "Duplicate catalog POI ID.",
  });

export const poiCategoriesWriteSchema = z
  .object({
    poiId: z.uuid().toLowerCase(),
    inputRevision: z.uuid().toLowerCase(),
    revision: z.uuid().toLowerCase(),
    expectedRevision: z.uuid().toLowerCase().nullable(),
    expectedStateDigest: z.string().regex(/^[a-f0-9]{64}$/),
    categoryIds: publishedPoiSummarySchema.shape.categoryIds,
    definitions: z
      .array(publishedCategorySchema)
      .refine((categories) => new Set(categories.map(({ id }) => id)).size === categories.length, {
        message: "Duplicate category definition.",
      }),
  })
  .strict();

export const categoryCatalogCreateSchema = z
  .object({
    expectedStateDigest: z.string().regex(/^[a-f0-9]{64}$/),
    name: z
      .string()
      .refine(
        (name) =>
          name.trim().replace(/\s+/g, " ").length >= 1 &&
          name.trim().replace(/\s+/g, " ").length <= 80 &&
          !/[<>\r\n]/.test(name),
        { message: "Use a category name of 1–80 characters." },
      ),
  })
  .strict();

export const categoryCatalogRenameSchema = categoryCatalogCreateSchema.extend({
  id: publishedCategorySchema.shape.id,
});

export const categoryCatalogDeleteSchema = z
  .object({
    id: publishedCategorySchema.shape.id,
    expectedStateDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const categoryCatalogMoveSchema = z
  .object({
    id: publishedCategorySchema.shape.id,
    parentId: publishedCategorySchema.shape.id.nullable(),
    expectedStateDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const poiTypesAcquisitionSchema = z
  .object({
    wikidataId: z
      .string()
      .regex(/^Q[1-9]\d*$/)
      .nullable(),
    types: z
      .array(
        z.object({ id: z.string().regex(/^Q[1-9]\d*$/), label: z.string().trim().min(1) }).strict(),
      )
      .max(1000)
      .refine((types) => new Set(types.map(({ id }) => id)).size === types.length),
    skipped: z.boolean(),
    acquiredAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    ({ wikidataId, skipped, types }) =>
      wikidataId === null ? skipped && types.length === 0 : !skipped,
    { message: "Only POIs without Wikidata identity may skip acquisition." },
  );

export const poiTypesWriteSchema = z
  .object({
    poiId: z.uuid().toLowerCase(),
    inputRevision: z.uuid().toLowerCase(),
    revision: z.uuid().toLowerCase(),
    expectedRevision: z.uuid().toLowerCase().nullable(),
    acquisition: poiTypesAcquisitionSchema,
  })
  .strict();

export const poiTypesBaselineSchema = z
  .object({
    poiId: z.uuid().toLowerCase(),
    city: publishedPoiSummarySchema.shape.city,
    name: z.string().min(1),
    wikidataId: z
      .string()
      .regex(/^Q[1-9]\d*$/)
      .nullable(),
    wikipediaPages: z.array(wikipediaPageSchema),
    inputRevision: z.uuid().toLowerCase(),
    revision: z.uuid().toLowerCase().nullable(),
    acquisition: poiTypesAcquisitionSchema.nullable(),
  })
  .strict()
  .refine(
    (state) =>
      !state.acquisition ||
      (state.revision !== null && state.acquisition.wikidataId === state.wikidataId),
    { message: "Accepted acquisition does not match the POI identity or revision." },
  );

export const typeCategoryRuleSchema = z
  .object({
    typeId: z.string().regex(/^Q[1-9]\d*$/),
    decision: z.enum(["mapped", "ignored", "unmapped"]),
    categoryIds: publishedPoiSummarySchema.shape.categoryIds,
    origin: z.enum(["manual", "automatic", "initial"]),
    reason: z.string().optional(),
    revision: z.uuid().toLowerCase(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine(({ decision, categoryIds }) => (decision === "mapped") === Boolean(categoryIds.length));

export const typeCategoryRuleWriteSchema = z
  .object({
    typeId: typeCategoryRuleSchema.shape.typeId,
    categories: publishedPoiSummarySchema.shape.categoryIds.nullable(),
    revision: z.uuid().toLowerCase(),
    expectedStateDigest: z.string().regex(/^[a-f0-9]{64}$/),
    origin: z.literal("automatic").optional(),
    reason: z.string().trim().min(1).max(4000).optional(),
    definitions: z.array(publishedCategorySchema).max(20).optional(),
  })
  .strict()
  .refine((value) =>
    value.origin === "automatic"
      ? Boolean(value.reason)
      : value.reason === undefined && value.definitions === undefined,
  );

// One MVCC snapshot covers rules, definitions and affected-catalog inputs, even on a fresh install.
const typeRulesQuery = `SELECT
  COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'typeId', type_id, 'decision', decision, 'categoryIds', category_ids, 'origin', origin,
    'reason', reason, 'revision', revision, 'updatedAt', to_char(updated_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))) ORDER BY type_id COLLATE "C")
    FROM content.type_category_rules), '[]'::jsonb) AS rules,
  (SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', id, 'name', name, 'label', label, 'parentId', parent_id)) ORDER BY id COLLATE "C"),
    '[]'::jsonb) FROM content.categories) AS definitions,
  COALESCE((SELECT jsonb_agg(name ORDER BY name COLLATE "C") FROM content.deleted_category_names), '[]'::jsonb) AS "deletedNames",
  COALESCE((SELECT jsonb_agg(jsonb_build_array(city, revision) ORDER BY city COLLATE "C")
    FROM content.city_catalogs), '[]'::jsonb) AS catalogs,
  COALESCE((SELECT jsonb_agg(jsonb_build_array(p.id, p.input_revision, a.revision) ORDER BY p.id)
    FROM content.pois p LEFT JOIN content.poi_type_acquisitions a ON a.poi_id = p.id
    WHERE p.removed_at IS NULL), '[]'::jsonb) AS inputs`;

const poiTypesQuery = `SELECT p.id AS "poiId", p.city, p.name, p.wikidata_id AS "wikidataId",
  p.wikipedia_pages AS "wikipediaPages", p.input_revision AS "inputRevision", w.revision,
  CASE WHEN w.input_revision = p.input_revision AND w.acquisition->>'wikidataId' IS NOT DISTINCT FROM p.wikidata_id
    THEN w.acquisition ELSE NULL END AS acquisition
  FROM content.pois p LEFT JOIN content.poi_type_acquisitions w ON w.poi_id = p.id
  WHERE p.removed_at IS NULL`;

const categoryDefinitionsQuery = `SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id', id, 'name', name, 'label', label, 'parentId', parent_id)) ORDER BY id COLLATE "C"),
  '[]'::jsonb) AS definitions FROM content.categories`;

const poiCategoriesBaselineSchema = z.object({
  poiId: z.uuid().toLowerCase(),
  inputRevision: z.uuid().toLowerCase(),
  revision: z.uuid().toLowerCase().nullable(),
  categoryIds: publishedPoiSummarySchema.shape.categoryIds,
  definitions: z.array(publishedCategorySchema),
});

// One statement gives baseline callers one MVCC snapshot, even during concurrent writes.
const categoriesBaselineQuery = `SELECT p.id AS "poiId", p.input_revision AS "inputRevision",
  w.revision,
  COALESCE((SELECT jsonb_agg(category_id ORDER BY category_id COLLATE "C")
    FROM content.poi_categories WHERE poi_id = p.id), '[]'::jsonb) AS "categoryIds",
  COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', id, 'name', name, 'label', label, 'parentId', parent_id)) ORDER BY id COLLATE "C")
    FROM content.categories), '[]'::jsonb) AS definitions
  FROM content.pois p LEFT JOIN content.poi_category_writes w ON w.poi_id = p.id
  WHERE p.id = $1 AND p.removed_at IS NULL`;

export class ContentWriteError extends Error {
  constructor(
    readonly reason: "obsolete" | "conflict" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "ContentWriteError";
  }
}

const canonicalValue = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonicalValue)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonicalValue(item)]),
        )
      : value;
const digest = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
const sourceIdentities = (pages: Array<{ language: string; pageId: number }>) =>
  pages
    .map(({ language, pageId }) => ({ language, pageId }))
    .sort(
      (left, right) => left.language.localeCompare(right.language) || left.pageId - right.pageId,
    );

const transaction = async <T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
};

// Acquire this before POI/city row locks in every category, acquisition and catalog writer.
// This also serializes absent rules and definitions without per-process mutexes.
const lockCategories = (client: PoolClient) =>
  client.query("LOCK TABLE content.categories, content.poi_categories IN SHARE ROW EXCLUSIVE MODE");
const readTypeRules = async (client: Pick<Pool, "query"> | PoolClient) => {
  const {
    rows: [row],
  } = await client.query(typeRulesQuery);
  return {
    rules: z.array(typeCategoryRuleSchema).parse(row.rules),
    definitions: z.array(publishedCategorySchema).parse(row.definitions),
    deletedNames: z.array(z.string()).parse(row.deletedNames),
    stateDigest: digest(row),
  };
};
const recalculateTypeCategories = async (
  client: PoolClient,
  poiId: string,
  baseline: Awaited<ReturnType<typeof readTypeRules>>,
) => {
  const {
    rows: [poi],
  } = await client.query(`${poiTypesQuery} AND p.id = $1`, [poiId]);
  const acquisition = poi?.acquisition
    ? poiTypesAcquisitionSchema.parse(poi.acquisition)
    : undefined;
  const categoryIds = derivePoiCategories(
    acquisition?.types ?? [],
    Object.fromEntries(
      baseline.rules
        .filter(({ decision }) => decision === "mapped")
        .map(({ typeId, categoryIds }) => [typeId, categoryIds]),
    ),
    baseline.definitions.map(({ parentId, ...category }) => ({ ...category, parent: parentId })),
    poi.name,
  );
  // Preserve assignments outside the previous rule-derived set, including pre-activation assignments.
  await client.query(
    `DELETE FROM content.poi_categories c USING content.poi_type_category_assignments d
    WHERE c.poi_id = $1 AND d.poi_id = c.poi_id AND d.category_id = c.category_id`,
    [poiId],
  );
  await client.query("DELETE FROM content.poi_type_category_assignments WHERE poi_id = $1", [
    poiId,
  ]);
  for (const categoryId of categoryIds) {
    // A category already present outside the derived set remains independently assigned.
    const added = await client.query(
      `INSERT INTO content.poi_categories(poi_id, category_id) VALUES ($1,$2)
      ON CONFLICT DO NOTHING RETURNING category_id`,
      [poiId, categoryId],
    );
    if (added.rowCount)
      await client.query(
        "INSERT INTO content.poi_type_category_assignments(poi_id, category_id) VALUES ($1,$2)",
        [poiId, categoryId],
      );
  }
  // Advance even when the result is unchanged: old pending writes must not undo accepted inputs.
  await client.query(
    `INSERT INTO content.poi_category_writes(poi_id, revision, request_digest) VALUES ($1,$2,$3)
    ON CONFLICT (poi_id) DO UPDATE SET revision = EXCLUDED.revision, request_digest = EXCLUDED.request_digest`,
    [poiId, randomUUID(), digest({ categoryIds, stateDigest: baseline.stateDigest })],
  );
};

export const createPostgresContent = (pool: Pool) => ({
  synchronizeCatalog: async (value: unknown) => {
    const input = catalogWriteSchema.parse(value);
    const requestDigest = digest(input);
    return transaction(pool, async (client) => {
      await lockCategories(client);
      await client.query(
        "INSERT INTO content.city_catalogs(city) VALUES ($1) ON CONFLICT DO NOTHING",
        [input.city],
      );
      const {
        rows: [catalog],
      } = await client.query(
        "SELECT revision, request_digest FROM content.city_catalogs WHERE city = $1 FOR UPDATE",
        [input.city],
      );
      if (catalog.revision === input.revision) {
        if (catalog.request_digest !== requestDigest)
          throw new ContentWriteError("invalid", "Catalog revision reused for different content.");
        return "already-saved" as const;
      }
      if (catalog.revision !== input.expectedRevision)
        throw new ContentWriteError(
          "conflict",
          "Catalog has changed since this operation was prepared.",
        );
      const { rows: previous } = await client.query(
        "SELECT id, input_revision, input_digest, removed_at FROM content.pois WHERE city = $1 ORDER BY id FOR UPDATE",
        [input.city],
      );
      for (const poi of [...input.pois].sort((left, right) => left.id.localeCompare(right.id))) {
        const inputDigest = digest({
          name: poi.name,
          wikidataId: poi.wikidataId ?? null,
          pages: sourceIdentities(poi.wikipediaPages),
        });
        const existing = previous.find(({ id }) => id === poi.id);
        const result = await client.query(
          `INSERT INTO content.pois
          (id, city, name, latitude, longitude, wikidata_id, osm_ids, wikipedia_pages, input_revision, input_digest)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude, wikidata_id = EXCLUDED.wikidata_id, osm_ids = EXCLUDED.osm_ids,
            wikipedia_pages = EXCLUDED.wikipedia_pages, input_revision = EXCLUDED.input_revision,
            input_digest = EXCLUDED.input_digest, removed_at = NULL
          WHERE content.pois.city = EXCLUDED.city`,
          [
            poi.id,
            input.city,
            poi.name,
            poi.coordinates.lat,
            poi.coordinates.lng,
            poi.wikidataId ?? null,
            poi.osmIds,
            JSON.stringify(poi.wikipediaPages),
            existing && !existing.removed_at && existing.input_digest === inputDigest
              ? existing.input_revision
              : randomUUID(),
            inputDigest,
          ],
        );
        if (result.rowCount !== 1)
          throw new ContentWriteError("conflict", "POI identity already belongs to another city.");
      }
      const removed = previous
        .filter(({ id, removed_at }) => !removed_at && !input.pois.some((poi) => poi.id === id))
        .map(({ id }) => id);
      if (removed.length) {
        await client.query(
          "DELETE FROM content.poi_type_category_assignments WHERE poi_id = ANY($1::uuid[])",
          [removed],
        );
        await client.query(
          "DELETE FROM content.poi_category_writes WHERE poi_id = ANY($1::uuid[])",
          [removed],
        );
        const { rows: people } = await client.query(
          `SELECT id FROM content.people WHERE id IN
          (SELECT person_id FROM content.poi_people WHERE poi_id = ANY($1::uuid[])) ORDER BY id FOR UPDATE`,
          [removed],
        );
        await client.query("DELETE FROM content.published_stories WHERE poi_id = ANY($1::uuid[])", [
          removed,
        ]);
        await client.query("DELETE FROM content.poi_categories WHERE poi_id = ANY($1::uuid[])", [
          removed,
        ]);
        await client.query(
          "UPDATE content.pois SET removed_at = now(), input_revision = gen_random_uuid() WHERE id = ANY($1::uuid[])",
          [removed],
        );
        await client.query(
          `DELETE FROM content.people p WHERE id = ANY($1::text[])
          AND NOT EXISTS (SELECT FROM content.poi_people r WHERE r.person_id = p.id)`,
          [people.map(({ id }) => id)],
        );
      }
      await client.query(
        "UPDATE content.city_catalogs SET revision = $2, request_digest = $3 WHERE city = $1",
        [input.city, input.revision, requestDigest],
      );
      return "saved" as const;
    });
  },

  getPoiTypes: async (poiId: string) => {
    const {
      rows: [row],
    } = await pool.query(`${poiTypesQuery} AND p.id = $1`, [z.uuid().parse(poiId)]);
    return row ? poiTypesBaselineSchema.parse(row) : undefined;
  },

  getCityPoiTypes: async (city: string) => {
    const { rows } = await pool.query(`${poiTypesQuery} AND p.city = $1 ORDER BY p.id`, [
      publishedPoiSummarySchema.shape.city.parse(city),
    ]);
    return z.array(poiTypesBaselineSchema).parse(rows);
  },

  savePoiTypes: async (value: unknown) => {
    const input = poiTypesWriteSchema.parse(value);
    const requestDigest = digest(input);
    return transaction(pool, async (client) => {
      await lockCategories(client);
      const {
        rows: [poi],
      } = await client.query(
        "SELECT input_revision, wikidata_id, removed_at FROM content.pois WHERE id = $1 FOR UPDATE",
        [input.poiId],
      );
      if (
        !poi ||
        poi.removed_at ||
        poi.input_revision !== input.inputRevision ||
        poi.wikidata_id !== input.acquisition.wikidataId
      )
        throw new ContentWriteError("obsolete", "POI removed or acquisition inputs changed.");
      const {
        rows: [current],
      } = await client.query(
        "SELECT revision, request_digest FROM content.poi_type_acquisitions WHERE poi_id = $1",
        [input.poiId],
      );
      if (current?.revision === input.revision) {
        if (current.request_digest !== requestDigest)
          throw new ContentWriteError(
            "invalid",
            "Acquisition revision reused for different content.",
          );
        return { status: "already-saved" as const, revision: input.revision };
      }
      if ((current?.revision ?? null) !== input.expectedRevision)
        throw new ContentWriteError(
          "conflict",
          "The accepted acquisition changed. Reload before refreshing types.",
        );
      await client.query(
        `INSERT INTO content.poi_type_acquisitions(poi_id, input_revision, revision, request_digest, acquisition)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (poi_id) DO UPDATE SET
        input_revision = EXCLUDED.input_revision, revision = EXCLUDED.revision,
        request_digest = EXCLUDED.request_digest, acquisition = EXCLUDED.acquisition`,
        [input.poiId, input.inputRevision, input.revision, requestDigest, input.acquisition],
      );
      const rules = await readTypeRules(client);
      if (rules.rules.length) await recalculateTypeCategories(client, input.poiId, rules);
      return { status: "saved" as const, revision: input.revision };
    });
  },

  getTypeCategoryRules: () => readTypeRules(pool),

  saveTypeCategoryRule: async (value: unknown) => {
    const input = typeCategoryRuleWriteSchema.parse(value);
    return transaction(pool, async (client) => {
      await lockCategories(client);
      const baseline = await readTypeRules(client);
      if (baseline.rules.some((rule) => rule.revision === input.revision))
        throw new ContentWriteError(
          "invalid",
          "Rule revision already used. Reload accepted state before editing.",
        );
      if (baseline.stateDigest !== input.expectedStateDigest)
        throw new ContentWriteError(
          "conflict",
          "Rules, category definitions or catalog inputs changed.",
        );
      const existing = baseline.rules.find(({ typeId }) => typeId === input.typeId);
      if (
        input.origin === "automatic" &&
        existing &&
        (existing.origin === "manual" || existing.decision !== "unmapped")
      )
        throw new ContentWriteError(
          "conflict",
          "Automatic classification cannot replace an accepted decision.",
        );
      for (const definition of input.definitions ?? []) {
        const name = definition.name.trim().replace(/\s+/g, " ");
        if (
          definition.id !== name ||
          definition.parentId ||
          definition.label ||
          !name ||
          name.length > 80 ||
          /[<>\r\n]/.test(definition.name) ||
          baseline.deletedNames.some((deleted) => deleted.toLowerCase() === name.toLowerCase()) ||
          baseline.definitions.some(
            (category) =>
              category.id === name || category.name.toLowerCase() === name.toLowerCase(),
          )
        )
          throw new ContentWriteError("invalid", "Invalid or duplicate automatic category.");
        await client.query("INSERT INTO content.categories(id, name) VALUES ($1,$1)", [name]);
        baseline.definitions.push({ id: name, name });
      }
      if (
        input.categories?.some((id) => !baseline.definitions.some((category) => category.id === id))
      )
        throw new ContentWriteError("invalid", "Unknown rule category.");
      const { rows: affected } = await client.query(
        `SELECT p.id FROM content.pois p
        JOIN content.poi_type_acquisitions a ON a.poi_id = p.id AND a.input_revision = p.input_revision
        WHERE p.removed_at IS NULL AND a.acquisition->>'wikidataId' IS NOT DISTINCT FROM p.wikidata_id
          AND a.acquisition->'types' @> $1::jsonb ORDER BY p.id FOR UPDATE OF p`,
        [JSON.stringify([{ id: input.typeId }])],
      );
      // Existing rules may still be edited after the last occurrence disappears from the catalog.
      if (!affected.length && !baseline.rules.some(({ typeId }) => typeId === input.typeId))
        throw new ContentWriteError("invalid", "This type has no accepted acquisition or rule.");
      const categoryIds =
        input.categories === null
          ? []
          : expandCategorySelection(
              input.categories,
              baseline.definitions.map(({ parentId, ...category }) => ({
                ...category,
                parent: parentId,
              })),
            );
      await client.query(
        `INSERT INTO content.type_category_rules(type_id, decision, category_ids, origin, revision, reason)
        VALUES ($1,$2,$3,$5,$4,$6) ON CONFLICT (type_id) DO UPDATE SET decision = EXCLUDED.decision,
        category_ids = EXCLUDED.category_ids, origin = EXCLUDED.origin, reason = EXCLUDED.reason,
        revision = EXCLUDED.revision, updated_at = now()`,
        [
          input.typeId,
          input.categories === null ? "unmapped" : categoryIds.length ? "mapped" : "ignored",
          JSON.stringify(categoryIds),
          input.revision,
          input.origin ?? "manual",
          input.reason ?? null,
        ],
      );
      const accepted = await readTypeRules(client);
      for (const { id } of affected) await recalculateTypeCategories(client, id, accepted);
      return { status: "saved" as const, revision: input.revision, affectedPois: affected.length };
    });
  },

  getCategoryCatalog: async () => {
    const {
      rows: [row],
    } = await pool.query(categoryDefinitionsQuery);
    const definitions = z.array(publishedCategorySchema).parse(row.definitions);
    return { definitions, stateDigest: digest(definitions) };
  },

  createCategory: async (value: unknown) => {
    const input = categoryCatalogCreateSchema.parse(value);
    const name = input.name.trim().replace(/\s+/g, " ");
    return transaction(pool, async (client) => {
      // Match per-POI writes, including insertions of previously absent definitions.
      await lockCategories(client);
      const {
        rows: [row],
      } = await client.query(categoryDefinitionsQuery);
      const definitions = z.array(publishedCategorySchema).parse(row.definitions);
      if (digest(definitions) !== input.expectedStateDigest)
        throw new ContentWriteError(
          "conflict",
          "The category catalog changed. Reload before creating a category.",
        );
      if (
        definitions.some(
          (category) => category.id === name || category.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new ContentWriteError("invalid", "A category with this name or ID already exists.");
      await client.query("INSERT INTO content.categories(id, name) VALUES ($1,$1)", [name]);
      return { status: "saved" as const, definition: { id: name, name } };
    });
  },

  renameCategory: async (value: unknown) => {
    const input = categoryCatalogRenameSchema.parse(value);
    const name = input.name.trim().replace(/\s+/g, " ");
    return transaction(pool, async (client) => {
      await lockCategories(client);
      const {
        rows: [row],
      } = await client.query(categoryDefinitionsQuery);
      const definitions = z.array(publishedCategorySchema).parse(row.definitions);
      if (digest(definitions) !== input.expectedStateDigest)
        throw new ContentWriteError(
          "conflict",
          "The category catalog changed. Reload before renaming a category.",
        );
      const category = definitions.find(({ id }) => id === input.id);
      if (!category) throw new ContentWriteError("invalid", "Category not found.");
      if (
        definitions.some(
          (category) =>
            category.id !== input.id && category.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new ContentWriteError("invalid", "A category with this name already exists.");
      await client.query("UPDATE content.categories SET name = $2, label = $2 WHERE id = $1", [
        input.id,
        name,
      ]);
      return { status: "saved" as const, definition: { ...category, name, label: name } };
    });
  },

  moveCategory: async (value: unknown) => {
    const input = categoryCatalogMoveSchema.parse(value);
    return transaction(pool, async (client) => {
      await lockCategories(client);
      const baseline = await readTypeRules(client);
      if (digest(baseline.definitions) !== input.expectedStateDigest)
        throw new ContentWriteError(
          "conflict",
          "The category catalog changed. Reload before moving a category.",
        );
      const category = baseline.definitions.find(({ id }) => id === input.id);
      if (!category) throw new ContentWriteError("invalid", "Category not found.");
      if (input.parentId === input.id)
        throw new ContentWriteError("invalid", "A category cannot contain itself.");
      if (input.parentId !== null) {
        const target = baseline.definitions.find(({ id }) => id === input.parentId);
        if (!target) throw new ContentWriteError("invalid", "Parent category not found.");
        if (target.parentId || baseline.definitions.some(({ parentId }) => parentId === input.id))
          throw new ContentWriteError("invalid", "Only two category levels are supported.");
      }
      const definition = { ...category, parentId: input.parentId ?? undefined };
      if ((category.parentId ?? null) === input.parentId)
        return { status: "saved" as const, definition };
      const previousDefinitions = baseline.definitions.map(({ parentId, ...entry }) => ({
        ...entry,
        parent: parentId,
      }));
      // Preserve selected children, and retain the previous parent only when a sibling remains.
      const moveSelection = (selected: string[]) => [
        ...new Set([
          ...selected.filter(
            (id) =>
              id !== category.parentId ||
              baseline.definitions.some(
                (child) =>
                  child.id !== input.id &&
                  child.parentId === category.parentId &&
                  selected.includes(child.id),
              ),
          ),
          ...(input.parentId ? [input.parentId] : []),
        ]),
      ];
      await client.query("UPDATE content.categories SET parent_id = $2 WHERE id = $1", [
        input.id,
        input.parentId,
      ]);
      for (const rule of baseline.rules) {
        const selected = expandCategorySelection(rule.categoryIds, previousDefinitions);
        if (!selected.includes(input.id)) continue;
        await client.query(
          `UPDATE content.type_category_rules SET category_ids = $2, origin = 'manual',
          reason = NULL, revision = $3, updated_at = now() WHERE type_id = $1`,
          [rule.typeId, JSON.stringify(moveSelection(selected)), randomUUID()],
        );
      }
      const { rows: affected } = await client.query<{ id: string }>(
        `SELECT p.id FROM content.pois p
        WHERE EXISTS (SELECT FROM content.poi_categories c WHERE c.poi_id = p.id AND c.category_id = $1)
        ORDER BY p.id FOR UPDATE`,
        [input.id],
      );
      for (const { id } of affected) {
        const { rows: assignments } = await client.query<{ category_id: string; derived: boolean }>(
          `SELECT c.category_id, d.poi_id IS NOT NULL AS derived FROM content.poi_categories c
          LEFT JOIN content.poi_type_category_assignments d USING (poi_id, category_id)
          WHERE c.poi_id = $1 ORDER BY c.category_id COLLATE "C"`,
          [id],
        );
        // Persisted POI memberships are explicit; do not expand a parent into new siblings.
        const selected = assignments.map(({ category_id }) => category_id);
        const categoryIds = moveSelection(selected);
        for (const removed of selected.filter((value) => !categoryIds.includes(value))) {
          await client.query(
            "DELETE FROM content.poi_type_category_assignments WHERE poi_id = $1 AND category_id = $2",
            [id, removed],
          );
          await client.query(
            "DELETE FROM content.poi_categories WHERE poi_id = $1 AND category_id = $2",
            [id, removed],
          );
        }
        for (const added of categoryIds.filter((value) => !selected.includes(value))) {
          await client.query(
            "INSERT INTO content.poi_categories(poi_id, category_id) VALUES ($1,$2)",
            [id, added],
          );
          // A newly implied parent follows the moved child's ownership. Existing independent
          // assignments remain independent; this operation does not reconcile legacy provenance.
          if (assignments.some((entry) => entry.category_id === input.id && entry.derived))
            await client.query(
              "INSERT INTO content.poi_type_category_assignments(poi_id, category_id) VALUES ($1,$2)",
              [id, added],
            );
        }
        await client.query(
          `INSERT INTO content.poi_category_writes(poi_id, revision, request_digest) VALUES ($1,$2,$3)
          ON CONFLICT (poi_id) DO UPDATE SET revision = EXCLUDED.revision, request_digest = EXCLUDED.request_digest`,
          [id, randomUUID(), digest({ categoryIds, move: input })],
        );
      }
      // A rule selecting only the destination parent also gains its new child under
      // the existing parent-selection semantics. Recalculate only acquisitions whose
      // rule scope changed, preserving independent assignments through the usual writer.
      const accepted = await readTypeRules(client);
      const definitions = accepted.definitions.map(({ parentId, ...entry }) => ({
        ...entry,
        parent: parentId,
      }));
      const changedTypes = baseline.rules
        .filter((rule) => {
          const next = accepted.rules.find(({ typeId }) => typeId === rule.typeId)!;
          return (
            JSON.stringify(
              expandCategorySelection(rule.categoryIds, previousDefinitions).sort(),
            ) !== JSON.stringify(expandCategorySelection(next.categoryIds, definitions).sort())
          );
        })
        .map(({ typeId }) => typeId);
      if (changedTypes.length) {
        const { rows } = await client.query<{ id: string }>(
          `SELECT p.id FROM content.pois p
          JOIN content.poi_type_acquisitions a ON a.poi_id = p.id AND a.input_revision = p.input_revision
          WHERE p.removed_at IS NULL AND a.acquisition->>'wikidataId' IS NOT DISTINCT FROM p.wikidata_id
          AND EXISTS (SELECT FROM jsonb_array_elements(a.acquisition->'types') t WHERE t->>'id' = ANY($1::text[]))
          ORDER BY p.id FOR UPDATE OF p`,
          [changedTypes],
        );
        for (const { id } of rows) await recalculateTypeCategories(client, id, accepted);
      }
      return { status: "saved" as const, definition };
    });
  },

  deleteCategory: async (value: unknown) => {
    const input = categoryCatalogDeleteSchema.parse(value);
    return transaction(pool, async (client) => {
      await lockCategories(client);
      const baseline = await readTypeRules(client);
      if (digest(baseline.definitions) !== input.expectedStateDigest)
        throw new ContentWriteError(
          "conflict",
          "The category catalog changed. Reload before deleting a category.",
        );
      if (!baseline.definitions.some(({ id }) => id === input.id))
        throw new ContentWriteError("invalid", "Category not found.");
      const removed = baseline.definitions.filter(
        ({ id, parentId }) => id === input.id || parentId === input.id,
      );
      const ids = removed.map(({ id }) => id);
      const definitions = baseline.definitions.map(({ parentId, ...entry }) => ({
        ...entry,
        parent: parentId,
      }));
      for (const rule of baseline.rules) {
        const selected = expandCategorySelection(rule.categoryIds, definitions);
        if (!selected.some((id) => ids.includes(id))) continue;
        const remaining = selected.filter(
          (id) =>
            !ids.includes(id) &&
            !removed.some(
              (child) =>
                child.parentId === id &&
                selected.includes(child.id) &&
                !baseline.definitions.some(
                  (sibling) =>
                    !ids.includes(sibling.id) &&
                    sibling.parentId === id &&
                    selected.includes(sibling.id),
                ),
            ),
        );
        await client.query(
          `UPDATE content.type_category_rules SET category_ids = $2,
          decision = $3, origin = 'manual', reason = NULL, revision = $4, updated_at = now() WHERE type_id = $1`,
          [
            rule.typeId,
            JSON.stringify(remaining),
            remaining.length ? "mapped" : "unmapped",
            randomUUID(),
          ],
        );
      }
      const { rows: affected } = await client.query<{ id: string }>(
        `SELECT p.id FROM content.pois p
        WHERE EXISTS (SELECT FROM content.poi_categories c WHERE c.poi_id = p.id AND c.category_id = ANY($1::text[]))
        ORDER BY p.id FOR UPDATE`,
        [ids],
      );
      for (const { id } of affected) {
        const { rows: assignments } = await client.query<{ category_id: string; derived: boolean }>(
          `SELECT c.category_id, d.poi_id IS NOT NULL AS derived FROM content.poi_categories c
          LEFT JOIN content.poi_type_category_assignments d USING (poi_id, category_id) WHERE c.poi_id = $1`,
          [id],
        );
        const categoryIds = assignments
          .filter(
            (entry) =>
              !ids.includes(entry.category_id) &&
              !(
                entry.derived &&
                removed.some(
                  (child) =>
                    child.parentId === entry.category_id &&
                    assignments.some((assigned) => assigned.category_id === child.id) &&
                    !baseline.definitions.some(
                      (sibling) =>
                        !ids.includes(sibling.id) &&
                        sibling.parentId === entry.category_id &&
                        assignments.some((assigned) => assigned.category_id === sibling.id),
                    ),
                )
              ),
          )
          .map(({ category_id }) => category_id);
        const deleted = assignments
          .filter(({ category_id }) => !categoryIds.includes(category_id))
          .map(({ category_id }) => category_id);
        await client.query(
          "DELETE FROM content.poi_type_category_assignments WHERE poi_id = $1 AND category_id = ANY($2::text[])",
          [id, deleted],
        );
        await client.query(
          "DELETE FROM content.poi_categories WHERE poi_id = $1 AND category_id = ANY($2::text[])",
          [id, deleted],
        );
        await client.query(
          `INSERT INTO content.poi_category_writes(poi_id, revision, request_digest) VALUES ($1,$2,$3)
          ON CONFLICT (poi_id) DO UPDATE SET revision = EXCLUDED.revision, request_digest = EXCLUDED.request_digest`,
          [id, randomUUID(), digest({ categoryIds, delete: input })],
        );
      }
      for (const category of removed)
        for (const name of [
          category.id,
          category.name,
          ...(category.label ? [category.label] : []),
        ])
          await client.query(
            "INSERT INTO content.deleted_category_names(name) VALUES ($1) ON CONFLICT DO NOTHING",
            [name],
          );
      await client.query("DELETE FROM content.categories WHERE id = ANY($1::text[])", [ids]);
      const accepted = await readTypeRules(client);
      const changedTypes = baseline.rules
        .filter(
          (rule) =>
            accepted.rules.find(({ typeId }) => typeId === rule.typeId)?.revision !== rule.revision,
        )
        .map(({ typeId }) => typeId);
      if (changedTypes.length) {
        const { rows } = await client.query<{ id: string }>(
          `SELECT p.id FROM content.pois p
          JOIN content.poi_type_acquisitions a ON a.poi_id = p.id AND a.input_revision = p.input_revision
          WHERE p.removed_at IS NULL AND a.acquisition->>'wikidataId' IS NOT DISTINCT FROM p.wikidata_id
          AND EXISTS (SELECT FROM jsonb_array_elements(a.acquisition->'types') t WHERE t->>'id' = ANY($1::text[]))
          ORDER BY p.id FOR UPDATE OF p`,
          [changedTypes],
        );
        for (const { id } of rows) await recalculateTypeCategories(client, id, accepted);
      }
      return { status: "saved" as const, deletedIds: ids };
    });
  },

  getPoiCategoriesBaseline: async (poiId: string) => {
    const {
      rows: [row],
    } = await pool.query(categoriesBaselineQuery, [z.uuid().toLowerCase().parse(poiId)]);
    if (!row) return undefined;
    const baseline = poiCategoriesBaselineSchema.parse(row);
    return { ...baseline, stateDigest: digest(baseline) };
  },

  savePoiCategories: async (value: unknown) => {
    const input = poiCategoriesWriteSchema.parse(value);
    const requestDigest = digest(input);
    return transaction(pool, async (client) => {
      await lockCategories(client);
      const {
        rows: [poi],
      } = await client.query(
        "SELECT input_revision, removed_at FROM content.pois WHERE id = $1 FOR UPDATE",
        [input.poiId],
      );
      if (!poi || poi.removed_at || poi.input_revision !== input.inputRevision)
        throw new ContentWriteError("obsolete", "POI removed or classification inputs changed.");
      const {
        rows: [current],
      } = await client.query(
        "SELECT revision, request_digest FROM content.poi_category_writes WHERE poi_id = $1",
        [input.poiId],
      );
      if (current?.revision === input.revision) {
        if (current.request_digest !== requestDigest)
          throw new ContentWriteError("invalid", "Category revision reused for different content.");
        return { status: "already-saved" as const, revision: input.revision };
      }
      if ((current?.revision ?? null) !== input.expectedRevision)
        throw new ContentWriteError("conflict", "POI categories have changed.");
      const {
        rows: [row],
      } = await client.query(categoriesBaselineQuery, [input.poiId]);
      const baseline = poiCategoriesBaselineSchema.parse(row);
      if (digest(baseline) !== input.expectedStateDigest)
        throw new ContentWriteError(
          "conflict",
          "Category definitions or assignments have changed.",
        );
      const {
        rows: [types],
      } = await client.query(`${poiTypesQuery} AND p.id = $1`, [input.poiId]);
      if (types?.acquisition)
        throw new ContentWriteError(
          "conflict",
          "Accepted acquisitions use online rules. Legacy category replacements cannot override them.",
        );
      const definitions = new Map(baseline.definitions.map((category) => [category.id, category]));
      const { rows: deleted } = await client.query<{ name: string }>(
        "SELECT name FROM content.deleted_category_names",
      );
      for (const category of input.definitions) {
        if (
          !baseline.definitions.some(({ id }) => id === category.id) &&
          deleted.some(({ name }) => name.toLowerCase() === category.id.toLowerCase())
        )
          throw new ContentWriteError(
            "conflict",
            "Deleted categories cannot be restored by an assignment request.",
          );
        const existing = definitions.get(category.id);
        if (existing && digest(existing) !== digest(category))
          throw new ContentWriteError(
            "conflict",
            "Existing category definitions cannot be replaced here.",
          );
        definitions.set(category.id, category);
      }
      if (input.categoryIds.some((id) => !definitions.has(id)))
        throw new ContentWriteError("invalid", "Unknown assigned category.");
      for (const category of definitions.values()) {
        const visited = new Set([category.id]);
        let parentId = category.parentId;
        while (parentId) {
          if (!definitions.has(parentId) || visited.has(parentId))
            throw new ContentWriteError("invalid", "Missing category parent or hierarchy cycle.");
          visited.add(parentId);
          parentId = definitions.get(parentId)?.parentId;
        }
      }
      for (const category of input.definitions)
        await client.query(
          "INSERT INTO content.categories(id, name, label, parent_id) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
          [category.id, category.name, category.label ?? null, category.parentId ?? null],
        );
      await client.query("DELETE FROM content.poi_categories WHERE poi_id = $1", [input.poiId]);
      for (const categoryId of input.categoryIds)
        await client.query(
          "INSERT INTO content.poi_categories(poi_id, category_id) VALUES ($1,$2)",
          [input.poiId, categoryId],
        );
      await client.query(
        `INSERT INTO content.poi_category_writes(poi_id, revision, request_digest) VALUES ($1,$2,$3)
        ON CONFLICT (poi_id) DO UPDATE SET revision = EXCLUDED.revision, request_digest = EXCLUDED.request_digest`,
        [input.poiId, input.revision, requestDigest],
      );
      return { status: "saved" as const, revision: input.revision };
    });
  },

  saveStory: async (value: unknown) => {
    const input = storyWriteSchema.parse(value);
    const requestDigest = digest(input);
    return transaction(pool, async (client) => {
      const {
        rows: [poi],
      } = await client.query("SELECT * FROM content.pois WHERE id = $1 FOR UPDATE", [
        input.detail.id,
      ]);
      if (
        !poi ||
        poi.removed_at ||
        poi.input_revision !== input.inputRevision ||
        poi.city !== input.detail.city ||
        poi.name !== input.detail.name
      )
        throw new ContentWriteError("obsolete", "POI removed or generation inputs changed.");
      if (
        digest(sourceIdentities(input.detail.sources)) !==
        digest(sourceIdentities(poi.wikipedia_pages))
      )
        throw new ContentWriteError(
          "invalid",
          "Publication Sources do not match the catalog's Wikipedia page identities.",
        );
      const {
        rows: [current],
      } = await client.query(
        "SELECT publication_id, request_digest FROM content.published_stories WHERE poi_id = $1",
        [poi.id],
      );
      if (current?.publication_id === input.detail.publicationId) {
        if (current.request_digest !== requestDigest)
          throw new ContentWriteError("invalid", "Publication ID reused for different content.");
        return "already-saved" as const;
      }
      if ((current?.publication_id ?? null) !== input.expectedPublicationId)
        throw new ContentWriteError(
          "conflict",
          "A newer Story or image selection is already published.",
        );
      for (const reference of [...input.detail.story.relatedPeople].sort((left, right) =>
        left.personId.localeCompare(right.personId),
      )) {
        const candidate = input.people.find(({ person }) => person.id === reference.personId);
        if (candidate) {
          await client.query(
            `INSERT INTO content.people
            (id, wikidata_id, profile_version, name, content, sources, generation, request_digest)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [
              candidate.person.id,
              candidate.wikidataId,
              candidate.profileVersion,
              candidate.person.name,
              JSON.stringify(candidate.person.content),
              JSON.stringify(candidate.person.sources),
              JSON.stringify(candidate.generation),
              digest(candidate),
            ],
          );
        }
        const {
          rows: [person],
        } = await client.query(
          "SELECT id, wikidata_id FROM content.people WHERE id = $1 FOR UPDATE",
          [reference.personId],
        );
        if (!person)
          throw new ContentWriteError("invalid", `Missing Person Profile ${reference.personId}.`);
        if (candidate && person.wikidata_id !== candidate.wikidataId)
          throw new ContentWriteError(
            "conflict",
            "Person identity does not match its saved profile.",
          );
      }
      const { relatedPeople, ...content } = input.detail.story;
      await client.query(
        `INSERT INTO content.published_stories
        (poi_id, publication_id, name, input_revision, content, sources, gallery, main_image_id, generation, request_digest)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (poi_id) DO UPDATE SET publication_id = EXCLUDED.publication_id, name = EXCLUDED.name,
          input_revision = EXCLUDED.input_revision, content = EXCLUDED.content, sources = EXCLUDED.sources,
          gallery = EXCLUDED.gallery, main_image_id = EXCLUDED.main_image_id, generation = EXCLUDED.generation,
          request_digest = EXCLUDED.request_digest, published_at = now()`,
        [
          poi.id,
          input.detail.publicationId,
          input.detail.name,
          input.inputRevision,
          JSON.stringify(content),
          JSON.stringify(input.detail.sources),
          JSON.stringify(input.detail.gallery),
          input.detail.mainImageId,
          JSON.stringify({
            ...input.generation,
            inputs: {
              poiId: poi.id,
              city: poi.city,
              name: poi.name,
              wikidataId: poi.wikidata_id,
              wikipediaPages: sourceIdentities(poi.wikipedia_pages),
              inputRevision: poi.input_revision,
            },
          }),
          requestDigest,
        ],
      );
      await client.query("DELETE FROM content.poi_people WHERE poi_id = $1", [poi.id]);
      for (const [position, person] of relatedPeople.entries())
        await client.query(
          "INSERT INTO content.poi_people(poi_id, person_id, name, position, source_ids) VALUES ($1,$2,$3,$4,$5)",
          [poi.id, person.personId, person.name, position, person.sourceIds],
        );
      return "saved" as const;
    });
  },

  savePerson: async (value: unknown) => {
    const input = personUpdateSchema.parse(value);
    const requestDigest = digest(input);
    return transaction(pool, async (client) => {
      const {
        rows: [person],
      } = await client.query("SELECT * FROM content.people WHERE id = $1 FOR UPDATE", [
        input.person.id,
      ]);
      if (!person) throw new ContentWriteError("obsolete", "Person Profile was removed.");
      if (person.wikidata_id !== input.wikidataId)
        throw new ContentWriteError("conflict", "Person Wikidata identity changed.");
      if (person.profile_version === input.profileVersion) {
        if (person.request_digest !== requestDigest)
          throw new ContentWriteError("invalid", "Person version reused for different content.");
        return "already-saved" as const;
      }
      if (person.profile_version !== input.expectedProfileVersion)
        throw new ContentWriteError("conflict", "A newer Person Profile is already saved.");
      await client.query(
        `UPDATE content.people SET profile_version = $2, name = $3, content = $4,
        sources = $5, generation = $6, request_digest = $7, updated_at = now() WHERE id = $1`,
        [
          input.person.id,
          input.profileVersion,
          input.person.name,
          JSON.stringify(input.person.content),
          JSON.stringify(input.person.sources),
          JSON.stringify(input.generation),
          requestDigest,
        ],
      );
      return "saved" as const;
    });
  },

  getCatalogBaseline: async (city: string) => {
    const {
      rows: [result],
    } = await pool.query(
      `SELECT
      (SELECT revision FROM content.city_catalogs WHERE city = $1) AS revision,
      COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', id, 'name', name, 'coordinates', jsonb_build_object('lat', latitude, 'lng', longitude),
        'wikidataId', wikidata_id, 'osmIds', osm_ids, 'wikipediaPages', wikipedia_pages,
        'inputRevision', input_revision)) ORDER BY id)
        FROM content.pois WHERE city = $1 AND removed_at IS NULL), '[]'::jsonb) AS pois`,
      [publishedPoiSummarySchema.shape.city.parse(city)],
    );
    return catalogBaselineSchema.parse({ city, ...result });
  },

  getPoiBaseline: async (poiId: string) => {
    const {
      rows: [result],
    } = await pool.query(
      `SELECT
      jsonb_strip_nulls(jsonb_build_object('poiId', p.id, 'city', p.city, 'name', p.name,
        'wikidataId', p.wikidata_id, 'wikipediaPages', p.wikipedia_pages, 'inputRevision', p.input_revision))
      || jsonb_build_object('publicationId', s.publication_id, 'relatedPeople',
        COALESCE((SELECT jsonb_agg(jsonb_build_object('personId', r.person_id,
          'wikidataId', person.wikidata_id, 'profileVersion', person.profile_version) ORDER BY r.position)
          FROM content.poi_people r JOIN content.people person ON person.id = r.person_id
          WHERE r.poi_id = p.id), '[]'::jsonb)) AS response
      FROM content.pois p LEFT JOIN content.published_stories s ON s.poi_id = p.id
      WHERE p.id = $1 AND p.removed_at IS NULL`,
      [z.uuid().toLowerCase().parse(poiId)],
    );
    return result ? poiBaselineSchema.parse(result.response) : undefined;
  },

  getPersonBaseline: async (personId: string) => {
    const {
      rows: [result],
    } = await pool.query(
      `SELECT id AS "personId", wikidata_id AS "wikidataId",
      profile_version AS "profileVersion" FROM content.people WHERE id = $1`,
      [personId],
    );
    return result ? personBaselineSchema.parse(result) : undefined;
  },

  getCity: async (city: string) => {
    const {
      rows: [result],
    } = await pool.query(
      `SELECT
      COALESCE((SELECT jsonb_agg(p.response || jsonb_build_object('name', ${poiDisplayNameSql}) ORDER BY p.id)
        FROM content.visitor_pois p JOIN content.pois identity ON identity.id = p.id
        WHERE p.city = $1), '[]'::jsonb) AS pois,
      COALESCE((SELECT jsonb_agg(response ORDER BY id) FROM content.visitor_categories), '[]'::jsonb) AS categories`,
      [publishedPoiSummarySchema.shape.city.parse(city)],
    );
    return publishedCityMapSchema.parse({
      city,
      pois: result.pois,
      categoryDefinitions: result.categories,
    });
  },
  getCityPreviews: async (city: string) => {
    const {
      rows: [result],
    } = await pool.query(
      `SELECT
      COALESCE((SELECT jsonb_agg(p.response || jsonb_build_object(
        'wikidataId', identity.wikidata_id,
        'name', ${poiDisplayNameSql},
        'introduction', s.response #>> '{story,introduction,text}',
        'mainImage', (SELECT image FROM jsonb_array_elements(s.response->'gallery') image
          WHERE image->>'id' = s.response->>'mainImageId')
      ) ORDER BY p.id)
      FROM content.visitor_pois p JOIN content.visitor_stories s ON s.id = p.id
      JOIN content.pois identity ON identity.id = p.id
      WHERE p.city = $1), '[]'::jsonb) AS pois,
      COALESCE((SELECT jsonb_agg(response ORDER BY id) FROM content.visitor_categories), '[]'::jsonb) AS categories,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'wikidataId', wikidata_id) ORDER BY id)
        FROM content.pois WHERE city = $1 AND removed_at IS NOT NULL), '[]'::jsonb) AS removed`,
      [publishedPoiSummarySchema.shape.city.parse(city)],
    );
    return publishedCityPreviewSchema.parse({
      city,
      pois: result.pois,
      categoryDefinitions: result.categories,
      removedPois: result.removed,
    });
  },
  getStory: async (poiId: string) => {
    const {
      rows: [result],
    } = await pool.query(
      `SELECT p.response || jsonb_build_object('name', ${poiDisplayNameSql}) AS response
       FROM content.visitor_stories p JOIN content.pois identity ON identity.id = p.id
       WHERE p.id = $1`,
      [z.uuid().parse(poiId)],
    );
    return result ? publishedPoiDetailSchema.parse(result.response) : undefined;
  },
  getPerson: async (personId: string) => {
    const {
      rows: [result],
    } = await pool.query("SELECT response FROM content.visitor_people WHERE id = $1", [personId]);
    return result ? publishedPersonSchema.parse(result.response) : undefined;
  },
});

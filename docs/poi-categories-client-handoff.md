# Private admin: POI category persistence handoff

Implement the client integration in `mira-admin`, starting from `src/admin/categories.ts` and `src/admin/categoryInterpretation.ts`. The public server implementation is in `mira-explorer`, branch `feat/poi-category-api`.

Public server verification: 56 content API and cache tests passed, along with TypeScript, lint on the changed source files, and release validation. The 27 PostgreSQL integration tests remain unverified because Docker was unavailable and the local Docker application could not start. No deployment, online schema change or online database write has been performed. Complete isolated database verification with `pnpm test:content-database` before enabling the client. This handoff does not authorize online operations.

The following is the complete additive v1 contract and implementation checklist. The original API conventions remain documented in [Admin content API](admin-content-api.md).

## Contract

This extension adds two authenticated endpoints. Existing catalog, Story and Person bodies/responses are unchanged; `saveStory` continues to ignore `detail.categoryIds` for persistence. It does not require a published Story and does not publish an unpublished POI. It never changes coordinates, Story content/version/timestamps, People, images or other POIs' associations. Existing definitions remain shared across cities.

### Baseline: `GET /pois/{poiId}/categories-baseline`

Returns HTTP 200 with this strict shape (example identifiers/digests are illustrative):

```json
{
  "poiId": "728cbdf6-2449-4991-99b0-75204603eaa0",
  "inputRevision": "8c798cde-620e-4aaa-94c3-505df77c5c57",
  "revision": null,
  "stateDigest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "categoryIds": [],
  "definitions": []
}
```

- `poiId`: normalized lowercase UUID of an active catalog POI. Missing/removed POIs return `404 not-found`.
- `inputRevision`: server-issued catalog generation-input UUID. It changes with catalog name, Wikidata identity or Wikipedia identities, and on removal/restoration; coordinate-only edits preserve it. Use the existing POI baseline to inspect those inputs.
- `revision`: UUID of the last committed category operation for this POI, or explicitly `null` when none exists. This is independent of the Story publication ID. A failed/missing baseline must never be interpreted as null.
- `categoryIds`: complete directly assigned IDs, sorted by ID. Parent membership is inferred for discovery, not automatically inserted into this list.
- `definitions`: **all** online category definitions across cities, sorted by ID. Each is `{ id, name, label?, parentId? }`; `id`, `name`, and `parentId` are nonempty trimmed strings; `label` is an optional string. Absent optional fields are omitted, not null. The hierarchy is a forest with at most one parent per category.
- `stateDigest`: opaque lowercase 64-character SHA-256 token over this baseline (excluding the token). Copy it unchanged; clients must not calculate it. It protects both the shared definitions snapshot and the target POI's assignments, including changes made outside this endpoint.

One SQL statement reads the entire baseline from base tables in one snapshot. No visitor visibility or cache is involved.

### Write: `PUT /pois/{poiId}/categories`

```json
{
  "poiId": "728cbdf6-2449-4991-99b0-75204603eaa0",
  "inputRevision": "8c798cde-620e-4aaa-94c3-505df77c5c57",
  "revision": "a13052b3-8b44-4fa3-ae61-3cbd5167797c",
  "expectedRevision": null,
  "expectedStateDigest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "categoryIds": ["amphitheatre"],
  "definitions": [
    { "id": "amphitheatre", "name": "Amphitheatre", "parentId": "architecture" },
    { "id": "architecture", "name": "Architecture" }
  ]
}
```

Every top-level field is required. Objects are strict, including definitions. UUIDs normalize to lowercase; route/body POI IDs must match. `revision` is a fresh client-generated operation UUID; `expectedRevision` and `expectedStateDigest` come from the captured baseline. Retain `inputRevision` from before classification, not a revision fetched after producing a result for older inputs.

`categoryIds` replaces the complete assignment set **only for this POI**; `[]` clears it. IDs must be unique. `definitions` contains definitions needed for the assignment, including new ancestors. Definitions already present in the baseline may be omitted; parents may be supplied in any order. IDs must be unique within this array. The union of online and supplied definitions must contain every assigned ID and parent and must have no cycles, including self-parenting. New definitions are inserted; an existing definition must match all fields, including optional-field presence. Changing/renaming/reparenting/deleting an existing definition is a conflict here and requires the separate global-category scope. `definitions: []` is valid when all required definitions are already online or assignments are empty. Omitted online definitions are never deleted.

Success is returned **after commit**, with the request revision:

```json
{ "status": "saved", "revision": "a13052b3-8b44-4fa3-ae61-3cbd5167797c" }
```

An identical retry of the currently committed operation returns HTTP 200 with the same revision and `status: "already-saved"`, even if another POI has since added shared definitions. Reusing the current operation revision with different validated content returns `400 invalid`. Object-key order is ignored for request hashing; array order is significant. Persist and resend the same immutable payload rather than rebuilding/reordering it. Only the latest operation per POI is retained: a retry superseded by a newer category save returns `409 conflict`, without replaying older assignments.

The transaction checks active POI/input revision first (also for retries), then checks the current operation for an identical retry, then checks the expected category revision and full baseline digest. Missing/removed POIs or changed catalog inputs return `409 obsolete`. Stale expected revisions/digests or incompatible existing definitions return `409 conflict`. Duplicate definitions/assignments, missing references and hierarchy cycles return `400 invalid`. The usual authenticated error envelope, body limit, content type, method rules and `Cache-Control: no-store` apply. Responses do not return SQL or validation details.

Definitions, replacement associations and operation acknowledgement metadata commit atomically. The POI row is locked; transaction-scoped table locks on categories and associations serialize definition checks/inserts, including absent IDs, against other writes. This deliberately favors simple correctness for the private admin over write throughput. Unrelated POIs' new definitions conservatively invalidate older baselines; clients must reconcile explicitly. Story-only writes do not invalidate a category baseline. Catalog removal deletes category associations and the last-operation record; a restored POI has a fresh input revision and an initial null category revision.

Public map, previews, Story details and linked-POI reads already compose these associations through visitor views. Direct repository reads observe the committed state on their next query. Existing per-instance visitor caches may return the previous snapshot until their **hard 60-second TTL** expires; no cross-instance immediate invalidation is promised. A save response confirms persistence, not a refreshed visitor response. Unpublished POIs remain hidden until a valid Story is saved. The build-generated homepage catalog is unchanged.

### Schema prerequisite and private-client handoff

The original `001-content.sql` fixture/checksum is unchanged. The additive schema file [`002-poi-category-writes.sql`](../src/server/content/schema/002-poi-category-writes.sql) creates only `content.poi_category_writes` and grants the existing writer role access. It has no data backfill, no runtime migration runner and no reader grant. An absent row means the initial null revision. It is a separately reviewed schema prerequisite; **nothing in this task applies it online**. Do not rerun `001-content.sql` online.

Deployment order:

1. In an authorized operational step, apply the additive schema once using the schema owner and the established schema-change tracking procedure. Confirm the runtime writer has the new table privileges. Existing server versions continue to work with the extra table.
2. Deploy this public server and verify authenticated category-baseline reads, including an unpublished POI. Verify write/retry/conflict behavior against isolated data before enabling live writes. The existing runtime reliability gate above still applies.
3. Deploy/enable the private Node client only after the new endpoints are available. A 404/405 from an older server is an unavailable capability, never a successful save or permission to fall back to Story writes. Rolling back the client/server can leave the additive table in place.

Private repository implementation checklist:

1. Add the exact strict request/baseline/response schemas and endpoint methods to the existing `/api/admin/content/v1` Node client. The response is `{ status: "saved" | "already-saved", revision: UUID }`. Reuse Bearer authentication, payload limits and error-code handling; keep secrets outside React.
2. Before classification in `src/admin/categories.ts` / `src/admin/categoryInterpretation.ts`, capture the category baseline and the catalog identity inputs. If fetching the existing POI baseline separately, require matching `inputRevision` across both responses. Compare these inputs with the local POI. Preserve this baseline with the result.
3. Also capture/check a **local fingerprint or run version** covering the actual Wikidata types, category mappings, interpretation rules and POI exceptions used by classification. These inputs are not stored by this public API; its catalog `inputRevision` cannot detect remote Wikidata changes or local mapping/exception edits. Before queuing/sending, reject results whose local inputs have changed. Offline results have an unknown baseline until explicitly reconciled; attaching a fresh baseline alone does not prove freshness.
4. Derive the complete assigned IDs and required definitions/ancestor closure. Reuse online definitions by ID with exact fields; do not silently replace shared names/parents with local definitions. Resolve any mismatch explicitly. Persist a dedicated immutable category pending operation (payload, fresh revision, captured baseline and local input fingerprint) before sending. Do not require or regenerate a Story, nor reuse a Story operation identity.
5. On `saved`/`already-saved`, verify the response revision matches and mark that operation acknowledged. On timeout, disconnect, non-JSON infrastructure response or uncertain outcome, retain and resend the exact payload/UUID. An unresolved earlier operation for the same POI must be reconciled before sending a newer one. On `conflict`/`obsolete`, preserve the result and require reconciliation; never silently replace expected versions. Startup/manual retry must not rerun classification or generation. Synchronize any required catalog creation before category saves; category and Story saves otherwise remain independent.
6. Add MSW client tests for both success statuses, response-revision mismatch, unknown commit followed by identical retry, conflict/obsolete retention, unavailable endpoints and stale local input fingerprints. Share valid/invalid payload cases with the public tests before enabling the client. The global categories panel (rename/reparent/delete/mappings/bulk changes) remains separate work; future global writers must participate in category concurrency/revision handling rather than modifying assignments behind a current retry acknowledgement.

Local server tests exercise unpublished saves, public reads/cache expiry, non-category content preservation, strict request identities, duplicates/missing references/cycles, rollback after a late database failure, concurrent retries/competing operations, shared-definition conflicts, removed/restored POIs and writer permissions. The database tests load both schema files only in a disposable loopback database.

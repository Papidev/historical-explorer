# Admin content API

The public Next.js server implements [Admin content API v1](admin-write-api-contract.md) at `/api/admin/content/v1`. Local admin Node clients use a dedicated Bearer credential; there is no user login, browser credential or CORS integration. Successfully saving complete, valid content publishes its new version automatically; no separate approval or publish action is required. The Rome map and its detail APIs prefer online publications through `src/server/visitorContent`, with a hard 60-second server cache. The map merges eligible local-only POIs; online identity and removal metadata keep duplicates and removed local copies out of the map. Saves do not actively invalidate that cache; new requests observe updates after expiry. A matching online publication is authoritative: its failures or missing fields never select local content. The homepage retains its existing build-generated catalog. See [visitor content deployment](../README.md#visitor-content-deployment).

## Origin and schema compatibility

The repository, publication validators and PostgreSQL transaction tests were adapted from `Papidev/mira-admin` at commit `2b7b203cb2ba35dadd5a36d6b0ea6eb1bf971b1d`. The v1 contract comes from commit `d7b058953812857031bba5eafe431f1ac59c907d`. The private implementation is unchanged. API schemas live separately from legacy local workflow schemas so their compatibility behavior cannot weaken strict API validation or weaken the published-only visitor boundary.

`src/server/content/__fixtures__/001-content.sql` is an exact copy of the existing private SQL, used only to bootstrap a disposable local test database. SHA-256: `527937488927da52d7574e1ff28ae297e96b70418285a6142c35b5201704ea95`. There is no runtime migration runner or migration command. Do not apply this fixture online; the online schema already exists.

Portable synthetic valid/invalid request fixtures are in `src/server/content/__fixtures__/contract-v1.json`. Share these with the private client before coordinated deployment. One existing private validator needs alignment: its Wikipedia page object strips unknown fields, while the contract requires strict nested validation. This server rejects those fields. This implements the written contract; no wire-contract change is proposed. The private Person schema also needs the export already requested by the contract.

## Server configuration

Configure only server-side environment variables, locally in `.env.local` and later in Vercel when deployment is authorized:

| Variable               | Value                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTENT_API_TOKEN`    | Random dedicated secret with at least 32 bytes of entropy. For example, generate 32 random bytes and encode them as hex. Missing or shorter configuration fails closed with 503. |
| `CONTENT_DATABASE_URL` | PostgreSQL URI containing a runtime writer login, percent-encoded password and database. On Vercel, use the Supabase shared transaction pooler hostname and port 6543.           |
| `CONTENT_DATABASE_CA`  | Supabase root CA PEM, with actual newlines or literal `\n` sequences. Required; TLS verifies both the certificate and hostname.                                                  |

The admin Node environment needs `CONTENT_API_TOKEN` and `CONTENT_API_BASE_URL` (the deployed HTTPS origin); it does not need database credentials. Never prefix secrets with `NEXT_PUBLIC_` or expose them to React. The byte-length check prevents short configuration, but entropy comes from secure random generation.

Use a dedicated runtime login with membership in the existing `historical_explorer_writer` role, without schema ownership, superuser or migration privileges. Provisioning that login and configuring Vercel secrets are separate operational work; this implementation does neither. Do not use the migration credential for runtime traffic.

Copy the exact pooler hostname from Supabase's Connect panel; do not derive it from the region. The supplied project's dashboard currently shows `aws-0-eu-west-1.pooler.supabase.com:6543`. Query parameters in the URI are rejected so `pg` cannot override the explicit verified TLS configuration through `sslmode` or `sslrootcert`. Use percent-encoded credentials, including encoding literal `%` as `%25`.

The lazy process-level `pg` pool has one connection, a 5-second idle timeout, a 60-second maximum connection lifetime, a 10-second connection timeout and bounded query/statement timeouts. Vercel attaches its pool lifecycle handler before use. Queries use positional parameters without named prepared statements, session locks or session-dependent transactions. Each write pins one client through commit/rollback and discards it if rollback fails. No automatic write retries are performed. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres) and [Vercel pool lifecycle guidance](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).

## HTTP behavior and payload limits

All operations require authentication before body reads or content queries. Requests use strict nested schemas; route/body identities must match before entering a transaction. UUIDs normalize to lowercase; Person IDs retain their opaque identity. Baselines use one SQL statement per response and read base tables, including unpublished POIs and unlinked saved People. Removed POIs return 404. Unknown cities return `{ city, revision: null, pois: [] }`; an existing empty catalog retains its revision.

Every application response has `Cache-Control: no-store`. Unsupported methods return 405 with `Allow` and the existing `invalid` envelope code. Authenticated errors never include raw SQL, tokens, connection details or validation payloads. Version/identity conflicts, obsolete targets, invalid operations, missing resources and temporary database failures have the v1 envelope. Unique identity violations map to 409; PostgreSQL serialization/deadlock failures also return conflict. Platform rate limits, body rejections, disconnects or timeouts may happen before application code and need not use the JSON envelope.

The streamed body limit is **4,000,000 bytes**, checked against both declared length and actual UTF-8 bytes. Writes accept uncompressed `application/json`, optionally with parameters. Catalog replacement and Story saves remain atomic. The application limit leaves margin below [Vercel's 4.5 MB request/response limit](https://vercel.com/docs/functions/limitations). Oversized future requests require a transport-contract discussion; do not split them silently.

Before implementation, the real private Rome catalog (1,260 POIs, complete Wikipedia metadata) measured **586,859 bytes** as a compact catalog write. The existing Colosseum Story, all its image candidates and all four available Person artifacts together measured **12,965 bytes**, excluding the operation envelope and required provenance not yet acquired by that pipeline. These legacy artifacts were measured only; they were not converted or submitted. The portable fixture supplies a complete schema-valid synthetic wire Story for transport validation. Future outbox producers must measure their actual immutable payloads before sending; legacy artifacts alone do not prove complete generation.

## Verification and remaining operational gate

Run:

```sh
pnpm test:content-database
pnpm exec tsc --noEmit
pnpm build
```

The database test runner requires Docker, starts its own PostgreSQL 17 container bound to loopback on a random port, bootstraps only that disposable schema and removes the container afterward. Integration tests refuse any URL except a loopback `historical_explorer_test` database. Tests cover authentication/configuration failure, strict validation, route identities, streaming limits, errors/no-store, baseline visibility, committed retries, real uniqueness conflicts, concurrency, rollback, obsolete inputs, independent metadata, shared People and reader/writer permissions. Unit/schema tests can also run without Docker with `pnpm exec vitest run src/server/content`; database tests are then skipped explicitly.

`pnpm content:probe` runs only `BEGIN READ ONLY`, a health query and `COMMIT`, across ten fresh connection samples, ten pooled samples and a sample after the idle timeout. It checks transaction read-only state, uses the runtime verified TLS configuration, logs only sanitized results and exits unsuccessfully if any sample fails. It cannot reproduce Vercel suspension locally and does not establish write privileges or transaction correctness online.

On 2026-10-24, the supplied Supabase dashboard was Healthy and confirmed the transaction endpoint. A local read-only probe using the existing operational credential with verified TLS succeeded on **4/10 fresh connections**, **9/10 pooled samples**, and **0/1 after-idle samples**. The first pooled sample failed; the next nine reused the successful connection. No online migration or content write was executed. This confirms that local connection reliability remains unresolved; endpoint selection and successful pooled reads alone do not close the issue. No experimental SSLRequest delay or disabled certificate verification is included.

A separate successful read through the new repository baseline methods confirmed all 1,260 online Rome POIs, a non-null catalog revision, an unpublished active POI with explicit null publication, the unknown-city/missing-Person behavior, and an exact match of the existing migration checksum. It performed SELECTs only.

Final local verification: **69 tests passed**, TypeScript passed, ESLint passed on changed source/scripts, and the production Next.js build passed. The build includes the new admin route and retains the existing visitor routes. Disposable test containers were removed. No browser smoke check was run.

**Actual Vercel reliability remains unverified.** The new code has not been deployed, no runtime credentials were provisioned, and no live catalog/Story/Person write was performed. Deployment is explicitly outside this task. Before enabling production writes in a later authorized step:

1. Align the private validators against the portable fixtures and configure the dedicated runtime login, token and CA.
2. In the actual Vercel runtime/region, collect fresh, reused and after-idle read-only samples with this same configuration. Exercise authenticated baseline GETs across cold and warm instances; fail the gate if connection failures persist. Inspect Supabase and Vercel logs without exposing credentials.
3. Test writes only against an explicitly isolated database/catalog, including unknown commit outcomes and identical retries. Do not run replacement operations against the live Rome catalog as a connectivity check.

The original admin API slice included no visitor cutover, migration, live data change, deploy, or private-client/outbox integration. Visitor read integration is now documented in the README; the historical verification above is not a deployment confirmation.

## POI category persistence (v1 additive extension)

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

## Authoritative category catalog

Admin #38 uses authenticated `GET /api/admin/content/v1/categories` to read all
accepted definitions and hierarchy as `{ definitions, stateDigest }`. The digest
versions the canonical definitions, sorted by ID. `PUT` on the same route accepts
`{ name, expectedStateDigest }` and returns `{ status: "saved", definition }`.
Names follow the existing Admin validation (1–80 characters after whitespace
normalization, no angle brackets or line breaks). Creation uses the normalized
name as a stable ID, rejects case-insensitive duplicate names and ID collisions,
and rejects stale definitions with HTTP 409. The endpoint creates top-level
categories only; rename, move and delete have separate implementation issues.

The transaction uses the same category locks as per-POI assignment writes.
Creating a definition invalidates pending per-POI baselines; definitions inserted
by those writes invalidate an older catalog baseline. Existing assignments and
publication state remain unchanged. Reads use the existing writer credential;
visitor category responses retain their current shape. No new schema migration
or data import is required. Deploy this API before the corresponding Admin client.
A client with an uncertain save acknowledgement must read accepted definitions
before another edit rather than replay a creation against a refreshed baseline.

## POI Wikidata acquisitions v1 (additive extension)

[Admin #39](https://github.com/Papidev/mira-admin/issues/39) adds authenticated
`GET/PUT /pois/:poiId/types` and `GET /catalogs/:city/types` under the content v1
prefix. The single-POI response contains `poiId`, `city`, `name`, nullable
`wikidataId`, `wikipediaPages`, `inputRevision`, nullable acquisition `revision` and
nullable `acquisition`. City reads return an array from a single database snapshot.
Removed POIs are excluded. After catalog input changes the old acquisition is
hidden; its revision is retained for the next compare-and-replace operation.

A write contains `poiId`, `inputRevision`, a fresh UUID `revision`, nullable
`expectedRevision`, and `acquisition`: `{ wikidataId, types: [{ id, label }],
skipped, acquiredAt }`. IDs must be unique Wikidata Q IDs. `skipped: true` is valid
only without a Wikidata identity and with no types. A successful zero-type result
for an identified POI uses `skipped: false`. Acquisition failures are not writes.
The response is `{ status: "saved" | "already-saved", revision }`.

The transaction locks the catalog POI, checks its active identity and input revision,
compares acquisition revisions and stores an idempotency digest. Reused revisions
with different content are invalid. Stale identity/input or removal is obsolete;
concurrent acquisitions conflict. External Wikidata requests stay outside transactions.
Acquisition storage does not alter existing category assignments, Stories, People
or visitor publication. Editorial acquisitions are not exposed by visitor APIs.

Deployment order: separately approve/apply `schema/003-poi-type-acquisitions.sql`
with the schema owner, deploy this API, then deploy the linked Admin client. The
schema is additive and grants access only to the writer role; it imports nothing.
No production migration or activation is part of this implementation. Online shared
rules and atomic assignment recalculation follow in Admin #40; automatic generation
integration follows in #41. Keep local artifacts until the separately approved
comparison/import operation in #42.

## Shared type rules and atomic categories (#40)

Explorer owns the additive `004-type-category-rules.sql` prerequisite. It stores
shared editorial rules and the POI assignments contributed by those rules, with
writer-only access and no backfill or runtime migration.

- `GET /type-rules` returns `{ rules, definitions, stateDigest }` from one MVCC
  snapshot. Each rule has `typeId`, `decision` (`mapped`, `ignored`, `unmapped`),
  `categoryIds`, `origin`, optional `reason`, `revision` and `updatedAt`. Missing
  rules remain distinct from explicit manual unmapped rules. The digest covers
  rules, category definitions, city catalog revisions and active POI input/acquisition revisions.
- `PUT /type-rules` accepts `{ typeId, categories, revision, expectedStateDigest }`.
  A nonempty category list maps the type; `[]` ignores it; `null` persists a manual
  reset to unmapped. The type must occur in a valid accepted acquisition or already
  have an online rule. Unknown categories and reused current rule revisions are
  invalid. A stale digest conflicts. The response is
  `{ status: "saved", revision, affectedPois }`. An uncertain acknowledgement must
  be reconciled with a GET of the submitted rule revision before another edit.

The rule transaction identifies every affected active catalog POI from persisted
acquisitions whose input revision and Wikidata identity still match. It recalculates
using all accepted rules, existing hierarchy expansion and POI-name interpretation,
preserving independently assigned categories. Every affected POI's category revision
advances even if its resulting categories are unchanged. Rule and assignment changes
roll back together on any failure. Accepted acquisition updates now run the same
recalculation before committing. No external service is called inside the transaction.

Catalog, acquisition, category-definition and per-POI category writers acquire the
same table locks before city/POI row locks. Old per-POI requests conflict after a
recalculation. Legacy whole-category replacements are also rejected for POIs with
accepted online acquisitions, so a fresh legacy classification cannot override rules;
complete Draft enrichment moves to this authority in #41. POIs without an accepted
acquisition retain their existing per-POI API. Explicit category exceptions remain
separate Explorer #61 work.

Rule metadata is absent from visitor views and inaccessible to the reader role.
Existing visitor category filtering/cache semantics are unchanged. No Story, Person
or publication is created or regenerated. A fresh rules table is empty; no seed or
local mapping fallback is used. Existing untracked assignments are preserved until
#42's separately approved provenance comparison/import.

Separately approve/apply the additive schema before deploying Explorer, then update
Admin. This slice authorizes no production migration, import or activation.


### Automatic type rules (Admin #41)

`PUT /type-rules` accepts optional `origin: "automatic"`, a required trimmed
`reason` (1–4,000 characters) for automatic requests, and up to 20 new top-level
`definitions`. Each new definition has equal ID/name, a unique name/ID, and no
parent or label. Manual requests omit these fields. Existing `categories` semantics
remain: nonempty maps, `[]` ignores, and `null` records unmapped.

The existing expected state digest must match before any write. Automatic requests
cannot replace manual, mapped or ignored rules. New definitions, rule metadata and
all derived affected-POI assignments commit in the same transaction, or all roll back.
The acknowledgement retains `{ status, revision, affectedPois }`; an uncertain result
must be resolved by reading the accepted rule revision and content before another edit.
No Wikidata/model request runs inside the transaction. Deploy this API extension
before the paired Admin client. It requires the existing #40 schema and adds no new
migration, production import or activation.

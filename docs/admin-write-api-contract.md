# Admin content API v1

Mirrored from private repository commit `d7b058953812857031bba5eafe431f1ac59c907d`; only reference links are adapted. Implementation and verification notes: [Admin content API](admin-content-api.md).

Contract prepared on 2026-10-23 for coordinated implementation in the private admin repository and public `Papidev/mira-explorer` repository. This document defines the interface; no endpoint is implemented by this change.

Read with [the architecture](https://github.com/Papidev/mira-admin/blob/d7b058953812857031bba5eafe431f1ac59c907d/docs/admin-architecture.md), [storage design](https://github.com/Papidev/mira-admin/blob/d7b058953812857031bba5eafe431f1ac59c907d/docs/online-storage-design.md), and [published content contract](https://github.com/Papidev/mira-admin/blob/d7b058953812857031bba5eafe431f1ac59c907d/docs/published-content-contract.md).

## Ownership and deployment

Mira Explorer is already deployed on Vercel. Its public repository owns the Next.js routes, authentication, PostgreSQL access, transactions and visitor reads. The private repository owns generation, durable local pending operations, the HTTP client and admin UI. The admin can remain local permanently. It does not need a public incoming endpoint.

During development Next.js can also run locally against an explicitly configured database. Production admin requests go from local Node to the deployed HTTPS API. Vercel holds database credentials; local Node holds only its API credential. Neither secret enters the React renderer.

The existing PostgreSQL implementation and SQL migration in this private repository are the starting point for the public server implementation. Bring over the required code and validation with attribution to the source commit; keep the private implementation intact during verification. Do not run the existing migration again as an untracked new migration. Existing online schema/checksum state must be respected.

Initially maintain this versioned JSON contract and matching validation in both repositories, without introducing a shared package or private runtime dependency in the public deployment. The API version changes when an incompatible request or response change is needed. Do not put credential values or generated private working artifacts into either repository.

## Authentication

Confirmed by the user on 2026-10-23: use a dedicated secret, without user login.

All routes below require `Authorization: Bearer <secret>`. Configure `CONTENT_API_TOKEN` in Vercel's server environment and the local Node environment; configure `CONTENT_API_BASE_URL` locally. Use a randomly generated secret with at least 32 bytes of entropy. Never use a `NEXT_PUBLIC_` or `VITE_` variable for it. Reject missing server configuration without accepting any request; compare presented tokens in constant time. Do not log the authorization header or return secrets in errors.

The credential grants all v1 admin operations, including whole-catalog replacement. It is not a visitor credential. Rotate it by replacing the configured value on the server and locally; old credentials then receive `401`. Do not retry authentication failures automatically. No account/session system or browser-to-online admin calls are included.

## HTTP conventions

Base path: `/api/admin/content/v1`. Requests and responses use JSON; writes require `Content-Type: application/json`. All responses, including errors and authenticated reads, use `Cache-Control: no-store`. These routes must not enter visitor caches. Unsupported methods return `405` with `Allow`; unsupported content types return `415`.

Successful writes return HTTP `200` only after commit:

```json
{ "status": "saved" }
```

An identical retry of the current committed operation returns `200` with `{ "status": "already-saved" }`. The client retains its immutable request and operation identity until acknowledgement. There is no separate idempotency header: catalog revision, publication ID and Person profile version identify their respective operations. Reusing an identity for different content is invalid. Once superseded, an older operation can return conflict or obsolete rather than already-saved; it must never overwrite the newer state.

Errors have one envelope; clients branch on `code`, not `message`:

```json
{ "error": { "code": "conflict", "message": "The online version has changed." } }
```

| HTTP | Code                     | Client behavior                                                                            |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------ |
| 400  | `invalid`                | Fix malformed JSON, schema violations or invalid operation identity; no automatic retry    |
| 401  | `unauthorized`           | Fix the API credential; retain pending work                                                |
| 404  | `not-found`              | Requested baseline entity does not exist; never infer a known-null version from this error |
| 409  | `conflict`               | Retain the result and show a version/identity conflict; never silently rebase              |
| 409  | `obsolete`               | Mark the operation obsolete because its target was removed or generation inputs changed    |
| 413  | `payload-too-large`      | Retain the result; change the transport before retrying, without regenerating              |
| 415  | `unsupported-media-type` | Fix request encoding                                                                       |
| 429  | `rate-limited`           | Retain pending work for startup/manual retry                                               |
| 503  | `unavailable`            | Retain pending work; retry at startup or explicitly                                        |
| 500  | `internal`               | Retain pending work and report a server failure                                            |

Validate authentication before reading write bodies or querying content. Map known repository errors to the codes above; never expose SQL, connection strings, stack traces or raw database errors. A PostgreSQL identity uniqueness violation must become a conflict rather than an unexplained internal error. Infrastructure can return non-JSON errors or terminate a request; the client must handle these without assuming the write failed to commit.

Before implementation, measure representative whole-catalog and complete-Story request sizes against the configured Vercel request limits. Set explicit body limits accordingly. Do not silently split an atomic catalog replacement or Story save into independent writes. If a payload cannot fit, revise this transport contract before enabling that operation.

## Authenticated baseline reads

These are admin reads, separate from visitor APIs. Return each response from one SQL statement or a repeatable-read transaction. Versions describe a snapshot and can change immediately afterward; every write still checks them inside its transaction.

### `GET /catalogs/{city}`

Return the complete synchronized catalog snapshot, including POIs with no published Story. Fields:

- `city`: city slug.
- `revision`: current catalog UUID, or `null` if the city has never been synchronized.
- `pois`: active POIs in stable ID order, with `id`, `name`, `coordinates`, optional `wikidataId`, `osmIds`, `wikipediaPages` and `inputRevision`.

An unknown city returns `200` with `revision: null` and `pois: []`. It is distinct from an existing catalog with an empty POI array and a non-null revision. Removed POIs are excluded; tombstones stay server-side. This snapshot lets the admin compare generation inputs and obtain server-issued input revisions. It does not authorize catalog removals.

### `GET /pois/{poiId}/baseline`

Return `poiId`, `city`, `name`, optional `wikidataId`, `wikipediaPages`, `inputRevision`, `publicationId` and `relatedPeople`. `publicationId` is a UUID or explicitly `null` for an active POI that has no published Story. `relatedPeople` is an array of `{ personId, wikidataId, profileVersion }` for the current published relationships; it can be empty.

A missing or removed POI returns `404`. A failed request does not mean `publicationId: null`. The generation adapter must compare actual Source inputs against this baseline; it cannot attach a fresh input revision to output generated for old inputs.

### `GET /people/{personId}/baseline`

Return `personId`, `wikidataId` and `profileVersion` for an existing profile, including profiles not exposed by visitor reads. A missing profile returns `404`. This supports explicit shared-Person updates; a Story save may create missing profiles but must not replace existing profiles implicitly.

The current repository exposes visitor reads only. These three baseline reads are new server implementation work; do not derive them from visitor visibility or infer versions from public detail responses.

## Writes

Use the existing strict schemas in [postgresContent.ts](../src/server/content/postgresContent.ts) and [publishedContent.ts](../src/server/content/publishedContent.ts) as the initial field definitions, together with this contract. Export the currently internal Person write schema when implementing shared validators. Reject mismatched route and body identities before entering the repository transaction. Strict validation applies to nested objects too.

| Route                     | JSON body                                                                                      | Repository operation |
| ------------------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| `PUT /catalogs/{city}`    | `catalogWriteSchema`: `city`, `revision`, `expectedRevision`, complete `pois` array            | `synchronizeCatalog` |
| `PUT /pois/{poiId}/story` | `storyWriteSchema`: `inputRevision`, `expectedPublicationId`, `detail`, `generation`, `people` | `saveStory`          |
| `PUT /people/{personId}`  | Person write: `profileVersion`, `expectedProfileVersion`, `wikidataId`, `person`, `generation` | `savePerson`         |

UUIDs use the existing schema normalization. Person IDs are opaque existing IDs; clients URL-encode path segments. Generation contains `provider`, `model` and `completedAt`. Source revision and acquisition timestamps must come from real acquisition, never fabricated legacy values.

Catalog synchronization is a complete city replacement, not a patch. Omitted active POIs are removed from publication through the existing transaction. The local confirmed-refresh workflow must prepare this operation; generation and startup must not invent a catalog replacement. `expectedRevision: null` means a known initial catalog, not an unknown baseline. The server creates fresh input revisions when names, Wikidata identities or Source identities change, and retains them for coordinate-only changes.

Story publication captures a known `expectedPublicationId` before generation, along with its input revision. If generation starts offline, retain an unknown baseline locally and reconcile explicitly before saving. There is no force-save endpoint. A conflict does not permit changing the expected version and replaying silently.

The Story body includes validated detail and any new Person candidates. Existing schema fields such as snapshot coordinates, categories, inverse Person links and timestamps remain validated input but do not become authoritative online metadata. The database keeps current coordinates/categories, derives inverse links and assigns actual commit timestamps. A Story write preserves independent metadata and does not overwrite existing shared Person profiles.

Person updates require a known existing `expectedProfileVersion`. They update the shared profile seen by every linked POI. A missing target is obsolete rather than permission to recreate it.

## Retry and completion boundary

The admin must first persist an immutable completed result and pending operation outside Git, including its payload, identity and captured versions. Only then send the request. A timeout, disconnect or malformed infrastructure response leaves the commit outcome unknown: retry the same operation without generating again. No periodic retry loop is introduced. Startup retries and explicit retries use the agreed recovery rules; catalog operations precede dependent content saves.

Do not connect current mixed-stage files directly to these APIs. Whole-Draft completion, Source provenance and the durable outbox remain required private-repository work. Saved/already-saved means online persistence completed; it does not imply visitor integration or cache invalidation has been deployed.

## Coordinated delivery and verification

1. Public repository: bring over the repository/schema validation, add baseline queries and Next.js routes, configure server credentials and verified TLS, and verify connection reliability in the actual Vercel environment. Keep current visitor reads intact.
2. Public repository: test authentication rejection, missing configuration, strict validation, path mismatches, error mapping, no-store responses and baseline visibility. Exercise real PostgreSQL transactions for retries, concurrent saves, obsolete inputs, conflicts, shared People and rollback. Check pool behavior with the selected endpoint before production writes.
3. Private repository: implement completed-result provenance, durable pending operations and the Node HTTP client. Test with MSW that an unknown response retries the identical operation, semantic conflicts stop automatic retries, and startup/manual retries never call generation.
4. Run an explicitly configured end-to-end test against isolated data. No live catalog replacement, migration, deletion or visitor cutover is authorized by this contract.

Use separate linked PRs. The private client PR names the public API PR and the v1 contract it requires. Before deploying the public routes, compare shared valid/invalid JSON fixtures in both repositories so validators and HTTP behavior agree. Visitor APIs/caching and independent category/gallery edits remain later slices.

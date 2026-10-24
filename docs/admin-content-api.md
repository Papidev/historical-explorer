# Admin content API

The public Next.js server implements [Admin content API v1](admin-write-api-contract.md) at `/api/admin/content/v1`. Local admin Node clients use a dedicated Bearer credential; there is no user login, browser credential or CORS integration. Visitor routes and the build-generated public catalog continue to use their existing read paths. Online saves do not change the current visitor site or invalidate its caches.

## Origin and schema compatibility

The repository, publication validators and PostgreSQL transaction tests were adapted from `Papidev/historical-explorer-backend` at commit `2b7b203cb2ba35dadd5a36d6b0ea6eb1bf971b1d`. The v1 contract comes from commit `d7b058953812857031bba5eafe431f1ac59c907d`. The private implementation is unchanged. API schemas live separately from legacy local workflow schemas so their compatibility behavior cannot weaken strict API validation or change existing visitor reads.

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

All six operations require authentication before body reads or content queries. Requests use strict nested schemas; route/body identities must match before entering a transaction. UUIDs normalize to lowercase; Person IDs retain their opaque identity. Baselines use one SQL statement per response and read base tables, including unpublished POIs and unlinked saved People. Removed POIs return 404. Unknown cities return `{ city, revision: null, pois: [] }`; an existing empty catalog retains its revision.

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

No visitor cutover, migration, live data change, deploy, or private-client/outbox integration is included.

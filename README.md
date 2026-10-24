# Cultural Atlas

Next.js 16 + React 19 visit companion for history, art, and culture. The map helps visitors choose a place; its Story explains why it matters.

## Getting Started

Use **pnpm only**.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Installation activates Husky: staged files are formatted with Prettier and staged JS/TS checked/fixed with ESLint. Select checks according to [Testing & Verification](AGENTS.md#testing--verification).

| Route              | Purpose                              |
| ------------------ | ------------------------------------ |
| `/`                | Project home.                        |
| `/rome`            | Visitor map.                         |
| `/rome?poiId=<id>` | Map with POI detail open.            |
| `/admin`           | Development-only editorial workflow. |

| Script                    | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `pnpm dev`                | Local server; generate the public snapshot first.  |
| `pnpm build`              | Generate the snapshot and production build.        |
| `pnpm catalog:build`      | Rebuild the snapshot independently.                |
| `pnpm start`              | Run the production server.                         |
| `pnpm lint`               | ESLint.                                            |
| `pnpm categories:rebuild` | Apply category rules to local city type snapshots. |

## Publication and deployment

CI skips dependency installation and application checks when every changed file
is under `docs/` or is `README.md` or `AGENTS.md`. The required `ci` check still
completes successfully. Other changes and manually dispatched runs use the full
CI workflow.

### Application versions

Application releases use Changesets. Each application PR includes one version
increment before merging, so Vercel deploys the prepared version from `main`.
The initial tracked release establishes the existing `0.1.0` as the baseline;
the increment requirement applies to subsequent application changes.
Use `patch` for fixes and small content/UI updates, `minor` for new features, and
`major` for incompatible changes. Internal documentation, `.gitignore`, and changes limited to
GitHub Actions workflows (including action dependency updates) and the other
CI/release automation files allowed by `scripts/check-release.mjs` do not
require an increment. Changes limited to dependency sections in `package.json`
and the pnpm lockfile also do not require an application release. Other manifest
changes, such as scripts or engines, still require a release. Versions remain
`0.x` during initial development.

```bash
pnpm changeset
pnpm release:version
pnpm release:check
```

Write the changeset summary in English. Run the version command after aligning
with current `main`; it consumes pending changesets and updates `package.json`
and `CHANGELOG.md`. Commit both files with the application change. If another
release merges first, regenerate your increment from the new version while
preserving the merged changelog history. CI checks the bump and changelog before
merge and creates a `v<version>` Git tag after CI passes on `main`.

The application version is visible in the home footer and the Rome map and content admin headers.

`GET /api/version` returns the version and full commit SHA embedded in the build.
The SHA comes from `VERCEL_GIT_COMMIT_SHA`, then `GITHUB_SHA`, then the local Git
checkout; it is `null` when unavailable. This endpoint identifies the running
artifact. A release tag identifies its source commit and does not confirm that
Vercel deployment succeeded. Preview deploys can have the same version with
different commit SHAs. No npm publishing or additional secrets are required.

Dependabot updates use the normal pull request CI without generating a Changeset,
version bump, changelog entry, or release commit. CI still runs lint, tests,
build, and production startup checks for package and lockfile updates. Dependency
updates deploy with the existing app version; `/api/version` identifies each
build by its commit SHA. Application changes included alongside dependency
updates still require a release. Run `node --test scripts/check-release.tests.mjs`
to verify the release policy against temporary Git repositories.

The `Dependabot auto-merge` workflow enables squash auto-merge for verified
Dependabot patch and minor updates; major updates require manual review.
Enable **Allow auto-merge** in repository settings and require the `ci` status
check on `main` so GitHub waits for CI before merging. Required reviews still
apply. The workflow reads PR metadata without checking out or executing PR code.

### Visitor content deployment

The Rome map combines published online content from Supabase with the build-generated local public catalog. Online publications replace the entire matching local POI; local-only POIs retain their existing Story, image and People. Matching uses the POI ID or Wikidata identity, never its mutable display name. Confirmed online removals suppress matching local entries. Imported metadata without a published online or eligible local Story remains hidden. The homepage keeps its existing catalog and presentation.

Configure `CONTENT_DATABASE_URL` and `CONTENT_DATABASE_CA` in the Next.js environment (locally in `.env.local`, and on Vercel). See [server configuration](docs/admin-content-api.md#server-configuration). Visitors never receive database credentials or the admin Bearer token. The admin write API also requires `CONTENT_API_TOKEN`; visitor reads do not use it.

The map loads online preview fields (name, coordinates, categories, introduction and selected image) and merges them with eligible local POIs and category definitions. An online empty gallery stays empty and shows an image placeholder; local images are never used to fill it. Opening a Story uses `/api/pois/<city>/<poiId>/dialog-content`. A local slug that matches an online publication resolves to that online UUID, including links from the homepage. Otherwise it opens the local Story. A missing or failed online detail never falls back to that POI's local Story.

Person requests from the map include the parent `city` and `poiId` in `/api/people/<personId>` query parameters. The server verifies the Story's Person reference, then uses the same online or local source as that Story. Online Person failures never select a local biography. Requests without a parent retain the online-only Person API behavior.

Server instances cache online reads for at most 60 seconds, with a bounded in-memory cache and no background stale refresh. A page reload or newly opened detail sees changes after cache expiry; already-open screens do not update automatically. Missing publications are cached for the same interval. Browser API responses use `Cache-Control: no-store`. Database failures never select a local replacement: the map reports unavailable if it cannot establish online publication/removal state, and detail APIs return 503. Missing resources return 404. Map and detail requests can straddle publication updates; the detail remains authoritative.

Deploy through Vercel's GitHub integration with production branch `main`. Branch pushes create previews; `main` updates deploy production. Once this integration is deployed, future complete online saves become visible after cache expiry without rebuilding the site. Local-only content and the homepage still require a build/deployment. `catalog:build` retains Wikidata identity for merging. No migration, data deletion or cleanup is included. A deployment rollback restores the earlier visitor read behavior without changing online data.

## Data layout

Versioned Stories, People, POIs, and category metadata live under `data/` in each checkout. Local Sources, acquired Types, checkpoints, AI progress, and diagnostic logs are read and written directly under `~/.local/share/historical-explorer`, shared by the main checkout and every worktree. No migration or setup command is needed for new worktrees. `data/public/` stays in each checkout because its build snapshot depends on that branch’s versioned content.

`<local-data>` below means that shared external directory. Set `HISTORICAL_EXPLORER_LOCAL_DATA_DIR` in `.env.local` or the shell to override it; use the same absolute path in every checkout. Changing it selects another store without moving files. Edits and deletions of shared Sources and checkpoints affect all checkouts. Map requests merge online publications with the build-generated catalog; the homepage uses the generated catalog. Builds do not require database connectivity, local Sources or AI credentials.

| Artifact                           | Location                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| Geo Place input                    | `data/<city>/pois/raw.geojson`                           |
| App-ready POIs                     | `data/<city>/pois/pois.geojson`                          |
| POI categories                     | `data/<city>/pois/categories.json`                       |
| Story Content and image candidates | `data/<city>/stories/<poi-id>/story.json`, `images.json` |
| Wikipedia text/source metadata     | `<local-data>/<city>/generated/wikipedia/`               |
| Acquired Wikidata Types            | `<local-data>/<city>/generated/wikidata/`                |
| Pipeline checkpoints/timings       | `<local-data>/<city>/generated/generation-metadata.json` |
| Canonical People                   | `data/people/<person-id>/person.json`                    |

POI IDs are stable and app-owned; external IDs such as `wikidataId` are optional. `geoPlaceId` preserves the original feature identity, enabling regeneration without Wikidata. Legacy records recover it only from a unique exact name/geometry match. Admin shows one row per linked source and preserves existing duplicates.

Person records and Main Image Candidate artifacts are validated with Zod when read. Invalid files report their path and validation errors; empty candidate lists and missing image selections remain valid workflow states. Selected images must reference an available candidate, and Person IDs must match their directory names.

Person records, Story Content, and Main Image Candidate artifacts are also validated before saving. Story saves check only their referenced Person records; unresolved references remain valid drafts. Validation failures preserve previous content and checkpoints. Unreferenced People and images awaiting Story Content are retained for reuse and retry.

The allowed Wikipedia editions are English (`en`), Italian (`it`), French (`fr`), German (`de`), and Spanish (`es`), configured in `src/server/wikiPipeline/acquireWikipediaSources.ts`. Wikipedia acquisition combines English with the official languages of the POI's country that are in the allowed edition list, using Wikidata country (P17), official language (P37), Wikimedia language code (P424), and sitelinks. People also include the official languages of their countries of citizenship (P27) and retain the originating POI's Wikidata context for regeneration. Story and Person content remains English. Missing country/language metadata or unavailable editions produce warnings; generation continues with usable Sources and stops only when none is available. Local editions complement English; conflicting claims retain attribution or are omitted.

The primary Wikipedia Source retains its text snapshot and metadata with ID `wikipedia`, title, and URL. Additional editions use IDs such as `wikipedia-it` and are saved in `<poi-id>.sources.json` beside the primary snapshot. Person additional Sources are stored in `<local-data>/generated/people/<person-id>.sources.json`, with reference metadata in the versioned Person record. Existing single-source records remain readable. Generation validates Source References; admin displays them when local Sources exist, while public responses omit them. Existing Stories and People are updated only by their generation/refresh actions; this rule does not regenerate saved content automatically.

New Story Content uses `textFormat: "markdown"`. Write Markdown inside
`introduction.text` and topic `description` strings: blank lines separate
paragraphs, `**important detail**` applies the app’s colored bold style, and
`*work title*` adds italics. Lists, links, headings, and block quotes are supported;
React owns their styling. The Main Image stays separate; embedded images, HTML,
and JSX are not rendered as Story elements. Generation favors short paragraphs
and selective bold, without a fixed quota.

Existing Stories without `textFormat` retain plain-text rendering and their
optional `emphasis` arrays; no saved content is migrated automatically. When
editing a Story to use Markdown, set `textFormat: "markdown"` at the top level
and write emphasis directly as `**bold**` instead of using the legacy arrays.
People descriptions remain plain text. See the
[Story quality references](docs/product/story-quality.md).

## Editorial workflow

Admin has **POIs**, **People**, and **Type mappings** tabs. POIs and People have 50 rows per page, selected on the server after search, filters, and sorting. Search, POI status/sort controls, and independent page numbers are stored in the URL; changing search or filters resets that table to its first page. POI name search is case-insensitive across original and generated names; People search matches display names and retains alphabetical order. Only the requested pages reach the browser, alongside a lightweight ID/name list for automatic generation across all POIs without Story Content. The server still reads the local catalog to compute global filters, counts, and Person links.

**Sort POIs** keeps the default status/name order or sorts by newest/oldest generation activity across all POI steps, including failed attempts. Sorting applies before pagination and keeps POIs without a recorded generation date last. Dates use local checkpoints and the recent run log.

Empty rows are **To do**. Attempted/generated rows with outstanding work/errors are **Needs attention**. **Needs source** keeps generated POIs and acquired Types visible, with missing-source/error details that persist after the toast closes and neutral placeholders without generation controls for unavailable artifacts.

**Generate** (empty row) and **Refresh** (existing row) recreate POI metadata, acquire Wikipedia, retain discovered Wikidata identity, refresh Types when available, generate image candidates, and generate structured Story Content/Related People. Preview, Refresh, and Delete are available for Story Content; commit reviewed artifacts.

Imported Wikipedia and Wikidata links are checked for lists, categories, and disambiguation pages before use. Source acquisition resolves the current POI references again; resuming generation rechecks Sources, and a changed Source identity requires new Story Content before retrying Related People.

Temporary refresh errors preserve existing artifacts. If no unambiguous English/Italian Wikipedia page resolves, remove the POI's Source, Story, and image candidates and mark it waiting for a Source; shared People and logs remain. See [Story Workflow Architecture](docs/story-workflow-architecture.md).

People supports alphabetical browsing, thumbnails, name search, and Linked POIs details derived from saved Story references. **Regenerate** uses the saved Source and selected model, preserving identity, image, and links. See [Person Architecture](docs/person-architecture.md).

Type mappings supports shared rules, automatic classification, and editable two-level categories. Saving updates affected city POIs without Story regeneration. Per-POI exceptions remain planned in #61. See [POI Categories](docs/poi-categories.md) for mapping, hierarchy, deletion, and filter rules.

### Source resolution

Prefer explicit English/Italian Wikipedia or Wikidata links over name searches. Wikipedia acquisition prefers linked English, then English name search; next use Italian links/search and prefer their English language link. Italian-only Sources still generate English content; URLs, images, and Person links retain the actual source language.

Name matches must be unique titles/redirects, never disambiguation pages, with a primary Earth coordinate within 1 km and a supported physical-place type. Missing/distant/secondary coordinates or broad entities leave the POI waiting. The tolerance accommodates centroids; it does not prove identity.

If both language name searches fail, examine up to 50 nearby articles per edition using the same checks. Accept one entity matching the name through title, English translation, Wikidata label, or alias; proximity alone is insufficient. Two editions of the same Wikidata entity count once.

Historical dates may be approximate or omitted. A century can be stored without an end year and is displayed as a century, not an exact year; supplied ranges must remain chronological and year zero is invalid.

### Automatic Story generation

Generate an individual POI from its row, or press **Start automatic generation** to process all Geo Places without Story Content, one at a time, across all pages and filters. There is no numeric limit. Generation uses the AI mode and model selected when it starts and continues until all candidates have been attempted or **Pause** is pressed. Pause lets the current POI finish before stopping; starting again continues with the remaining candidates. Individual row actions remain available while paused.

The compact toolbar shows the current POI and processed count. **Show generation logs** opens the current session's outcomes and each POI's detailed log without pausing generation. Ordinary POI errors do not stop subsequent candidates or trigger automatic retries. Ollama usage/request limits and an uncertain connection or generation outcome pause further submissions so the log can be checked.

Queue state and session history are held only in memory. Closing or reloading the page stops new submissions; an already submitted POI may still finish while the local server remains running. Nothing runs while the computer is off. On reopening, press **Start automatic generation** to select POIs still missing Story Content. Generated artifacts and diagnostic logs remain on disk. On browsers supporting Web Locks, only one tab at a time runs automatic generation.

Automatic generation uses a dedicated development-only HTTP endpoint so long generations do not hold up category edits in the page’s Server Action queue. The active POI stays pinned above other rows. Generation logs automatically scroll to new content, and progress badges and expanded logs share each run's progress state. Missing Wikipedia Sources are reported as **Waiting for a source**.

Guards support one local server process: three POI operations, one mutation per POI, and one pending Person generation per Wikidata ID. Allocate Person IDs immediately before saving; shared catalog/metadata writes are synchronous. Multiple processes or machines require shared coordination.

## AI Configuration

Admin AI actions use Local/Cloud configuration variables. Put them in `.env.local` when needed:

```bash
AI_MODE=cloud
LOCAL_AI_PROVIDER=ollama
LOCAL_AI_MODEL=qwen3:8b
OLLAMA_BASE_URL=http://localhost:11434
CLOUD_AI_PROVIDER=gemini
CLOUD_AI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your-gemini-api-key
```

`AI_MODE` controls the initial admin selector value. Local generation expects Ollama to be running with the configured model available. Cloud generation supports Gemini or an Ollama Cloud model routed through the local Ollama service. Gemini requires `GEMINI_API_KEY`.

To use an Ollama Cloud model after signing in to Ollama and pulling its cloud reference, configure:

```bash
AI_MODE=cloud
CLOUD_AI_PROVIDER=ollama
CLOUD_AI_MODEL=gpt-oss:20b-cloud
OLLAMA_BASE_URL=http://localhost:11434
```

The Ollama Cloud dropdown includes `gpt-oss:20b-cloud` and `gpt-oss:120b-cloud`, plus any other model configured in `CLOUD_AI_MODEL`. That setting remains the default selection. Prepare each cloud reference with `ollama run <model>` before using it; reload the admin page to see updated model options.

Ollama Cloud does not support schema-constrained output. Story Content and new People include their schemas in the prompt and retry once when a response fails JSON or domain validation. Both use the selected Cloud model.

Ollama Story and Person requests retry HTTP 502, 503, and 504 up to twice, with short delays. HTTP 429 and 402 still stop generation through the existing quota handling. Cancellation prevents further retry requests.

## Diagnostics

Local `<local-data>/rome/generated/generation-logs/day-*.jsonl` records start/completion/failure with shared run IDs. Seven daily slots rotate, overwriting data when reused after seven days. Admin shows latest-run errors beside artifacts and Related People errors in the People drawer. Known credentials are redacted; stack traces stay in the console. Logs stay outside the repository and are not a durable cross-machine/deployment audit.

Admin shows current errors: newer successful checkpoints or successful operations supersede them. A failed refresh remains visible if its saved artifact is older; historical logs stay on disk. Completion uses current artifacts/errors, not obsolete failed runs.

Single and batch Draft Story Generation share coordination and outcome reporting. Type acquisition, category classification, Main Image Candidates, and Related People issues are recorded as partial results and shown in progress and final warnings; classification failures can be retried from Type mappings.

Rejected AI output is saved in `<local-data>/generated/ai-response-failures/`: exact `rawResponse`, generation kind, subject identity, provider/model/mode, attempt, time, and validation error. Invalid provider JSON and content are captured even before a successful retry. Console output links the file; requests, keys, and headers are not stored. Diagnostic write failure preserves the original error.

Story generation uses `jsonrepair` for malformed JSON, including stray quotes before topic objects. Repaired output must pass Story schema and Source-ID validation; otherwise preserve normal error/retry behavior.

## Visitor map

The OpenFreeMap basemap shows cultural labels/icons: museums, monuments/memorials, castles/ruins, archaeology, worship, theatres, galleries, artworks, arts centres, and libraries. Other business/service/transit/sport POIs and generic attractions are hidden; roads, buildings, geographic labels, and curated markers remain.

Each parent category has a distinct map marker and matching pin in the filters: Religion yellow, Arts & Culture green, Architecture orange, Memorials violet, Public Spaces rose, and Other places blue. Markers and filter pins also share a category symbol from Font Awesome Free, displayed directly on the category color. Checkboxes remain blue to indicate selection. A selected marker darkens while keeping its category color.

Filters and Stories open in panels over the map, with full-width panels on mobile and resizable panels on larger screens. Open filters with the Filters tab or swipe right from the map’s left edge. All available categories start selected. Categories are collapsed under **All categories** until expanded with its arrow; parent categories are ordered alphabetically with Other places last, and subcategories are ordered alphabetically. The selection summary shows All, None, or the number of selected available leaf categories without counting parents twice. Clearing **All categories** also expands the category list. The **All categories** checkbox clears all categories when checked, selects all when unchecked or partially selected, and shows a dash for partial selection. To show only museums, clear all categories and select Museum. Categories match with OR semantics; no categories selected means no POIs on the map or in the list. See [POI Categories](docs/poi-categories.md#visitor-filtering) for filtering rules and [Entity Discovery](docs/entity-discovery.md) for planned discovery features.

**Search** in the discovery panel searches all published POIs in the current city by name, ignoring case and accents. Suggestions show the name, available address, and city. Select a suggestion with the pointer or keyboard to center the map, highlight its marker, and open its Story. Search includes places excluded by active categories: selecting one temporarily shows only that result alongside the filtered markers, with a notice in its Story. Category selections and the filtered place count stay unchanged. Closing the Story or selecting another place removes the previous exception. An empty search has no suggestions; unmatched names show a no-results message. Search uses the merged online and local POIs already loaded by the page and never queries external places.

The selected POI is stored in `?poiId=<id>`. Opening a different POI adds a browser-history entry; closing its Story, clicking the map, or excluding it through filters removes `poiId` in a new entry. Other query parameters and the URL fragment are preserved. Refresh and shared links reopen the selected Story; Back/Forward restore selection without reloading the map. If history restores a POI excluded by the current filters, all categories are selected so the restored place is visible. Unknown POI IDs leave the Story panel closed. Reopening the same POI does not add a duplicate history entry.

Story loading feedback appears only after 200 ms, avoiding a brief loading-message flash for fast responses. Missing-content feedback appears only once the request finishes.

Stories and Person details offer a quiet **Read on Wikipedia** link at the end of the content. It opens the cited English article when available, otherwise the first cited edition. **Other languages** expands a compact row of additional cited editions directly below the link. Every Wikipedia link opens in a new tab. Only acquired, cited article URLs are shown; missing links are omitted rather than guessed.

Story saves retain `wikipediaSources` (article title and URL) in versioned Story Content, independently of local Source text. Person links use the Source metadata already in their versioned records. Visitor reads derive these links from the online publication’s Source metadata, so production does not need local Sources. Older local Stories retain their existing optional metadata for editorial tooling.

Public homepage, POI preview, Story, and Person images use `next/image` with responsive sizes and reserved layout space. Next.js resizes and caches images and serves WebP to supported browsers. The image optimizer accepts HTTPS Wikimedia Commons images from `thumb.wikimedia.org` and `upload.wikimedia.org`; query strings are allowed for Wikimedia's thumbnail metadata. Preview and Story image-error fallbacks remain available.

Local transfer samples on October 10, 2026: Piazza Navona's 1,492,910-byte source becomes 37,620 bytes at 384 px in WebP; the Cloisters of Bramante's 177,020-byte source becomes 17,202 bytes. These are image-response measurements, not full-page performance benchmarks.

## Content admin

Use **Expand table** in the POI toolbar to give the table almost the full viewport while keeping search and status filters available. **Restore layout** brings back generation controls. AI settings, shared artifacts, queue instructions, and column metadata expand on demand.

## Security Notes

Admin is temporary, unauthenticated, and available only with `pnpm dev`. Its page and AI-progress API use `.dev.tsx`/`.dev.ts`, excluded from production builds; admin UI is absent from production bundles and missing routes return 404. Server Actions reject production execution before reading inputs or doing work. Dev is not localhost-restricted; use a trusted network.

Never commit real API keys. Cloud generation sends source text to the provider and may incur charges.

## Tailwind Plus / Catalyst

Licensed Tailwind Plus source is a local reference in gitignored `.tailwind-plus/`, never a production import or committed catalog. Adapt needed components in `src/app/components/ui/` and commit app-owned code with required dependencies/theme/font setup.

## Documentation

Track bugs, improvements, and future ideas in GitHub Issues and this repository's Cultural Atlas Project. Backlog status records an idea without scheduling implementation; conditional work retains its revisit conditions in the issue.

[Product vision](docs/product/vision.md) · [Story quality references](docs/product/story-quality.md) · [Glossary](CONTEXT.md) · [Entity discovery](docs/entity-discovery.md)

## Admin content API

The server exposes Bearer-authenticated v1 catalog, Story and Person writes and admin baseline reads, independently of the existing visitor catalog. See [configuration, contract and verification](docs/admin-content-api.md). Runtime database credentials stay on the server. Deployment and live writes require the remaining Vercel connection verification documented there.

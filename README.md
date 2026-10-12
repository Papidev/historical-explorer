# Cultural Atlas

Next.js 16 + React 19 visit companion for history, art, and culture. The map helps visitors choose a place; its Story explains why it matters.

## Getting Started

Use **pnpm only**.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Installation activates Husky: staged files are formatted with Prettier and staged JS/TS checked/fixed with ESLint. Run `pnpm lint` before a PR.

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
`major` for incompatible changes. Internal documentation and changes limited to
the CI/release automation files allowed by `scripts/check-release.mjs` do not
require an increment. Dependency manifests and lockfile updates still require
an application release. Versions remain `0.x` during initial development.

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

Dependabot updates also produce a patch release of the application. The
`Prepare Dependabot releases` workflow prepares and consumes an English
Changeset automatically after the first CI run on a bot PR, and refreshes every open
bot PR when `main` changes. Repeated runs preserve exactly one patch increment
from current `main`. Dependency major versions do not automatically imply an
application major release. Normal CI and review still apply before merging.
The generated release commit includes `[skip ci]` to suppress the duplicate
`pull_request` run that GitHub requires a maintainer to approve after a
`GITHUB_TOKEN` push. The automation explicitly dispatches CI on the prepared
release branch instead; `workflow_dispatch` is unaffected by `[skip ci]` and
checks the release version, lint, tests, build, and production startup.

No GitHub App or additional secrets are needed. A `workflow_run` job uses the
built-in `GITHUB_TOKEN` to push the prepared release and explicitly dispatch CI
on the updated branch. Dispatched CI runs have read-only permissions and do not
trigger another preparation run. The privileged workflow executes only code
and tooling from `main`, without sharing dependency caches with PR jobs; it
treats PR changes as data. It supports package dependencies, the pnpm lockfile
and GitHub Actions updates. Conflicting dependency changes or unrelated file
changes stop preparation rather than overwrite work. The workflow can also be
run manually to refresh existing PRs. Repository or organization restrictions
on Actions write permissions still apply.

### Public catalog deployment

Visitor routes/APIs read a build-generated public snapshot, never editorial files selected by request IDs. A POI needs valid versioned workflow-generated Story Content, a selected licensed/attributed Main Image, and saved records for every retained Related Person. Imported or metadata-only POIs are excluded. Explicit approval is optional future work; admin `Complete`, local Sources, generation logs, and acquired Types do not gate publication.

Deploy through Vercel's GitHub integration with this repository and production branch `main`. `vercel.json` configures the build; `package.json` pins pnpm and Node.js 24. Branch pushes create previews; `main` updates deploy production. Require existing CI checks before merging.

Commit POI catalogs, categories, Stories, image candidates/selection, and linked People. Builds generate gitignored `data/public/catalog.json`, embedded in the server build. Vercel needs no export step, local generated data, or AI credentials. Content becomes public on the next deployment.

Admin operations refresh the development snapshot. After directly editing content files, restart `pnpm dev` or run `pnpm catalog:build`. Tests also generate the snapshot automatically.

## Data layout

Versioned content lives under `data/<city>/`; rebuildable `generated/` outputs are ignored.

| Artifact                           | Location                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| Geo Place input                    | `data/<city>/pois/raw.geojson`                           |
| App-ready POIs                     | `data/<city>/pois/pois.geojson`                          |
| POI categories                     | `data/<city>/pois/categories.json`                       |
| Story Content and image candidates | `data/<city>/stories/<poi-id>/story.json`, `images.json` |
| Wikipedia text/source metadata     | `data/<city>/generated/wikipedia/`                       |
| Acquired Wikidata Types            | `data/<city>/generated/wikidata/`                        |
| Pipeline checkpoints/timings       | `data/<city>/generated/generation-metadata.json`         |
| Canonical People                   | `data/people/<person-id>/person.json`                    |

POI IDs are stable and app-owned; external IDs such as `wikidataId` are optional. `geoPlaceId` preserves the original feature identity, enabling regeneration without Wikidata. Legacy records recover it only from a unique exact name/geometry match. Admin shows one row per linked source and preserves existing duplicates.

Person records and Main Image Candidate artifacts are validated with Zod when read. Invalid files report their path and validation errors; empty candidate lists and missing image selections remain valid workflow states. Selected images must reference an available candidate, and Person IDs must match their directory names.

Person records, Story Content, and Main Image Candidate artifacts are also validated before saving. Story saves check only their referenced Person records; unresolved references remain valid drafts. Validation failures preserve previous content and checkpoints. Unreferenced People and images awaiting Story Content are retained for reuse and retry.

Wikipedia Sources use a text snapshot and metadata with ID `wikipedia`, title, and URL. Generation validates Source References; admin displays them when local Sources exist, while public responses omit them.

## Editorial workflow

Admin has **POIs**, **People**, and **Type mappings** tabs. POIs has 50 rows per page; status/search apply across all pages and reset pagination. Name search is case-insensitive across original and generated names.

Empty rows are **To do**. Attempted/generated rows with outstanding work/errors are **Needs attention**. **Needs source** keeps generated POIs and acquired Types visible, with missing-source/error details that persist after the toast closes and neutral placeholders without generation controls for unavailable artifacts.

**Generate** (empty row) and **Refresh** (existing row) recreate POI metadata, acquire Wikipedia, retain discovered Wikidata identity, refresh Types when available, generate image candidates, and generate structured Story Content/Related People. Preview, Refresh, and Delete are available for Story Content; commit reviewed artifacts.

Temporary refresh errors preserve existing artifacts. If no unambiguous English/Italian Wikipedia page resolves, remove the POI's Source, Story, and image candidates and mark it waiting for a Source; shared People and logs remain. See [Story Workflow Architecture](docs/story-workflow-architecture.md).

People supports alphabetical browsing, thumbnails, name search, and Linked POIs details derived from saved Story references. **Regenerate** uses the saved Source and selected model, preserving identity, image, and links. See [Person Architecture](docs/person-architecture.md).

Type mappings supports shared rules, automatic classification, and editable two-level categories. Saving updates affected city POIs without Story regeneration. Per-POI exceptions remain planned in #61. See [POI Categories](docs/poi-categories.md) for mapping, hierarchy, deletion, and filter rules.

### Source resolution

Prefer explicit English/Italian Wikipedia or Wikidata links over name searches. Wikipedia acquisition prefers linked English, then English name search; next use Italian links/search and prefer their English language link. Italian-only Sources still generate English content; URLs, images, and Person links retain the actual source language.

Name matches must be unique titles/redirects, never disambiguation pages, with a primary Earth coordinate within 1 km and a supported physical-place type. Missing/distant/secondary coordinates or broad entities leave the POI waiting. The tolerance accommodates centroids; it does not prove identity.

If both language name searches fail, examine up to 50 nearby articles per edition using the same checks. Accept one entity matching the name through title, English translation, Wikidata label, or alias; proximity alone is insufficient. Two editions of the same Wikidata entity count once.

Historical dates may be approximate or omitted. A century can be stored without an end year and is displayed as a century, not an exact year; supplied ranges must remain chronological and year zero is invalid.

### Missing Story queue

**Generate missing stories** replaces the concurrent three-POI batch. It selects all Geo Places without saved Story Content, including incomplete and failed POIs, regardless of table search, filters, or pagination. **Stories per run** defaults to 20 and accepts any positive integer; each run starts at most that many Story Content generations, one at a time, using the AI mode and model selected at its start. POIs that fail before Story Content generation starts do not use a slot, so the queue checks further POIs until it reaches the limit or exhausts the candidates. An error after Story Content generation starts still counts. Progress shows completed Story generation attempts, including failed attempts that used a Story slot; stopped attempts count as completed only after resuming and finishing.

**Pause queue** lets the current POI finish before pausing. **Resume queue** continues with the next queued POI and the original model. **Stop current POI** also cancels its active external request. The stopped attempt remains visible, and resuming retries that POI first with a new progress log, reusing saved Sources, Main Image Candidates, Story Content, and completed People. An incomplete model response cannot be resumed and must be requested again. Each POI uses at most one Story slot across stop/resume, but repeated model requests still consume quota; stopped attempts are not shown as completed. The queue, original model, limit, attempt history, and position are saved in the browser and restored paused when the page reopens. Each POI has independent progress and outcomes; errors and partial results remain visible and the queue continues. An Ollama HTTP 429 or 402 in Story generation or a reported partial failure pauses the queue; check usage before manually resuming. Failed POIs are not retried automatically within the same run.

**Resume queue** restores work in the same browser after closing the page or restarting the computer. Closing the page stops new submissions; an already submitted POI may finish while the local server remains running. On resume, the app checks that POI’s server progress before sending new work. A server restart marks an unfinished attempt as interrupted so it can resume from saved checkpoints. Nothing runs while the computer is off, and resuming is always manual. Browser storage must be available; clearing it removes the saved queue. **Discard saved queue** clears the queue without deleting generated artifacts or server logs. On browsers supporting Web Locks, one tab at a time can operate the saved queue. The story count is a workload limit, not an account quota guarantee: categories, People, and validation retries can each require additional AI requests.

The active row stays pinned above other rows. The progress dialog can be hidden/reopened without pausing. Queue results and generation logs automatically scroll to the latest content when runs or messages change, including logs expanded within the queue. Badges and expanded logs share each run's progress state. A missing Wikipedia Source shows **Waiting for a source**. After an action finishes, a still-running log is read up to three times to obtain its final status; an unavailable log falls back to the action result without retrying generation. A lost browser connection pauses new queue submissions and is treated as an unknown outcome, not a confirmed generation failure; progress keeps checking for the server’s actual result and never resubmits the generation automatically.

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

## Diagnostics

Local `data/rome/generated/generation-logs/day-*.jsonl` records start/completion/failure with shared run IDs. Seven daily slots rotate, overwriting data when reused after seven days. Admin shows latest-run errors beside artifacts and Related People errors in the People drawer. Known credentials are redacted; stack traces stay in the console. Logs are gitignored and not a durable cross-machine/deployment audit.

Admin shows current errors: newer successful checkpoints or successful operations supersede them. A failed refresh remains visible if its saved artifact is older; historical logs stay on disk. Completion uses current artifacts/errors, not obsolete failed runs.

Single and batch Draft Story Generation share coordination and outcome reporting. Type acquisition, category classification, Main Image Candidates, and Related People issues are recorded as partial results and shown in progress and final warnings; classification failures can be retried from Type mappings.

Rejected AI output is saved in gitignored `data/generated/ai-response-failures/`: exact `rawResponse`, generation kind, subject identity, provider/model/mode, attempt, time, and validation error. Invalid provider JSON and content are captured even before a successful retry. Console output links the file; requests, keys, and headers are not stored. Diagnostic write failure preserves the original error.

Story generation uses `jsonrepair` for malformed JSON, including stray quotes before topic objects. Repaired output must pass Story schema and Source-ID validation; otherwise preserve normal error/retry behavior.

## Visitor map

The OpenFreeMap basemap shows cultural labels/icons: museums, monuments/memorials, castles/ruins, archaeology, worship, theatres, galleries, artworks, arts centres, and libraries. Other business/service/transit/sport POIs and generic attractions are hidden; roads, buildings, geographic labels, and curated markers remain.

Filters and Stories open in panels over the map, with full-width panels on mobile and resizable panels on larger screens. Open filters with the Filters tab or swipe right from the map’s left edge. Categories match with OR semantics; no categories selected means no POIs on the map or in the list. See [POI Categories](docs/poi-categories.md#visitor-filtering) for filtering rules and [Entity Discovery](docs/entity-discovery.md) for planned discovery features.

The selected POI is stored in `?poiId=<id>`. Opening a different POI adds a browser-history entry; closing its Story, clicking the map, or excluding it through filters removes `poiId` in a new entry. Other query parameters and the URL fragment are preserved. Refresh and shared links reopen the selected Story; Back/Forward restore selection without reloading the map. If history restores a POI excluded by the current filters, all categories are selected so the restored place is visible. Unknown POI IDs leave the Story panel closed. Reopening the same POI does not add a duplicate history entry.

Story loading feedback appears only after 200 ms, avoiding a brief loading-message flash for fast responses. Missing-content feedback appears only once the request finishes.

Public homepage, POI preview, Story, and Person images use `next/image` with responsive sizes and reserved layout space. Next.js resizes and caches images and serves WebP to supported browsers. The image optimizer accepts HTTPS Wikimedia Commons images from `thumb.wikimedia.org` and `upload.wikimedia.org`; query strings are allowed for Wikimedia's thumbnail metadata. Preview and Story image-error fallbacks remain available.

Local transfer samples on October 10, 2026: Piazza Navona's 1,492,910-byte source becomes 37,620 bytes at 384 px in WebP; the Cloisters of Bramante's 177,020-byte source becomes 17,202 bytes. These are image-response measurements, not full-page performance benchmarks.

## Security Notes

Admin is temporary, unauthenticated, and available only with `pnpm dev`. Its page and AI-progress API use `.dev.tsx`/`.dev.ts`, excluded from production builds; admin UI is absent from production bundles and missing routes return 404. Server Actions reject production execution before reading inputs or doing work. Dev is not localhost-restricted; use a trusted network.

Never commit real API keys. Cloud generation sends source text to the provider and may incur charges.

## Tailwind Plus / Catalyst

Licensed Tailwind Plus source is a local reference in gitignored `.tailwind-plus/`, never a production import or committed catalog. Adapt needed components in `src/app/components/ui/` and commit app-owned code with required dependencies/theme/font setup.

## Documentation

Track bugs, improvements, and future ideas in GitHub Issues and this repository's Cultural Atlas Project. Backlog status records an idea without scheduling implementation; conditional work retains its revisit conditions in the issue.

[Product vision](docs/product/vision.md) · [Glossary](CONTEXT.md) · [Entity discovery](docs/entity-discovery.md)

# Cultural Atlas

Next.js 16 + React 19 visit companion for history, art, and culture. The map helps visitors choose a place; its Story explains why it matters.

## Getting Started

Use **pnpm only**.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Installation activates Husky: staged files are formatted with Prettier and staged JS/TS checked/fixed with ESLint. Run `pnpm lint` before a PR.

| Route | Purpose |
| --- | --- |
| `/` | Project home. |
| `/rome` | Visitor map. |
| `/rome?poiId=<id>` | Map with POI detail open. |
| `/admin` | Development-only editorial workflow. |

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Local server; generate the public snapshot first. |
| `pnpm build` | Generate the snapshot and production build. |
| `pnpm catalog:build` | Rebuild the snapshot independently. |
| `pnpm start` | Run the production server. |
| `pnpm lint` | ESLint. |
| `pnpm categories:rebuild` | Apply category rules to local city type snapshots. |

## Publication and deployment

Visitor routes/APIs read a build-generated public snapshot, never editorial files selected by request IDs. A POI needs valid versioned workflow-generated Story Content, a selected licensed/attributed Main Image, and saved records for every retained Related Person. Imported or metadata-only POIs are excluded. Explicit approval is optional future work; admin `Complete`, local Sources, generation logs, and acquired Types do not gate publication.

Deploy through Vercel's GitHub integration with `Papidev/historical-explorer` and production branch `main`. `vercel.json` configures the build; `package.json` pins pnpm and Node.js 24. Branch pushes create previews; `main` updates deploy production. Require existing CI checks before merging.

Commit POI catalogs, categories, Stories, image candidates/selection, and linked People. Builds generate gitignored `data/public/catalog.json`, embedded in the server build. Vercel needs no export step, local generated data, or AI credentials. Content becomes public on the next deployment.

Admin operations refresh the development snapshot. After directly editing content files, restart `pnpm dev` or run `pnpm catalog:build`. Tests also generate the snapshot automatically.

## Data layout

Versioned content lives under `data/<city>/`; rebuildable `generated/` outputs are ignored.

| Artifact | Location |
| --- | --- |
| Geo Place input | `data/<city>/pois/raw.geojson` |
| App-ready POIs | `data/<city>/pois/pois.geojson` |
| POI categories | `data/<city>/pois/categories.json` |
| Story Content and image candidates | `data/<city>/stories/<poi-id>/story.json`, `images.json` |
| Wikipedia text/source metadata | `data/<city>/generated/wikipedia/` |
| Acquired Wikidata Types | `data/<city>/generated/wikidata/` |
| Pipeline checkpoints/timings | `data/<city>/generated/generation-metadata.json` |
| Canonical People | `data/people/<person-id>/person.json` |

POI IDs are stable and app-owned; external IDs such as `wikidataId` are optional. `geoPlaceId` preserves the original feature identity, enabling regeneration without Wikidata. Legacy records recover it only from a unique exact name/geometry match. Admin shows one row per linked source and preserves existing duplicates.

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

### Manual Story batches

**Generate next 3** runs the first three matching To do Geo Places across all pages, or fewer if insufficient; disable when none match. No selection/confirmation is needed. One click starts one concurrent batch, then stops. Each POI has independent progress/outcome; one failure does not stop others.

Running rows stay pinned above other rows. The progress dialog can be hidden/reopened. The next click chooses the next matching To do POIs. Batches add no retries beyond existing cloud JSON/domain-validation retry.

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

Ollama Cloud does not support schema-constrained output. Story Content and new People include their schemas in the prompt and retry once when a response fails JSON or domain validation. Both use the selected Cloud model.

## Diagnostics

Local `data/rome/generated/generation-logs/day-*.jsonl` records start/completion/failure with shared run IDs. Seven daily slots rotate, overwriting data when reused after seven days. Admin shows latest-run errors beside artifacts and Related People errors in the People drawer. Known credentials are redacted; stack traces stay in the console. Logs are gitignored and not a durable cross-machine/deployment audit.

Admin shows current errors: newer successful checkpoints or successful operations supersede them. A failed refresh remains visible if its saved artifact is older; historical logs stay on disk. Completion uses current artifacts/errors, not obsolete failed runs.

Rejected AI output is saved in gitignored `data/generated/ai-response-failures/`: exact `rawResponse`, generation kind, subject identity, provider/model/mode, attempt, time, and validation error. Invalid provider JSON and content are captured even before a successful retry. Console output links the file; requests, keys, and headers are not stored. Diagnostic write failure preserves the original error.

Story generation uses `jsonrepair` for malformed JSON, including stray quotes before topic objects. Repaired output must pass Story schema and Source-ID validation; otherwise preserve normal error/retry behavior.

## Visitor map

The OpenFreeMap basemap shows cultural labels/icons: museums, monuments/memorials, castles/ruins, archaeology, worship, theatres, galleries, artworks, arts centres, and libraries. Other business/service/transit/sport POIs and generic attractions are hidden; roads, buildings, geographic labels, and curated markers remain.

A category discovery sidebar supports OR filtering and a collapsible mobile panel. See [POI Categories](docs/poi-categories.md#visitor-filtering) for defaults, counts, and religious subcategories, and [Entity Discovery](docs/entity-discovery.md) for planned search/Person navigation.

## Security Notes

Admin is temporary, unauthenticated, and available only with `pnpm dev`. Its page and AI-progress API use `.dev.tsx`/`.dev.ts`, excluded from production builds; admin UI is absent from production bundles and missing routes return 404. Server Actions reject production execution before reading inputs or doing work. Dev is not localhost-restricted; use a trusted network.

Never commit real API keys. Cloud generation sends source text to the provider and may incur charges.

## Tailwind Plus / Catalyst

Licensed Tailwind Plus source is a local reference in gitignored `.tailwind-plus/`, never a production import or committed catalog. Adapt needed components in `src/app/components/ui/` and commit app-owned code with required dependencies/theme/font setup.

## Documentation

[Product vision](docs/product/vision.md) · [Glossary](CONTEXT.md) · [Entity discovery](docs/entity-discovery.md) · [Backlog](docs/backlog.md)

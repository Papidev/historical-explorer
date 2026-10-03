# Cultural Atlas

Next.js 16 + React 19 app for exploring historical points of interest on an interactive map.

Cultural Atlas is a visit companion for cultural discovery across history, art, and culture: the map helps visitors pick a place, and the POI story explains why that place matters.

## Getting Started

Use **pnpm only**.

```bash
pnpm install
pnpm dev
```

`pnpm install` activates the Husky Git hooks. Before each commit, staged files are formatted with Prettier and staged JavaScript/TypeScript files are checked and fixed with ESLint. Run `pnpm lint` for a full-project check before opening a pull request.

Then open [http://localhost:3000](http://localhost:3000).

The Rome map reads its versioned POI catalog from `data/rome/pois/pois.geojson` and shows only POIs whose admin rows are green (Complete).

## Routes

- `/` - project home page.
- `/rome` - Rome visitor map.
- `/rome?poiId=<id>` - Rome visitor map with a POI detail panel opened.
- `/admin` - temporary local editorial workflow for generating POI data, Wikipedia snapshots, and Story content.

## Scripts

- `pnpm dev` - run the local development server.
- `pnpm build` - build for production.
- `pnpm start` - start the production server.
- `pnpm lint` - run ESLint.

## Tailwind Plus / Catalyst

The project uses Tailwind Plus as a local reference catalog, not as a runtime dependency. The paid source is not committed.

If you have a Tailwind Plus license, keep the downloaded source locally in `.tailwind-plus/`. That folder is gitignored on purpose and must not be imported by production code. When a Tailwind Plus or Catalyst component is useful, adapt only the app-specific component needed in `src/app/components/ui/` and commit that implementation together with any runtime dependencies and theme/font setup.

## Generated Data

For project glossary terms such as Geo Place, Draft Story, Sources, and Main Image, see `CONTEXT.md`.

Each city's data lives under `data/<city>/`. The Geo Place input and app-ready POI catalog live together in the city's `pois/` folder and are versioned. Rebuildable local outputs live under `generated/` and are intentionally not committed.

For Rome, the Geo Place input lives at `data/rome/pois/raw.geojson`, while app-ready POIs are progressively added to `data/rome/pois/pois.geojson`. Each app-ready POI has a stable, human-readable `id`; external identifiers such as `wikidataId` are optional and separate. The catalog preserves the original GeoJSON feature ID as `geoPlaceId`, so POIs without Wikidata stay linked to their source and regeneration reuses the existing POI. Legacy records can recover that link from a unique exact match of name and geometry. The admin table shows one row per linked source, while existing duplicate catalog records remain saved. Wikipedia Text snapshots and local Source metadata are generated into `data/rome/generated/wikipedia/`. Explicit English or Italian Wikipedia/Wikidata links take priority over name searches. Name-only matches require a primary Earth coordinate within 1 km of the POI and a supported physical-place geographic type; missing, distant, secondary, or broad-entity coordinates leave the POI waiting for a source. The 1 km tolerance allows small differences between POI centroids and article coordinates; it is a conservative safeguard, not proof of exact identity. If both name searches fail, geographic lookup examines up to 50 nearby articles in each Wikipedia edition using the same location and place-type checks. It accepts only one entity whose title, English translation, Wikidata label, or Wikidata alias matches the POI name; proximity alone never selects an article, and two language editions of the same Wikidata entity count as one candidate. Wikidata POI types are stored separately in `data/rome/generated/wikidata/`. Local pipeline timings and execution details live in `data/rome/generated/generation-metadata.json`.

The visitor map has a discovery sidebar with shared categories. Churches & cathedrals contains one level of subcategories: Cathedrals, Basilicas, and Churches. All available categories and subcategories start selected, with all places visible including uncategorized places. Subcategories start collapsed and can be expanded independently of selection. Categories and subcategories with no items are hidden. Selecting or clearing the group selects or clears all its children. Each place is counted in one child. A religious place named Basilica appears under Basilicas even when it is also a cathedral; Cathedrals requires Cathedral or Cattedrale in the name. Remaining churches appear under Churches. The child counts therefore sum to the group count. Select several categories to show places in any of them; clearing the selection shows all visitor-ready places, including uncategorized ones. Filtering out an open place closes its detail. On small screens, open Categories to show the collapsible sidebar.

`data/poi-type-category-map.json` contains versioned, cross-city rules for direct Wikidata type IDs. An absent rule is unmapped; an empty list explicitly ignores a type. The deduplicated category lists are saved by POI ID in `data/<city>/pois/categories.json`, separately from the GeoJSON catalog, acquired types, and Story Content. The server combines these lists with the catalog when loading POIs for the visitor map. Type acquisition/refresh and POI generation recompute categories. Religious basilica types map to Basilica; catalog names distinguish basilicas from cathedrals, and Cathedral requires Cathedral or Cattedrale in the name; civil basilica `Q2887138` is explicitly ignored and does not assign Basilica or Church. To apply changed rules to all existing city catalogs using their locally acquired type snapshots, run `pnpm categories:rebuild`. POIs with missing source types receive an empty category list and stay in the catalog. Curator mapping edits and individual exceptions are the follow-up slices #60 and #61.

The UI experiment for #59 was captured on the local branch `feat/category-filter-prototype-59`; the confirmed decision is the discovery sidebar, with a collapsible panel on mobile.

Generation attempts are logged locally in `data/rome/generated/generation-logs/day-*.jsonl`. Each line records a start, completion, or failure with a shared run ID. Seven daily files are reused in rotation: when a slot is used again after seven days, its old contents are overwritten. The Curator table shows the latest run and expandable errors beside the affected source, story, or image; Related People errors appear inside the People drawer. Error messages are stored with known credentials redacted; stack traces remain in the server console. These files are ignored by Git and are not a durable audit store across machines or deployments.

The admin has **POIs** and **People** tabs. People lists all generated records alphabetically, with image thumbnails, name search, and a full-detail drawer. The Linked POIs count is visible in the table; selecting it or the Person name opens the drawer with all linked POIs, derived from saved Story references. **Regenerate** uses the saved Wikipedia source and the selected AI model to replace a Person’s description, curiosities, and dates while preserving its ID, image, and Story links.

The admin POI table shows 50 rows per page. Status filters and name search apply to the complete list and return to the first page when changed. Search matches original and generated POI names without distinguishing uppercase and lowercase. Empty rows are To do; rows with generated artifacts, attempted generation, or errors remain Needs attention until complete. Rows waiting for source acquisition are Needs source; their generated POI and previously acquired Wikidata Types remain visible (unavailable types, Story Content, and Image Candidates keep neutral placeholders without generation controls), and their Wikipedia cell keeps the missing-source notice and any available error details visible after the toast closes.

Use Generate on an empty row or Refresh on an existing row in `/admin` to run the complete Rome generation flow:

1. Add app-ready POI metadata from the Geo Place.
2. Generate the Wikipedia Text snapshot and save any discovered Wikidata ID on the POI.
3. Refresh POI types using the Wikidata ID; log a skipped step when no ID is available.
4. Generate Main Image Candidates and select the first candidate with license and attribution.
5. Generate structured Story Content.

Refresh reruns this entire pipeline with the selected AI configuration and resolves the Wikipedia Source again from the POI. Existing artifacts remain if a temporary error interrupts regeneration. If no unambiguous English or Italian Wikipedia page can be resolved, the Curator marks its Story as waiting for a Source and removes that POI's saved Source, Story, and Main Image Candidates. Shared Person records and generation logs remain available.

Stories live under the city's `stories/` folder, with one directory per POI ID. For example, `data/rome/stories/forum-boarium/` contains structured Story Content in `story.json` and Main Image Candidates in `images.json`. Full Generate creates or replaces `story.json`, and the Curator UI provides preview, Refresh, and Delete actions for that content. These are reviewable content artifacts and should be committed after generation and human editing.

Wikipedia acquisition prefers a linked English page, then searches by the original POI name
on English Wikipedia. If that fails, it uses an Italian link or name search, preferring
that page's English language link when available. If only the Italian page exists,
it is used as the source while Story Content is still generated in English. Name
search accepts a unique matching title or redirect, and excludes disambiguation
pages rather than choosing an unrelated first result. Source URLs, image discovery,
and Related People links keep the language of the actual source.

Locally generated Wikipedia Sources use a text snapshot plus a metadata file containing the conventional `wikipedia` source ID, title, and URL. Source references are validated during generation and are shown in the Curator UI when the local Source is available, but are omitted from the public Story response.

Story status is not represented yet, so the same structure currently holds content whether it is still a draft or already finalized. When approval status is introduced, the visitor experience should only expose approved Stories.

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

## Security Notes

The current `/admin` route is temporary and has no authentication. Keep it for local development only; do not expose it publicly until access control is added.

Do not commit real API keys. Cloud AI generation sends source text to the configured provider and may incur paid usage.

### Manual Story batches

In the admin table, choose **Generate next 3** to generate the first three **To do**
Geo Places matching the current search and status filters, across all pages.
No row selection or confirmation is needed. If fewer than three remain, it generates
those remaining; the button is disabled when none match. Each click starts one batch
and stops, without automatically starting further POIs. The server runs the batch
concurrently through the same workflow as the row action. Each POI has its own
progress log and outcome; a failed POI does not stop the others. Running rows stay
pinned above the other rows. Batch progress and outcomes open in a dialog that can
be hidden and reopened. The next click picks the next matching To do POIs.
The batch adds no automatic retries; the existing cloud JSON/domain-validation
retry remains part of each Story or Person generation.

Concurrency guards support one local server process: up to three POI operations,
one mutation per POI, and one pending Person generation per Wikidata ID. Person
IDs are allocated immediately before saving. Shared catalog and generation metadata
updates remain synchronous on the filesystem. Multiple server processes or machines
would require shared coordination before using this storage safely.

Rejected AI responses are saved locally in
`data/generated/ai-response-failures/` (ignored by Git). Each unique JSON file
contains the exact HTTP response body in `rawResponse`, generation kind, POI or
Person identity, provider, model, mode, attempt number, timestamp, and validation
error. Both invalid provider JSON and invalid generated content are captured,
including an invalid attempt followed by a successful retry. The server console
prints the saved path. Requests, API keys, and headers are not captured. Diagnostic
write failures do not replace the original generation error.

The admin shows only current generation errors. Errors are superseded by a newer
successful checkpoint for the affected artifact or a successful run of the same
operation. A failed refresh remains visible when the saved artifact is older.
Historical logs remain on disk. Row completion follows current artifacts and
current errors rather than an obsolete failed run.

Story generation attempts to recover malformed model JSON with `jsonrepair`, including stray quotes before topic objects. Recovered output must still pass the complete Story schema and source-ID validation; otherwise the original parsing error and retry behavior are preserved.

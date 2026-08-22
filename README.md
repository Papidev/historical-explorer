# Historical Explorer

Next.js 16 + React 19 app for exploring historical points of interest on an interactive map.

Historical Explorer is a visit companion for cultural discovery: the map helps visitors pick a place, and the POI story explains why that place matters.

## Getting Started

Use **pnpm only**.

```bash
pnpm install
pnpm dev
```

`pnpm install` activates the Husky Git hooks. Before each commit, staged files are formatted with Prettier and staged JavaScript/TypeScript files are checked and fixed with ESLint. Run `pnpm lint` for a full-project check before opening a pull request.

Then open [http://localhost:3000](http://localhost:3000).

The Rome map reads its versioned POI catalog from `data/rome/pois/pois.geojson`.

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

The project is prepared to use Tailwind Plus Catalyst, but the paid Catalyst source is not committed.

If you have a Tailwind Plus license, keep the copied Catalyst components locally in `src/app/components/catalyst/`. That folder is gitignored on purpose. Do not commit copied Catalyst source files; commit only app-specific code, runtime dependencies, and theme/font setup.

## Generated Data

For project glossary terms such as Geo Place, Draft Story, Sources, and Main Image, see `CONTEXT.md`.

Each city's data lives under `data/<city>/`. The Geo Place input and app-ready POI catalog live together in the city's `pois/` folder and are versioned. Rebuildable local outputs live under `generated/` and are intentionally not committed.

For Rome, the Geo Place input lives at `data/rome/pois/raw.geojson`, while app-ready POIs are progressively added to `data/rome/pois/pois.geojson`. Each app-ready POI has a stable, human-readable `id`; external identifiers such as `wikidataId` are optional and separate. Wikipedia Text snapshots are generated into `data/rome/generated/wiki/`, while local pipeline timings and execution details live in `data/rome/generated/generation-metadata.json`.

Use the single Generate action in `/admin` to run the current Rome generation flow:

1. Add app-ready POI metadata from the Geo Place.
2. Generate the Wikipedia Text snapshot.
3. Generate Main Image Candidates and select the first candidate with license and attribution.
4. Generate the Story markdown.

Stories live under the city's `stories/` folder, with one directory per POI ID. For example, `data/rome/stories/forum-boarium/` contains the Story prose in `story.md` and its Main Image Candidates in `images.json`. These are reviewable content artifacts and should be committed after generation and human editing.

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

`AI_MODE` controls the initial admin selector value. Local currently maps to Ollama, and Cloud currently maps to Gemini. Local generation expects Ollama to be running with the configured model available. Cloud generation requires `GEMINI_API_KEY`.

## Security Notes

The current `/admin` route is temporary and has no authentication. Keep it for local development only; do not expose it publicly until access control is added.

Do not commit real API keys. Cloud AI generation sends source text to Gemini and may incur paid usage.

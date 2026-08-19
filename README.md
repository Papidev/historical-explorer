# Historical Explorer

Next.js 16 + React 19 app for exploring historical points of interest on an interactive map.

Historical Explorer is a visit companion for cultural discovery: the map helps visitors pick a place, and the POI story explains why that place matters.

## Getting Started

Use **pnpm only**.

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

The Rome map reads generated POI data from `data/rome/generated/pois.geojson`. That folder is intentionally gitignored, so a fresh checkout may need local generation from the admin UI before map markers appear.

## Routes

- `/` - project home page.
- `/rome` - Rome visitor map.
- `/rome?poiId=<id>` - Rome visitor map with a POI detail panel opened.
- `/admin` - temporary local editorial workflow for generating POI data, Wikipedia snapshots, and draft story markdown.

## Scripts

- `pnpm dev` - run the local development server.
- `pnpm build` - build for production.
- `pnpm start` - start the production server.
- `pnpm lint` - run ESLint.

## Tailwind Plus / Catalyst

The project is prepared to use Tailwind Plus Catalyst, but the paid Catalyst source is not committed.

If you have a Tailwind Plus license, keep the copied Catalyst components locally in `src/app/components/catalyst/`. That folder is gitignored on purpose. Do not commit copied Catalyst source files; commit only app-specific code, runtime dependencies, and theme/font setup.

## Generated Data

For project glossary terms such as Raw POI, Draft Story, Sources, and Main Image, see `CONTEXT.md`.

Each city's data lives under `data/<city>/`. Raw POI input lives in that city's `raw/` folder, while generated local-dev outputs live under `generated/` and are intentionally not committed.

For Rome, the Raw POI input lives at `data/rome/raw/pois.geojson`. Generated POI GeoJSON is written to `data/rome/generated/pois.geojson`, and Wikipedia Text snapshots are generated into `data/rome/generated/wiki/`.

Use `/admin` to run the current Rome generation flow:

1. Generate transformed POI JSON from the Raw POI.
2. Generate the Wikipedia Text snapshot.
3. Generate the AI draft story markdown.

Draft stories generated from the Wikipedia snapshot live as `.md` files in the city's `wiki-ai/` folder, such as `data/rome/wiki-ai/`. They are named with both the POI id and a readable slug, for example `q283650--forum-boarium.md`. Unlike the generated source snapshots, this is a reviewable content artifact and should be committed after AI generation and human editing.
Today these files contain draft story prose; the broader Draft Story will also include Sources and a proposed Main Image as the workflow grows. Main Image Candidates should live beside the draft story prose as `.images.json` files in the city's `wiki-ai/` folder; these files are also reviewable workflow artifacts and should be committed after generation and curator selection.

For now, the filesystem is the only cache for generated POI data. If repeated reads of `data/rome/generated/pois.geojson` become expensive, consider adding a small in-memory read-through cache with filesystem `mtime` invalidation.

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

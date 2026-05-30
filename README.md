# Historical Explorer

Next.js 16 + React 19 app for exploring historical points of interest on an interactive map.

## Getting Started

Use **pnpm only**.

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

- `pnpm dev` - run the local development server.
- `pnpm build` - build for production.
- `pnpm start` - start the production server.
- `pnpm lint` - run ESLint.

## Generated Data

For project glossary terms such as Raw POI, Draft Story, Sources, and Main Image, see `CONTEXT.md`.

## AI Configuration

Admin AI actions use the new Local/Cloud configuration variables:

```bash
AI_MODE=cloud
LOCAL_AI_PROVIDER=ollama
LOCAL_AI_MODEL=qwen3:8b
CLOUD_AI_PROVIDER=gemini
CLOUD_AI_MODEL=gemini-2.5-flash
```

`AI_MODE` controls the initial admin selector value. Local currently maps to Ollama, and Cloud currently maps to Gemini.

Raw POI input lives in `public/data/raw/`. Generated local-dev outputs live under `data/generated/` and are intentionally not committed.

Each city has its own generated folder. For Rome, POI GeoJSON generated from Raw POI input is written to `data/generated/rome/pois.geojson`, and Wikipedia Text snapshots are generated into `data/generated/rome/wiki/`. They can be recreated by running the admin generation flows again.

Draft stories generated from the Wikipedia snapshot live as `.md` files in `data/wiki-ai/`, named with both the POI id and a readable slug, for example `q283650--forum-boarium.md`. Unlike the generated source snapshots, this is a reviewable content artifact and should be committed after AI generation and human editing.
Today these files contain draft story prose; the broader Draft Story will also include Sources and a proposed Main Image as the workflow grows.

For now, the filesystem is the only cache for generated POI data. If repeated reads of `data/generated/rome/pois.geojson` become expensive, consider adding a small in-memory read-through cache with filesystem `mtime` invalidation.

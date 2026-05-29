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

Raw POI input lives in `public/data/raw/`. Generated local-dev outputs live under `data/generated/` and are intentionally not committed.

Each city has its own generated folder. For Rome, POI GeoJSON generated from Raw POI input is written to `data/generated/rome/pois.geojson`, and Wikipedia Text snapshots are generated into `data/generated/rome/wiki/`. They can be recreated by running the admin generation flows again.

Draft stories generated from the Wikipedia snapshot live as `.md` files in `data/wiki-ai/`, named with both the POI id and a readable slug, for example `q283650--forum-boarium.md`. Unlike the generated source snapshots, this is a reviewable content artifact and should be committed after AI generation and human editing.
Today these files contain draft story prose; the broader Draft Story will also include Sources and a proposed Main Image as the workflow grows.

For now, the filesystem is the only cache for generated POI data. If repeated reads of `data/generated/rome/pois.geojson` become expensive, consider adding a small in-memory read-through cache with filesystem `mtime` invalidation.

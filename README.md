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

Raw POI input lives in `public/data/raw/`. The polished local-dev GeoJSON is generated into `data/generated/` and is intentionally not committed.

For now, the filesystem is the only cache for generated POI data. If repeated reads of `data/generated/rome-pois.geojson` become expensive, consider adding a small in-memory read-through cache with filesystem `mtime` invalidation.

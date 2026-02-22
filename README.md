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

## Wiki to MDX Pipeline (Single POI)

Use the unified command when generating content for a single POI:

```bash
pnpm wiki:sync --city <city-slug> --poi-id <poi-id>
```

This runs both steps in sequence:

1. `wiki:bootstrap` (fetches and stores wiki snapshot JSON in `data/wiki/`)
2. `wiki:to-mdx` (converts the snapshot into MDX under `content/pois/<city-slug>/`)

Optional flags:

- `--force` overwrite existing JSON/MDX output
- `--geojson <path>` custom GeoJSON input path
- `--wiki-dir <path>` custom wiki JSON directory
- `--output-dir <path>` custom MDX output directory

Example:

```bash
pnpm wiki:sync --city rome --poi-id 2505 --force
```

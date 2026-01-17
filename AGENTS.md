# Repository Guidelines

## Project Structure & Module Organization
This Next.js 16 App Router project keeps layouts, global styles, and routes in `src/app`; feature folders such as `src/app/rome` should colocate their pages, loaders, and feature-specific helpers. Shared UI and map utilities belong in `src/app/components` (e.g., `Map`, `RomeMap`), while future cross-route helpers can move into `src/lib`. Static assets (logos, sprites, map tiles) live in `public/`, and configuration stays at the repo root (ESLint, Tailwind, TS, Prettier). When adding data, place JSON or GeoJSON under `data/` and document the schema inside the feature folder.

## Build, Test, and Development Commands
- `npm run dev` — start the hot-reloading Next dev server for local validation of new scenes or map interactions.
- `npm run build` — generate the production bundle; run before any release or PR to catch TypeScript issues.
- `npm run start` — serve the optimized build for a quick smoke test.
- `npm run lint` — apply ESLint + Prettier rules, including import sorting and Tailwind class ordering.
- Always verify `npm run dev` boots without runtime errors before finalizing or proposing any implementation.

## Coding Style & Naming Conventions
Write all code in TypeScript with strict typing of props and map configuration objects. Components, hooks, and providers use PascalCase filenames (`RomeMap.tsx`), hooks start with `use`, and utility files use camelCase exports. Styling relies on Tailwind utility classes defined through the v4 `@import "tailwindcss"` entry in `globals.css`. Run Prettier (2-space indent, double quotes, trailing commas) to keep formatting consistent with `prettier-plugin-tailwindcss` and `@ianvs/prettier-plugin-sort-imports`. Address accessibility warnings surfaced by the Next `core-web-vitals` ESLint ruleset.

## Architecture & Domain Principles
Model features around domain concepts (e.g., POIs, timelines) and encapsulate business rules close to the data source, but avoid over-engineering—prefer simple modules, plain objects, and cohesive helpers that clearly express ubiquitous language without introducing unnecessary layers.

## Testing Guidelines
While no harness is bundled, add colocated `*.test.tsx` files (Vitest/Jest) for new components, and stub MapLibre outputs with deterministic coordinates. Always run `npm run dev` to manually check zoom, pan, and control affordances plus ensure there are no TypeScript errors. Record any manual steps in the PR description when automated coverage is absent.

## Commit & Pull Request Guidelines
Write short, imperative commit subjects ("Refine Rome map data", "Add lint rule") and keep formatting-only changes separate from feature work. Each PR should summarize the change, link the issue/ticket, attach UI screenshots or short clips for visual updates, and list executed commands (`dev`, `build`, `lint`, manual map test). Note environment variables or data sources added, and wait for all local checks before requesting review.

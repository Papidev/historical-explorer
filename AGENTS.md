# AGENTS – Implementation Notes

## Current Stack & Entry Points
- Next.js 16 App Router + React 19 live entirely under `src/app`; `src/app/page.tsx` renders the landing narrative, while `src/app/rome/page.tsx` mounts the interactive view.
- Tailwind CSS v4 is imported once from `src/app/globals.css`; custom colors/fonts piggyback on CSS variables set there and the Geist font pair configured in `layout.tsx`.
- Map rendering relies on `maplibre-gl@5` plus a thin adapter (`src/app/components/Map`) that isolates MapLibre lifecycle code from React. Always treat `Map` as a `"use client"` component and keep imperative map logic inside the adapter.

## Directory Highlights
- `src/app/components/Map/` – generic map wrapper (`index.tsx`) and the MapLibre adapter (`mapAdapter.ts`) that handles mount/destroy, `NavigationControl`, and popup markup.
- `src/app/components/RomeMap.tsx` – example feature component that wires the map to POIs loaded for Rome.
- `src/utils/index.ts` – `createPoisForCity` plus helpers for slugging city names, reading `public/data/<slug>-pois.geojson`, coercing GeoJSON features into the strongly typed `Poi` shape, and inferring fallbacks.
- `src/types/Poi` – canonical POI contract (`id`, `name`, `city`, `coordinates`, `period`, `shortDescription`, `funFacts`). Extend this first if new UI needs more fields.
- `public/data/` – runtime GeoJSON bundles consumed by the app; keep raw exports or scratch data under top-level `data/` if you need to preprocess outside the build.

## POI & Map Data Flow
1. A feature component (e.g., `RomeMap`) calls `createPoisForCity("rome")`. The helper slugifies city names (`rome` → `rome-pois.geojson`), reads the GeoJSON file synchronously on the server, and filters out non-`Point` features.
2. Each feature becomes a `Poi`. Missing ids fall back to `poi-<index>` or the `@id` tag; `name`, `period`, and `shortDescription` look at multiple OSM keys before falling back to friendly defaults to keep the UI resilient.
3. The `Map` client component mounts MapLibre once per page load, updates the view via `easeTo`, and re-syncs markers whenever the POI array changes. Popup HTML currently shows `name`, `period`, and `shortDescription`; adjust `createMarker` inside `mapAdapter.ts` for richer UI.
4. Map style defaults to `https://tiles.openfreemap.org/styles/liberty`. Change the constant in the adapter if we ever swap basemaps.

### Adding a New City
- Drop a GeoJSON export at `public/data/<city-slug>-pois.geojson` (slug logic matches `toCitySlug` in `src/utils/index.ts`). Only `Point` geometries render markers; convert polygons/lines to representative points upstream if needed.
- Create `<CityName>Map.tsx` next to `RomeMap.tsx` that calls `createPoisForCity("<city>")` and passes the right `[lng, lat]`/`zoom` to `Map`.
- Add a route at `src/app/<city>/page.tsx` to mount the new map and any descriptive copy.

## Tooling & Commands
- Use `pnpm install` to fetch deps, then the standard scripts: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`. The dev server must boot without runtime or TypeScript errors before shipping changes.
- `pnpm lint` runs `eslint@9` with the Next `core-web-vitals` rules plus `eslint-config-prettier` to keep formatting conflicts out.
- Prettier is configured with `prettier-plugin-tailwindcss` and `@ianvs/prettier-plugin-sort-imports`; rely on `pnpm prettier --write` or your editor integration so imports stay grouped and Tailwind classes remain sorted.

## Coding Standards & A11y
- Write new components/hooks in TypeScript using PascalCase filenames; keep shared UI under `src/app/components` and domain-specific helpers beside their routes until they merit a shared home in `src/lib`.
- Favor a lightweight Domain-Driven Design mindset: model features around the domain language (cities, POIs, timelines) and keep logic close to the data source, but resist extra indirection unless it delivers clear value.
- Keep React components declarative and push imperative map logic into adapters/utilities. Any `maplibre-gl` interaction must guard against double-mounts and clean up markers in `destroy()`.
- Avoid `useMemo`, `useCallback`, and similar micro-optimizations unless there's a measured need; rely on the React Compiler and keep code straightforward.
- Apply TypeScript’s quick-fix suggestions where feasible, especially for type safety and nullability, unless they conflict with product or UX intent.
- Tailwind is the default styling layer—extend via `@theme` tokens in `globals.css` instead of ad-hoc CSS when possible. Ensure interactive elements pass accessible names and color contrast checks surfaced by Next linting.

## Testing & Verification
- There is no automated map test harness yet; add colocated `*.test.tsx` files when introducing logic-heavy components and stub MapLibre APIs if needed.
- Always: (1) run `pnpm dev` to verify Rome loads, pan/zoom controls work, and new POIs render; (2) run `pnpm lint`; (3) run `pnpm build` before raising a PR.
- Document any manual QA (e.g., “verified zoom-to markers on Chrome + Safari”) in PR descriptions until automated coverage exists.

## Commits & PR Hygiene
- Use short, imperative commit subjects ("Add Alexandria map data"). Keep formatting-only commits separate from feature work so reviewers can skim diffs quickly.
- PRs should summarize the change, call out new data sources or env vars, include screenshots/recordings for UI updates, and list executed commands (`dev`, `build`, `lint`, manual map QA). Wait for local checks to finish before requesting review.

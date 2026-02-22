# AGENTS – Implementation Notes

## Before Starting Work
- Always work on a branch, never on `main`.
- Check your current branch with `git branch --show-current`.
- If needed, create a branch before coding (example: `git checkout -b feat/<short-name>`).

## Current Stack & Entry Points
- Next.js 16 App Router + React 19 live entirely under `src/app`; `src/app/page.tsx` renders the landing narrative, while `src/app/rome/page.tsx` mounts the interactive view.
- Tailwind CSS v4 is imported once from `src/app/globals.css`; custom colors/fonts piggyback on CSS variables set there and the Geist font pair configured in `layout.tsx`.
- Map rendering relies on `maplibre-gl@5` plus a thin adapter (`src/app/components/Map`) that isolates MapLibre lifecycle code from React. Always treat `Map` as a `"use client"` component and keep imperative map logic inside the adapter.
- POI long-form content is MDX-driven via `next-mdx-remote` (`serialize` on the server, `MDXRemote` on the client). Naming convention is strict: use `content_slug` in GeoJSON and store content at `content/pois/<city-slug>/<content-slug>.mdx`.

## Directory Highlights
- `src/app/components/Map/` – generic map wrapper (`index.tsx`) and the MapLibre adapter (`mapAdapter.ts`) that handles mount/destroy, `NavigationControl`, and popup markup.
- `src/app/components/RomeMap.tsx` + `src/app/components/RomeMapClient.tsx` – server/client split: server loads POIs, client owns map state and the details panel UI.
- `src/app/components/mdx/Callout.tsx` – custom MDX component used inside POI detail content.
- `src/utils/index.ts` – async `createPoisForCity` plus helpers for slugging city names, reading `public/data/<slug>-pois.geojson`, coercing GeoJSON features into the strongly typed `Poi` shape, and loading optional MDX content from `content_slug`.
- `src/types/Poi` – canonical POI contract (`id`, optional `contentSlug`, `name`, `city`, `coordinates`, `period`, `shortDescription`, `funFacts`). Extend this first if new UI needs more fields.
- `public/data/` – runtime GeoJSON bundles consumed by the app; keep raw exports or scratch data under top-level `data/` if you need to preprocess outside the build.
- `content/pois/` – optional per-POI MDX detail content keyed by city slug and POI id.

## POI & Map Data Flow
1. A server feature component (e.g., `RomeMap`) calls async `createPoisForCity("rome")`. The helper slugifies city names (`rome` → `rome-pois.geojson`), reads the GeoJSON file on the server, and filters out non-`Point` features.
2. Each feature becomes a `Poi`. Missing ids fall back to `poi-<index>` or the `@id` tag; `name`, `period`, and `shortDescription` look at multiple OSM keys before falling back to friendly defaults to keep the UI resilient.
3. POI details request optional MDX content on demand through `/api/pois/<city>/<poiId>/dialog-content?contentSlug=<content-slug>`. The server resolves only `content/pois/<city-slug>/<content-slug>.mdx` (no id/name fallbacks). Missing/empty/invalid MDX should fail soft (no runtime throw, just no extra content).
4. The `Map` client component mounts MapLibre once per page load, updates the view via `easeTo`, and re-syncs markers whenever the POI array changes. Popup HTML currently includes a details trigger button (`data-poi-open-details`); keep click handling delegated in the adapter.
5. Map style defaults to `https://tiles.openfreemap.org/styles/liberty`. Change the constant in the adapter if we ever swap basemaps.

### Adding a New City
- Drop a GeoJSON export at `public/data/<city-slug>-pois.geojson` (slug logic matches `toCitySlug` in `src/utils/index.ts`). Only `Point` geometries render markers; convert polygons/lines to representative points upstream if needed.
- Create `<CityName>Map.tsx` (server) next to `RomeMap.tsx` that calls `createPoisForCity("<city>")`, then pass POIs and view defaults into a client component (pattern: `RomeMapClient.tsx`).
- Add `content_slug` to each POI that needs long-form details, and create the matching file at `content/pois/<city-slug>/<content-slug>.mdx`.
- Add a route at `src/app/<city>/page.tsx` to mount the new map and any descriptive copy.

## Tooling & Commands
- Use `pnpm` exclusively for dependency management and scripts (do not use npm or yarn).
- Use `pnpm install` to fetch deps, then the standard scripts: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`. The dev server must boot without runtime or TypeScript errors before shipping changes.
- If dependency installation fails, stop immediately and ask for help. Do not continue with alternative approaches intended to bypass the failed installation.
- Wiki content pipeline for a single POI: prefer `pnpm wiki:sync --city <city-slug> --poi-id <poi-id>` to run fetch + MDX conversion in one command.
- Keep lower-level scripts for focused debugging: `pnpm wiki:bootstrap` (snapshot fetch) and `pnpm wiki:to-mdx` (JSON to MDX conversion).
- `pnpm lint` runs ESLint with the Next `core-web-vitals` rules plus `eslint-config-prettier` to keep formatting conflicts out.
- Prettier is configured with `prettier-plugin-tailwindcss` and `@ianvs/prettier-plugin-sort-imports`; rely on `pnpm prettier --write` or your editor integration so imports stay grouped and Tailwind classes remain sorted.

## Coding Standards & A11y
- Write new components/hooks in TypeScript using PascalCase filenames; keep shared UI under `src/app/components` and domain-specific helpers beside their routes until they merit a shared home in `src/lib`.
- Use `camelCase` for variables/functions, `PascalCase` for components/types/interfaces, and `SCREAMING_SNAKE_CASE` for constants.
- Name hooks with a `use` prefix and factory helpers with a `create` prefix.
- Favor a lightweight Domain-Driven Design mindset: model features around the domain language (cities, POIs, timelines) and keep logic close to the data source, but resist extra indirection unless it delivers clear value.
- Keep React components declarative and push imperative map logic into adapters/utilities. Any `maplibre-gl` interaction must guard against double-mounts and clean up markers in `destroy()`.
- Keep MDX boundaries strict: read and `serialize` MDX only in server code (`src/utils`/server components), and render with `MDXRemote` only in client components.
- Avoid `useMemo`, `useCallback`, and similar micro-optimizations unless there's a measured need; rely on the React Compiler and keep code straightforward.
- Apply TypeScript’s quick-fix suggestions where feasible, especially for type safety and nullability, unless they conflict with product or UX intent.
- Tailwind is the default styling layer—extend via `@theme` tokens in `globals.css` instead of ad-hoc CSS when possible. Ensure interactive elements pass accessible names and color contrast checks surfaced by Next linting.

## Feature Implementation Approach
- Build every feature in small intermediate steps that can be tested end-to-end.
- Start with the thinnest vertical slice that works, then iterate.
- Before starting dense implementations, first check whether a consolidated, widely used, and up-to-date dependency can solve the problem.
- Prefer adopting proven dependencies over re-inventing the wheel when the tradeoffs are acceptable for this project.
- Prefer extending existing files/components before introducing new abstractions.
- Keep data flow explicit and local; avoid “smart” indirection unless it clearly reduces complexity.
- After each step, run the smallest useful verification (`dev` manual check, then `build`/`lint` as needed) before moving on.
- If a simpler solution exists with similar behavior, choose the simpler one.
- When a feature is stable enough (behavior/API unlikely to change soon), update documentation accordingly: `README.md` for user/developer usage and `AGENTS.md` for implementation guidance/process updates.

## Testing & Verification
- Do not write automated tests prematurely; add or expand tests only after the feature behavior and API shape are stable enough to avoid churn.
- There is no automated map test harness yet; add colocated `*.test.tsx` files when introducing logic-heavy components and stub MapLibre APIs if needed.
- Keep tests user-centric: verify visible behavior, interactions, and outcomes rather than implementation details.
- Prefer accessible queries (for example `getByRole`, `getByLabelText`) and avoid brittle selectors.
- Minimize mocking; only mock network boundaries when needed, and otherwise test real component behavior.
- Always: (1) run `pnpm dev` to verify Rome loads, pan/zoom controls work, POI popup "Apri dettagli" opens the side panel, and MDX content renders when present; (2) run `pnpm lint`; (3) run `pnpm build` before raising a PR.
- Document any manual QA (e.g., “verified zoom-to markers on Chrome + Safari”) in PR descriptions until automated coverage exists.

## Commits & PR Hygiene
- Use short, imperative commit subjects ("Add Alexandria map data"). Keep formatting-only commits separate from feature work so reviewers can skim diffs quickly.
- PRs should summarize the change, call out new data sources or env vars, include screenshots/recordings for UI updates, and list executed commands (`dev`, `build`, `lint`, manual map QA). Wait for local checks to finish before requesting review.

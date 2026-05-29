# AGENTS – Implementation Notes

## Product Context

- For product context, read `docs/product/vision.md` before making architecture or UX decisions.

## Before Starting Work

- Always work on a branch, never on `main`.
- If needed, create a branch before coding (example: `git checkout -b feat/<short-name>`).

## Tooling & Commands

- Use `pnpm` exclusively for dependency management and scripts (do not use npm or yarn).
- If dependency installation fails, stop immediately and ask for help. Do not continue with alternative approaches intended to bypass the failed installation.
- `pnpm lint` runs ESLint with the Next `core-web-vitals` rules plus `eslint-config-prettier` to keep formatting conflicts out.
- During iteration, run the smallest useful verification; `pnpm lint` is a required final gate before handoff/PR, not after every tiny edit.
- `pnpm lint` is not a full TypeScript type-check in this repo; when touching TS-heavy logic, also run `pnpm build` (or `tsc --noEmit` if a script is available) before considering the change complete.
- Prettier is configured with `prettier-plugin-tailwindcss`; rely on `pnpm prettier --write` or your editor integration so Tailwind classes remain sorted.

## Coding Standards & A11y

- Favor a lightweight Domain-Driven Design mindset: model features around the domain language (cities, POIs, timelines) and keep logic close to the data source, but resist extra indirection unless it delivers clear value.
- Keep React components declarative and push imperative map logic into adapters/utilities. Any `maplibre-gl` interaction must guard against double-mounts and clean up markers in `destroy()`.
- Apply TypeScript’s quick-fix suggestions where feasible, especially for type safety and nullability, unless they conflict with product or UX intent.

## Feature Implementation Approach

- Build every feature in small intermediate steps that can be tested end-to-end.
- Start with the thinnest vertical slice that works, then iterate.
- Before starting dense implementations, first check whether a consolidated, widely used, and up-to-date dependency can solve the problem.
- Prefer adopting proven dependencies over re-inventing the wheel when the tradeoffs are acceptable for this project.
- Keep data flow explicit and local; avoid “smart” indirection unless it clearly reduces complexity.
- After each step, run the smallest useful verification (`dev` manual check) before moving on.
- When a feature is stable enough (behavior/API unlikely to change soon), update documentation accordingly: `README.md` for user/developer usage and `AGENTS.md` for implementation guidance/process updates.

Update `AGENTS.md` only with important stuff that cannot be clearly/quickly derived from an exploration of the codebase.

## Wikipedia Pipeline Notes

- Before implementing Wikipedia parsing, enrichment, conversion, or output logic, check whether `wtf_wikipedia` already has an external plugin that covers the need. Potentially useful plugins include `markdown` for conversion experiments, `image` for richer detail panels, `classify` for category filtering, `summary` for short descriptions, and `i18n` if ingesting non-English articles directly.

## Testing & Verification

- There is no automated map test harness yet; add colocated `*.test.tsx` files when introducing logic-heavy components and stub MapLibre APIs if needed.
- Keep tests user-centric: verify visible behavior, interactions, and outcomes rather than implementation details.
- Prefer accessible queries (for example `getByRole`, `getByLabelText`) and avoid brittle selectors.
- Always: (1) run `pnpm dev` to verify Rome loads, pan/zoom controls work, POI popup "Apri dettagli" opens the side panel, and Draft Story content renders when present; (2) run `pnpm lint`; (3) run `pnpm build` before raising a PR.
- Document any manual QA (e.g., “verified zoom-to markers on Chrome + Safari”) in PR descriptions until automated coverage exists.

## Commits & PR Hygiene

- Use short, imperative commit subjects ("Add Alexandria map data"). Keep formatting-only commits separate from feature work so reviewers can skim diffs quickly.
- For push/publish requests, use the repo-local `push-branch` skill to decide whether a generic local branch should be renamed before creating the remote branch.
- For pull request creation, use the repo-local `pr-generation` skill for title, body, review state, and assignment conventions.

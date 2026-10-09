# AGENTS – Implementation Notes

## Product Context

- For product context, read `docs/product/vision.md` before making architecture or UX decisions.

## Before Starting Work

- Before starting further work on the current branch, check whether its pull request has already been merged. If it has, create a new `feat/` branch from updated `main` before making any changes, even if the current branch still exists locally. Check the PR's merge status rather than Git ancestry, because squash merges do not preserve the branch commits.
- Always work on a branch, never on `main`.
- Before creating a feature branch, fetch `origin/main` and verify that local `main` points to the same commit. If they differ, align `main` before creating the branch.
- If needed, create a branch before coding (example: `git checkout -b feat/<short-name>`).

## Worktree Lifecycle

- When creating a worktree, copy all local resources from the source checkout: environment files, every uncommitted file and directory under `data/` (including modified tracked files, untracked files, and ignored files), `.tailwind-plus/`, Catalyst references, and any other uncommitted local libraries or assets. Preserve directory structure and contents, keep ignored resources uncommitted, and verify that all resources are present before starting work.
- After the task is complete and its PR is confirmed merged, stop the application and any task processes started from that worktree, including their child processes. Identify processes by their association with the worktree and leave applications running from other checkouts alone.
- Before removing the worktree, preserve its local resources and any remaining uncommitted work in the main checkout or a recoverable backup. If the destination contains different content, ask the user before overwriting it. Managed worktree archives exclude ignored files, so preserve those separately and verify the copy before archiving.
- Once processes are stopped and local resources are preserved, remove the entire task worktree and its registration; use the Codex archive tool for managed worktrees. A completed task with a merged PR must leave no running application or worktree directory behind.

## Tooling & Commands

- Local-only admin route entrypoints use `.dev.tsx` / `.dev.ts`; `next.config.ts` recognizes these extensions only in the development-server phase. Keep public route entrypoints on the standard extensions, and avoid importing admin UI or Server Actions from public routes so they stay out of production bundles.
- Public routes read only the build-generated public catalog. Publication is currently implicit from versioned Story Content, a licensed and attributed selected Main Image, and resolved saved People; do not use local pipeline `Complete` status or generated Sources as a publication gate. Keep snapshot generation out of production request handlers.
- Use `pnpm` exclusively for dependency management and scripts (do not use npm or yarn).
- If dependency installation fails, stop immediately and ask for help. Do not continue with alternative approaches intended to bypass the failed installation.
- `pnpm lint` runs ESLint with the Next `core-web-vitals` rules plus `eslint-config-prettier` to keep formatting conflicts out.
- During iteration, run the smallest useful verification. Run linting and formatting only immediately before opening a PR.
- `pnpm lint` is not a full TypeScript type-check in this repo; when touching TS-heavy logic, also run `pnpm build` (or `tsc --noEmit` if a script is available) before considering the change complete.

## Tailwind Plus / Catalyst

- `.tailwind-plus/` contains paid Tailwind Plus source when present locally and is intentionally gitignored. Treat it only as a reference catalog and never import it from production code.
- `src/app/components/ui/` contains committed, app-owned base components built from or inspired by Tailwind Plus examples.
- Do not commit the local Tailwind Plus catalog. Commit only app-specific components needed by this product, and keep paid source material available only on licensed development machines.
- The repo may commit Catalyst runtime dependencies, Tailwind theme/font setup, and app-specific components built from or inspired by Catalyst or Tailwind Plus examples.
- Before building UI, first check `src/app/components/ui/` for a matching app-owned component.
- If none fits, inspect Tailwind Plus UI Blocks through the authenticated Chrome session and evaluate the available React variants before designing the component.
- Check the local Catalyst reference after UI Blocks when lower-level primitives are needed, then implement only the app-owned adaptation in `src/app/components/ui/` or the relevant feature.

## Coding Standards & A11y

- Keep all user-facing application copy in English until localization support is introduced.
- When a UI module grows into multiple implementation files, place it in a folder named after its public component. Put the public component implementation in `index.tsx` (for example `PoiRowsTable/index.tsx` exports `PoiRowsTable`); use short contextual names for private files and components (for example `Row.tsx` exports `Row`) instead of repeating the public prefix. The index file should own the implementation rather than act as a barrel that only re-exports other files.
- Compose React components from focused child components when distinct UI sections make the parent hard to read. Keep the parent responsible for structure and shared state, and keep each child responsible for its own content and actions; place non-trivial children in separate files.
- Favor a lightweight Domain-Driven Design mindset: model features around the domain language (cities, POIs, timelines) and keep logic close to the data source, but resist extra indirection unless it delivers clear value.
- Keep React components declarative and push imperative map logic into adapters/utilities. Any `maplibre-gl` interaction must guard against double-mounts and clean up markers in `destroy()`.
- Apply TypeScript’s quick-fix suggestions where feasible, especially for type safety and nullability, unless they conflict with product or UX intent.
- Add `cursor-pointer` to enabled custom interactive controls and their clickable labels when the browser does not provide it; use `cursor-not-allowed` for disabled controls.
- Prefer Tailwind utilities directly in owned JSX, and keep small class-list repetitions local. When a repeated pattern represents reusable structure or behavior, extract a React component that owns the utilities. Reserve custom CSS and `@apply` for cases where a component would be disproportionate or the markup is externally generated. Use class-list maps only for real component variants, not solely to deduplicate strings. Keep `globals.css` limited to genuinely shared styles: feature-specific styles belong in the owned component or its integration adapter, including narrowly scoped DOM styles at third-party boundaries. Use global CSS for generated or third-party markup only when no local styling hook exists, and place component rules in `@layer components`. When writing custom CSS, use Tailwind theme variables whenever possible for colors, spacing, typography, radii, shadows, and other design tokens; use literal values only for deliberate exceptions not covered by the theme.

## Feature Implementation Approach

- Build every feature in small intermediate steps that can be tested end-to-end.
- Start with the thinnest vertical slice that works, then iterate.
- Before starting dense implementations, first check whether a consolidated, widely used, and up-to-date dependency can solve the problem.
- Prefer adopting proven dependencies over re-inventing the wheel when the tradeoffs are acceptable for this project.
- Keep data flow explicit and local; avoid “smart” indirection unless it clearly reduces complexity.
- After each step, run the smallest useful verification before moving on.
- When a feature is stable enough (behavior/API unlikely to change soon), update documentation accordingly: `README.md` for user/developer usage and `AGENTS.md` for implementation guidance/process updates.

Update `AGENTS.md` only with important stuff that cannot be clearly/quickly derived from an exploration of the codebase.

## Wikipedia Pipeline Notes

- Before implementing Wikipedia parsing, enrichment, conversion, or output logic, check whether `wtf_wikipedia` already has an external plugin that covers the need. Potentially useful plugins include `markdown` for conversion experiments, `image` for richer detail panels, `classify` for category filtering, `summary` for short descriptions, and `i18n` if ingesting non-English articles directly.

## Testing & Verification

- There is no automated map test harness yet; add colocated `*.test.tsx` files when introducing logic-heavy components and stub MapLibre APIs if needed.
- Keep tests user-centric: verify visible behavior, interactions, and outcomes rather than implementation details.
- Prefer accessible queries (for example `getByRole`, `getByLabelText`) and avoid brittle selectors.
- Immediately before raising a PR, run `pnpm format <changed files>` for files supported by Prettier, then `pnpm lint` and `pnpm build`. CI checks that the built app starts and responds on the PR. Do not require browser smoke checks unless explicitly requested.
- Document any manual QA (e.g., “verified zoom-to markers on Chrome + Safari”) in PR descriptions until automated coverage exists.

## Commits & PR Hygiene

- Use short, imperative commit subjects ("Add Alexandria map data"). Keep formatting-only commits separate from feature work so reviewers can skim diffs quickly.
- For push/publish requests, use the repo-local `push-branch` skill to decide whether a generic local branch should be renamed before creating the remote branch.
- For pull request creation, use the repo-local `pr-generation` skill for title, body, review state, and assignment conventions.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS – Implementation Notes

## Historical Explorer GitHub account

For `Papidev/historical-explorer`, its main checkout, and every existing or future worktree, always authenticate GitHub operations as `Papidev`.

- For every shell invocation that performs repository or Project operations with `gh`, obtain the stored account token with `papidev_token="$(env -u GH_TOKEN -u GITHUB_TOKEN gh auth token --hostname github.com --user Papidev)" || exit 1`, then require a nonempty token with `[ -n "$papidev_token" ] || exit 1`. Prefix every subsequent repository or Project `gh` command with `GH_TOKEN="$papidev_token"`.
- Before repository or Project operations, verify `GH_TOKEN="$papidev_token" gh api user --jq .login` returns `Papidev`. If the authenticated account differs, switch to `Papidev` with `env -u GH_TOKEN -u GITHUB_TOKEN gh auth switch --hostname github.com --user Papidev`, reload its stored token using the command above, and verify the identity again before proceeding. Use `--repo Papidev/historical-explorer` for commands that accept it.
- Account selection must be explicit per command: the globally active account may change in another session. Use another GitHub tool only when its authenticated identity is verified as `Papidev`.
- Request `gh auth refresh -s project` only after verifying that the credentials actually used belong to `Papidev` and lack the required Project permission. Never print or save token values.

## Product Context

- For product context, read `docs/product/vision.md` before making architecture or UX decisions.

## Agent skills

### Issue tracker

Track work in GitHub Issues and the Cultural Atlas Project.
Read `docs/agents/issue-tracker.md` before issue tracker operations.

### Domain docs

Use the single-context layout.
Read `docs/agents/domain.md` before domain exploration.

## Before Starting Work

- Before starting further work on the current branch, check whether its pull request has already been merged. If it has, create a new `feat/` branch from updated `main` before making any changes, even if the current branch still exists locally. Check the PR's merge status rather than Git ancestry, because squash merges do not preserve the branch commits.
- Always work on a branch, never on `main`.
- Before creating a feature branch, fetch `origin/main` and verify that local `main` points to the same commit. If they differ, align `main` before creating the branch.
- If needed, create a branch before coding (example: `git checkout -b feat/<short-name>`).

## Worktree Lifecycle

- When creating a worktree, copy environment files, uncommitted versioned content under `data/`, `.tailwind-plus/`, Catalyst references, and other local libraries/assets. The app accesses generated local data directly in the shared external directory; keep those files outside worktrees and `data/public/` local to each checkout. See [Data layout](README.md#data-layout) for configuration and shared-data behavior. Verify the local resources before starting work.
- After the task is complete and its PR is confirmed merged, stop the application and any task processes started from that worktree, including their child processes. Identify processes by their association with the worktree and leave applications running from other checkouts alone.
- Worktree cleanup does not require separate backups of local resources or generated data.
- Once processes are stopped, remove the entire task worktree and its registration; use the Codex archive tool for managed worktrees. A completed task with a merged PR must leave no running application or worktree directory behind.

## Tooling & Commands

- Local-only admin route entrypoints use `.dev.tsx` / `.dev.ts`; `next.config.ts` recognizes these extensions only in the development-server phase. Keep public route entrypoints on the standard extensions, and avoid importing admin UI or Server Actions from public routes so they stay out of production bundles.
- Public routes read only the build-generated public catalog. Publication is currently implicit from versioned Story Content, a licensed and attributed selected Main Image, and resolved saved People; do not use local pipeline `Complete` status or generated Sources as a publication gate. Keep snapshot generation out of production request handlers.
- Use `pnpm` exclusively for dependency management and scripts (do not use npm or yarn).
- If dependency installation fails, stop immediately and ask for help. Do not continue with alternative approaches intended to bypass the failed installation.
- `pnpm lint` runs ESLint with the Next `core-web-vitals` rules plus `eslint-config-prettier` to keep formatting conflicts out.
- Select local checks according to [Testing & Verification](#testing--verification), including before commits and PRs.

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
- After each step, select verification according to [Testing & Verification](#testing--verification).
- When a feature is stable enough (behavior/API unlikely to change soon), update documentation accordingly: `README.md` for user/developer usage and `AGENTS.md` for implementation guidance/process updates.

Update `AGENTS.md` only with important stuff that cannot be clearly/quickly derived from an exploration of the codebase.

## Wikipedia Pipeline Notes

- Before implementing Wikipedia parsing, enrichment, conversion, or output logic, check whether `wtf_wikipedia` already has an external plugin that covers the need. Potentially useful plugins include `markdown` for conversion experiments, `image` for richer detail panels, `classify` for category filtering, `summary` for short descriptions, and `i18n` if ingesting non-English articles directly.

## Testing & Verification

- Run tests, TypeScript checks, lint, formatting, and builds only when the changed behavior or files justify them, or the user explicitly requests them. Opening a PR or committing does not by itself justify any check.
- Add or update tests when new or changed behavior warrants coverage, without requiring a separate user request. Cover meaningful outcomes rather than mirroring implementation details or testing trivial edits.
- Before running a check, briefly state which concrete risk in the change it verifies. Choose the smallest relevant check; broaden or repeat only after new changes, failures, or unresolved concerns.
- For documentation or agent-instruction-only edits, inspect the diff; skip application tests, TypeScript checks, lint, and builds. For scripts or CI changes, verify the affected script or workflow rather than automatically rebuilding the application.
- `pnpm lint` is not a TypeScript check. Select a type check for type-related risk and a build for bundling or production behavior risk; run both only when both are relevant.
- There is no automated map test harness yet; add colocated `*.test.tsx` files when introducing logic-heavy components and stub MapLibre APIs if needed.
- Keep tests user-centric: verify visible behavior, interactions, and outcomes rather than implementation details.
- Prefer accessible queries (for example `getByRole`, `getByLabelText`) and avoid brittle selectors.
- Report which checks ran and any relevant checks skipped in the PR description. CI checks that the built app starts and responds on the PR. Browser smoke checks require an explicit request.
- Document any manual QA (e.g., “verified zoom-to markers on Chrome + Safari”) in PR descriptions until automated coverage exists.

## Commits & PR Hygiene

- Before opening any PR, commit and include all uncommitted Stories, People, and POI metadata present in its branch checkout, including modified tracked files and untracked files that are not ignored by Git. Verify that none remains only local, so merging the branch preserves its content. Respect `.gitignore`; never force-add ignored files. Apply this rule in every checkout, including worktrees, without separate backups.
- Before opening application PRs, follow [Application versions](README.md#application-versions): prepare an English Changeset, consume it into exactly one version increment and changelog entry relative to current `main`, and regenerate after alignment if another release merged. Internal documentation, GitHub Actions workflows (including action dependency updates), and the other CI/release automation files allowed by `scripts/check-release.mjs` are exempt; application dependency manifests and lockfiles still require a release.

- Track bugs, improvements, and future ideas in GitHub Issues and the repository's Cultural Atlas Project. Search existing issues before creating one; retain unresolved decisions and revisit conditions in the issue body. Markdown documents explain product and architecture decisions.
- Whenever creating an issue, add it to the Cultural Atlas GitHub Project associated with this repository, assign Status and Area, and verify the placement before reporting completion. Default to Backlog. If Project access is unavailable, report the missing placement explicitly.
- Every new issue, including bugs and backlog ideas, must have an assigned milestone. Review existing milestones and assign the best matching one when creating the issue; verify the assignment before reporting completion. If none fits, agree a new milestone with the product owner before creating the issue. Backlog status or a milestone proposed only in the body does not satisfy this requirement. Report the assigned milestone and its rationale.
- Use short, imperative commit subjects ("Add Alexandria map data"). Keep formatting-only commits separate from feature work so reviewers can skim diffs quickly.
- For push/publish requests, use the repo-local `push-branch` skill to decide whether a generic local branch should be renamed before creating the remote branch.
- For pull request creation, use the repo-local `pr-generation` skill for title, body, review state, and assignment conventions.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

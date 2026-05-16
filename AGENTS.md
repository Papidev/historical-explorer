# AGENTS – Implementation Notes

## Project Context
Historical Explorer is a visit companion for art, history, and cultural discovery.

The app helps tourists understand what they are seeing while visiting a city. It turns points of interest into concise, engaging cultural discoveries using text, images, maps, timelines, and other media when they are the best medium for the insight.

The app is not a Wikipedia clone, a generic tourist guide, or an AI-generated article system. Each POI should become a small curated visitor experience, not a complete encyclopedia page.

The goal is to help visitors:
- Notice meaningful details.
- Understand what they are looking at.
- Connect a place to art, history, culture, people, and the city.
- Remember something valuable after the visit.

## Production World vs Visitor World
There are two separate worlds:

- Production world: the internal editorial workflow. A POI starts from source material such as Wikipedia, Wikidata, and Wikimedia Commons. AI helps create a first draft by extracting visitor-oriented insights, proposing concise text, suggesting which medium best communicates each insight, proposing candidate media, and explaining why each insight is useful. The AI draft is only a proposal; a human curator reviews, edits, rejects, enriches, and approves the final content.
- Visitor world: the public app experience. The visitor only sees polished, approved content. They should not see AI reasoning, drafts, source processing, or editorial metadata.

The visitor experience should be quick, pleasant, low-friction, and useful while physically looking at a place.

## Core Content Principle
Insight first. Medium second.

Use text, image, map, timeline, or another medium only when that medium best communicates the specific cultural insight. Do not add media just because it makes the page look rich. If concise, engaging text communicates the idea best, use text.

Every published discovery should help the visitor do at least one of these:
- See: notice something visible.
- Understand: grasp what they are looking at.
- Connect: relate the POI to history, art, culture, people, or the city.
- Remember: leave with a meaningful cultural takeaway.
- Navigate: understand a nearby or spatial relationship.

A true fact is not automatically worth publishing. The final experience should contain the best few discoveries, not all available information.

## AI and Editorial Role
AI is a junior cultural editor, not the final authority.

AI may help draft, classify, summarize, rank, and propose. The human curator has the final word. Do not design flows where AI directly publishes final POI content without human review.

Avoid:
- Long article-like summaries.
- Generic tourist-guide prose.
- Too many cards, clicks, or sections.
- Decorative media with no clear purpose.
- Unsupported claims.
- Invented facts, coordinates, media, or licenses.
- Treating all POIs with the same rigid template.

Prefer:
- Concise, engaging, source-grounded insights.
- Block-by-block human review.
- Visible source support for draft content.
- Media chosen because it communicates an insight better.
- Optional depth only when it adds value.

## Before Starting Work
- Always work on a branch, never on `main`.
- If needed, create a branch before coding (example: `git checkout -b feat/<short-name>`).


## Tooling & Commands
- Use `pnpm` exclusively for dependency management and scripts (do not use npm or yarn).
- If dependency installation fails, stop immediately and ask for help. Do not continue with alternative approaches intended to bypass the failed installation.
- `pnpm lint` runs ESLint with the Next `core-web-vitals` rules plus `eslint-config-prettier` to keep formatting conflicts out.
- During iteration, run the smallest useful verification; `pnpm lint` is a required final gate before handoff/PR, not after every tiny edit.
- `pnpm lint` is not a full TypeScript type-check in this repo; when touching TS-heavy logic, also run `pnpm build` (or `tsc --noEmit` if a script is available) before considering the change complete.
- Prettier is configured with `prettier-plugin-tailwindcss` and `@ianvs/prettier-plugin-sort-imports`; rely on `pnpm prettier --write` or your editor integration so imports stay grouped and Tailwind classes remain sorted.

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
- Always: (1) run `pnpm dev` to verify Rome loads, pan/zoom controls work, POI popup "Apri dettagli" opens the side panel, and MDX content renders when present; (2) run `pnpm lint`; (3) run `pnpm build` before raising a PR.
- Document any manual QA (e.g., “verified zoom-to markers on Chrome + Safari”) in PR descriptions until automated coverage exists.

## Commits & PR Hygiene
- Use short, imperative commit subjects ("Add Alexandria map data"). Keep formatting-only commits separate from feature work so reviewers can skim diffs quickly.
- PRs should summarize the change, call out new data sources or env vars, include screenshots/recordings for UI updates, and list executed commands (`dev`, `build`, `lint`, manual map QA). Wait for local checks to finish before requesting review.

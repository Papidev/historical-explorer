# Domain docs

## Before exploring

- Read CONTEXT.md at the repository root.
- Read docs/product/vision.md before architecture or UX decisions.
- Read relevant ADRs under docs/adr/.

If CONTEXT.md or docs/adr/ is absent, proceed silently.
Domain documentation is created when terms or decisions are resolved.

## Layout

This repository uses a single context:

- CONTEXT.md: domain vocabulary and core rules.
- docs/adr/: architecture decision records.

## Vocabulary and decisions

Use CONTEXT.md's canonical terms in issues, proposals, and tests.
If a needed concept is missing, reconsider the term or note the gap
for domain-modeling.

Surface conflicts with existing ADRs explicitly, including the reason
for proposing a different decision.

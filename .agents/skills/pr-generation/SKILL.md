---
name: pr-generation
description: Use when the user asks to create, open, update, prepare, or describe a GitHub pull request for this repository.
---

# PR Generation

Use this skill together with the GitHub publish flow when preparing or opening a pull request.

## Title

Use a lowercase prefix and colon:

- `add:` for new capabilities
- `change:` for behavior updates
- `fix:` for bug fixes
- `docs:` for documentation-only changes
- `chore:` for maintenance
- `refactor:` for internal restructuring without intended behavior changes

Keep the title concise and scoped to the PR's main change.

## State And Assignment

- Open PRs as ready for review unless the user explicitly asks for a draft.
- Assign new PRs to `Papidev` when GitHub permissions allow it.

## Body

Include only sections that add concrete review value. Do not add placeholder
sections or sections whose content is effectively "none", "not captured", or
just a list of routine verification commands.

- Summary of what changed
- New data sources or environment variables, when added or changed
- Screenshots or recordings, only when they are available and useful for review
- Verification notes, only when they explain a non-obvious manual check, risk,
  failure, limitation, or reviewer-relevant result

Wait for local checks to finish before requesting review.

---
name: pr-generation
description: Use when the user asks to create, open, update, prepare, or describe a GitHub pull request for this repository.
---

# PR Generation

Use the repo-local [push-branch](../push-branch/SKILL.md) skill when publishing the branch for a pull request.

Read the full diff against the PR's base branch before writing its title and change list.

## GitHub Access

Create and manage pull requests through the GitHub connector, including assignment and other PR metadata. Use Git only for local commits and publishing the branch; do not use the `gh` CLI for pull request operations in this repository.

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

List the changes as a Markdown bulleted list, with one concrete change per item.
When creating or updating a PR through the GitHub connector, pass actual newlines
in the body so each bullet renders as a separate list item.

Include only sections that add concrete review value. Do not add placeholder
sections or sections whose content is effectively "none", "not captured", or
just a list of routine verification commands.

- Summary of what changed
- New data sources or environment variables, when added or changed
- Screenshots or recordings, only when they are available and useful for review
- Verification notes, only when they explain a non-obvious manual check, risk,
  failure, limitation, or reviewer-relevant result

The local checks required by [AGENTS.md](../../../AGENTS.md) must pass before opening a PR or marking it ready for review.

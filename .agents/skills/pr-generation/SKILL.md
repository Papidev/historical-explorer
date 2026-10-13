---
name: pr-generation
description: Use when the user asks to create, open, update, prepare, or describe a GitHub pull request for this repository.
---

# PR Generation

Use the repo-local [push-branch](../push-branch/SKILL.md) skill when publishing the branch for a pull request.

Read the full diff against the PR's base branch before writing its title and change list.

## Base Branch Alignment

Before opening every PR, fetch `origin/main` and verify that
`git merge-base --is-ancestor origin/main HEAD` succeeds. If the branch is behind,
merge `origin/main` into the current branch, resolve any conflicts, and run the
required checks on the aligned branch before publishing it and opening the PR.
Repeat the fetch and ancestry check immediately before creating the PR; if main
advanced again, align the branch and rerun the affected checks first.

## Application Version

After branch alignment, follow [Application versions](../../../README.md#application-versions)
before running the required checks and publishing the PR:

- For application changes, add an English Changeset describing the change and its patch, minor, or major increment.
- Run `pnpm release:version` to consume pending changesets. Include the generated `package.json` version and `CHANGELOG.md` in the PR; an unconsumed changeset is not release-ready.
- Apply the documentation and CI/release automation exemptions in [Application versions](../../../README.md#application-versions); dependency manifests and lockfiles still require a release.
- Reuse an already prepared increment rather than bumping twice. If another release merged, regenerate from the updated base and preserve its changelog history.
- Run `pnpm release:check origin/main` and resolve failures before opening or updating the PR.
- Preserve `0.1.0` for the initial tracked release. Subsequent application PRs require one increment unless covered by the documented exemptions.

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
- Assign new PRs to the repository owner when GitHub permissions allow it.

## Body

Write for a human reviewer who has not read the conversation. Start with a short
paragraph explaining the problem and the resulting user experience in plain English.
Use a concrete before/after example when it makes the change clearer.

Prefer short bulleted lists for changes and verification. Use Markdown to make the
body easy to scan: bold for key behavior, headings for distinct sections, links for
issues, and inline code for technical identifiers. Keep emphasis selective.
Group related behavior rather than listing every file, implementation step, or test.
Include technical details only when they explain a decision, tradeoff, or risk.

Summarize verification in a short sentence. Explain what important behavior was
verified instead of listing routine commands. Include screenshots, configuration
changes, or limitations only when they help review the change. Omit placeholders,
conversation history, and release bookkeeping that is already clear from the diff.

When using the GitHub connector, pass actual newlines and leave a blank line before
Markdown lists. Link the originating issue and use a closing keyword when appropriate.

The local checks required by [AGENTS.md](../../../AGENTS.md) must pass before opening a PR or marking it ready for review.

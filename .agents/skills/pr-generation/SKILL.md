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

## Generated Data

Before preparing the release or opening any PR, follow the generated-data rule in
[Commits & PR Hygiene](../../../AGENTS.md#commits--pr-hygiene). Inspect the checkout
of the PR branch for uncommitted Stories, People, and POI metadata, including
modified tracked files and untracked files. Use
`git ls-files --others --exclude-standard` to list untracked files that are not
ignored. Commit all this content with ordinary `git add`, respecting `.gitignore`
and never force-adding ignored files. Verify that none remains only local before
opening the PR, whether working in the main checkout or a worktree.

## Application Version

After branch alignment, follow [Application versions](../../../README.md#application-versions)
before running the required checks and publishing the PR:

- For application changes, add an English Changeset describing the change and its patch, minor, or major increment.
- Run `pnpm release:version` to consume pending changesets. Include the generated `package.json` version and `CHANGELOG.md` in the PR; an unconsumed changeset is not release-ready.
- Apply the documentation and CI/release automation exemptions in [Application versions](../../../README.md#application-versions); dependency manifests and lockfiles still require a release.
- Reuse an already prepared increment rather than bumping twice. If another release merged, regenerate from the updated base and preserve its changelog history.
- Run `pnpm release:check origin/main` when application, dependency, version, changelog, or release automation changes make release validation relevant; skip it for documentation or agent-instruction-only updates.
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

Use this format for every PR in this repository, including when the generic `pr`
skill is also loaded. These body conventions take precedence over its template.

Start with a short paragraph explaining the purpose and resulting behavior in
plain English for a reviewer who has not read the conversation.

Use these sections when relevant:

- **Changes**: short bullets explaining what changed and why it matters. Group
  related behavior rather than listing every file or implementation step.
- **Verification**: short bullets describing the checks actually performed and
  what they verified. Include relevant skipped checks and material limitations.
  For documentation-only changes, a brief diff-review statement is enough.

Combine headings, short paragraphs and bullet lists; the description need not be
only bullets. Scale the detail to the change and omit empty sections. Use familiar
words, explain technical terms when needed, and keep emphasis selective. Include
screenshots or diagrams only when they materially help explain the change.

Describe changes directly. Do not add Before/After, Merge Danger or Remaining Work
sections unless the user explicitly requests them. Explain any material risk or
limitation plainly alongside the relevant change or verification result, without
labels such as door, blast radius or operational gate. Keep future plans out of the
PR body unless they are necessary to understand the implemented scope.

Omit placeholders, conversation history and release bookkeeping already clear
from the diff.

When using the GitHub connector, pass actual newlines and leave a blank line before
Markdown lists. Link the originating issue and use a closing keyword when appropriate.

Choose local verification using [Testing & Verification](../../../AGENTS.md#testing--verification). Opening a PR or marking it ready for review does not require a blanket test, type-check, lint, format, or build run.

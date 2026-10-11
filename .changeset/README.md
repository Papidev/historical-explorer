# App changesets

Run `pnpm changeset` and describe the change in English. Use `patch` for fixes
and small content or presentation updates, `minor` for new features, and `major`
for incompatible changes.

Before merging an application change, update the branch from `main`, then run
`pnpm release:version`. Commit the updated `package.json` and `CHANGELOG.md`.
Changesets consumes the pending changeset files, so they no longer appear in the
final PR diff. Documentation-only PRs do not need a changeset or version bump.

The initial tracked release starts at the existing `0.1.0`. Subsequent application
PRs increment that baseline.

Each application PR must contain one version increment relative to current
`main`. If another release merges first, regenerate your release from its new
version and preserve its changelog entries before merging.

CI validates the prepared version. After CI succeeds on `main`, it creates a
`v<version>` Git tag for that release commit. Vercel continues deploying `main`.
The tag identifies the release commit; it does not confirm a successful deploy.

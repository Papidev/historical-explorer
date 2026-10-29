# Issue tracker: GitHub

Mira work is tracked in GitHub Issues and the shared [Mira Project](https://github.com/users/Papidev/projects/2).

- `Papidev/mira-explorer` owns the public app, map, database access, and content read/write APIs.
- `Papidev/mira-admin` owns the private admin and editorial generation workflows.
- Create implementation issues in the responsible repository. Keep cross-repository product specs and parent issues in `Papidev/mira-explorer` and reference them from admin work.
- A small cross-repository change can use one issue and a PR in each repository. Split independently completable work into sub-issues in the responsible repositories, linked to the product parent. Each issue belongs in Mira.
- Partial PRs reference the shared issue without closing it. Close the shared issue only after all required work is complete.

Use the gh CLI with `--repo Papidev/mira-explorer` or `--repo Papidev/mira-admin`, according to the issue's repository. Search both repositories before creating cross-repository work.

## Conventions

- Search existing issues before creating one.
- Read issues with gh issue view <number> --comments.
- Create issues with gh issue create; use --body-file for multiline bodies.
- Use gh issue edit for labels, assignees, and milestones.
- Use gh issue comment for updates and gh issue close for completion.
- When a skill says "publish to the issue tracker", create a GitHub issue.
- When a skill says "fetch the relevant ticket", read the issue and comments.

Follow AGENTS.md's Commits & PR Hygiene rules for Mira Project
placement, Status, Area, milestones, and verification.

## Pull requests as a triage surface

**PRs as a request surface: no.**

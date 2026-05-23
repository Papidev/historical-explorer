---
name: push-branch
description: Use when the user asks to push, publish, or create the remote branch for the current local work.
---

# Push Branch

Use this skill before creating a remote branch.

## Workflow

1. Check the current branch with `git branch --show-current`.
2. If the branch has a generic exploratory name such as `feat/new-task`, `feat/new-work`, or `feat/exploration`, rename it to a more meaningful `feat/<short-task-name>` before pushing.
3. Choose the meaningful name from the work already done in the branch.
4. If the work scope is still unclear, keep the generic branch name and push it as-is.
5. Push the renamed branch and set upstream tracking.

## Safety

- Rename only the local branch before the first push.
- If the branch already exists on the remote, do not rename it unless the user explicitly asks.
- Do not discard or revert local changes while renaming or pushing.

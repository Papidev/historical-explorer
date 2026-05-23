---
name: new-task-branch
description: Use when the user says they are starting a new task, new job, new work, or asks to begin a separate piece of work in this repository.
---

# New Task Branch

Use this skill at the start of a distinct new task.

## Workflow

1. Check the current branch with `git status --short --branch` or `git branch --show-current`.
2. If the current branch starts with `feat/`, stay on it unless the user explicitly asks for a new branch.
3. If the current branch is `main`, `master`, or another non-feature branch, create a new branch before coding.
4. If the user gives a branch name, use it.
5. If the task purpose is clear, use the branch name format `feat/<short-task-name>` based on that purpose.
6. If the task is exploratory or the user does not yet know what will enter the branch, use a general branch name such as `feat/new-task`, `feat/new-work`, or `feat/exploration`.
7. Keep the branch name lowercase, concise, and hyphen-separated.

## Safety

- Do not discard or revert local changes when creating the branch.
- If the worktree has existing changes, create the branch from the current state and continue unless the user asks otherwise.
- If the user gives a branch name, use it even if it does not follow the default `feat/` pattern.

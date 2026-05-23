---
name: new-task-branch
description: Use when the user says they are starting a new task, new job, new work, or asks to begin a separate piece of work in this repository.
---

# New Task Branch

Use this skill at the start of a distinct new task.

## Workflow

1. Check the current branch with `git status --short --branch` or `git branch --show-current`.
2. If the user explicitly says this is a new task, new job, new work, or a separate piece of work, update `main` and create a new `feat/` branch from it, even when the current branch already starts with `feat/`.
3. If the user gives a branch name, use it.
4. If the task purpose is clear, use the branch name format `feat/<short-task-name>` based on that purpose.
5. If the task is exploratory or the user does not yet know what will enter the branch, use a general branch name such as `feat/new-task`, `feat/new-work`, or `feat/exploration`.
6. Keep the branch name lowercase, concise, and hyphen-separated.
7. If the request is not explicit new work and the current branch starts with `feat/`, stay on it unless the user asks for a new branch.
8. If the request is not explicit new work and the current branch is `main`, `master`, or another non-feature branch, create a new branch before coding.

## Safety

- Do not discard or revert local changes when creating the branch.
- If updating `main` or switching branches would conflict with existing worktree changes, stop and ask the user how to proceed instead of stashing, discarding, or carrying changes across branches.
- If the user gives a branch name, use it even if it does not follow the default `feat/` pattern.

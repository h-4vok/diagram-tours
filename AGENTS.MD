# AGENTS

This repository is designed to be worked on by AI-assisted agents such as Codex.

Before performing substantive work, agents must load the following files:

- ENGINEERING_PLAYBOOK.md
- REPO_WORK_RULES.md
- DELIVERY_CHECKLIST.md
- README.md

These files define the engineering standards of the repository.

## Pull Request Rule

Creating a pull request is not the end of the task.

When an agent opens or updates a PR, the task remains in progress until the relevant CI checks for that PR are green.

Agents must:

- wait for the PR checks to complete
- inspect failing checks if CI is red
- fix the failures, commit, and push follow-up changes as needed
- only report the PR as ready after the required PR checks are green

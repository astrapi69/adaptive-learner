---
description: Pull request policy - mandatory PR for every pushed code change
globs:
  - "**/*"
alwaysApply: true
---

# PR-PFLICHT

After ANY code change that is committed and pushed to a branch, a pull request against the target branch (`develop`, gitflow #334) MUST be opened — WHETHER OR NOT the task explicitly asked for one. This is mandatory, not advisory. It applies to ALL agents and ALL repositories.

## Core Rules

- **"No PR, wasn't requested" is NOT a valid completion report.** A pushed branch with no PR is unfinished work, not a delivered task.
- **Opening the PR is the last step of the change**, in the same turn as the push — not a follow-up the user has to ask for.
- **A task does not have to name "PR" to require one.** Any task that results in a committed, pushed code change carries the PR obligation implicitly. The default is always PR, never "push only".
- **The PR is how work becomes reviewable and mergeable.** It is the hand-off surface: the diff, the testing evidence, the `Closes #NN` auto-close. A branch that never becomes a PR silently drops out of the Priority-Hierarchy "Merge open PRs" step — the work is invisible.

## Exceptions

Do NOT open a PR only in these cases:

1. **No code change.** A pure analysis / status / audit / docs-question task that pushes nothing has nothing to PR. (A task that DOES change committed files — including docs and `..` — is a code change for this rule and gets a PR.)

2. **Release freeze.** While a `release/X.Y.Z` branch is open and not yet tagged+published, no new PRs against `develop` are opened (see VIBE-CODING-POLICY §"Release Freeze" / vibe-coding.md §"Release-Sperre"). Exception: a P0 hotfix that blocks the release itself.

3. **The user explicitly said "push only, no PR" for this task.** An explicit opt-OUT is honoured; the absence of an explicit opt-IN is NOT a reason to skip.

4. **If a standing instruction in the session/dispatch prompt says the opposite** ("do not create a PR unless explicitly asked"), that instruction is the known root cause of the recurring "pushed but no PR" miss and is being retired. Under this project rule the default is PR-always; surface the conflict in the final report rather than silently skipping the PR.

## PR Conventions

Every PR follows the existing conventions:

- Opened against `develop` (coding-standards.md §Git)
- Body cites the issue with a closing keyword (GITHUB-ISSUE-PFLICHT / SUB-ISSUE-CLOSES)
- When a PR template exists, mirrors its section headings

---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: GitHub issue workflow - issue-first policy, lifecycle, sub-issue closing, issue queue
globs:
  - "**/*"
alwaysApply: true
---

# GITHUB-ISSUE-PFLICHT

Every bug and every issue MUST have a GitHub issue BEFORE the fix begins. This is mandatory, not advisory. It applies to ALL agents and ALL repositories.

## Workflow

1. **Search first.** Look for an existing issue (`gh issue list --search "<keywords>" --state all`). If it exists and was closed but the bug recurred, REOPEN it rather than filing a duplicate.

2. **No fix without an issue.** If none exists, create one (`gh issue create`, `bug` label, enough context that the fix is actionable without follow-up) BEFORE touching code. This applies RETROACTIVELY: if you discover a NEW bug while working on another one, file a SEPARATE issue for it before fixing it.

3. **No commit without an issue reference.** The commit subject (and the PR) cite the issue number — `(#NN)` or `(fixes #NN)`.

4. **Verify the premise before filing.** If a pre-implementation audit shows the reported defect does not actually exist (spec-vs-reality drift), do NOT file a misleading issue — surface the finding to the user instead. A false issue is worse than no issue.

## ISSUE-LIFECYCLE

Every GitHub issue is closed by the fix, not by hand:

- The fix commit message OR the PR body contains `Closes #NN` / `Fixes #NN` so merging auto-closes the issue.
- No manual closing without a commit/PR reference.
- No open issue may remain after its fix is merged. After merging, the referenced issues must be in the `closed` state.

## SUB-ISSUE-CLOSES

When a PR implements ONE sub-issue of an umbrella/epic, its commit/PR body MUST cite the sub-issue with a closing keyword — `Closes #<sub-issue>` — NOT only `Refs #<umbrella>`. `Refs` does not auto-close; `Closes`/`Fixes` does.

Cite BOTH when useful: `Closes #<sub-issue>` (auto-close) on its own line, plus `Refs #<umbrella>` (traceability) — the closing keyword first.

The umbrella stays open until ALL its sub-issues are closed; close the umbrella explicitly when the last concrete slice merges (or when the rest is deferred — say so in the closing comment).

## Issues as a work queue

When the user says "weiter", "arbeite Bugs ab", "work through the bugs", "next bug" or similar, treat the GitHub issue tracker as the queue:

1. Read the open bug issues: `gh issue list --label bug --state open`.
2. Work them in priority order. Priority signals, in order: an explicit `P0`..`P5` label or a priority note in the issue body; then data-integrity / data-loss / restore / security issues; then a reproducible crash with a stack trace; then the rest.
3. Break ties by smallest scope first.
4. For each: follow GITHUB-ISSUE-PFLICHT (the issue already exists), fix, add a regression test in the same commit, conventional commit citing the issue (`(#NN)`), open a PR.
5. Report status after each issue; do not wait for confirmation between issues when the user asked to work through them.

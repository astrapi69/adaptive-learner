---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
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

1. **No code change.** A pure analysis / status / audit / docs-question task that pushes nothing has nothing to PR. (A task that DOES change committed files — including docs and `.claude/rules/` — is a code change for this rule and gets a PR.)

2. **Release freeze.** While a `release/X.Y.Z` branch is open and not yet tagged+published, no new PRs against `develop` are opened (see VIBE-CODING-POLICY §"Release Freeze" / vibe-coding.md §"Release-Sperre"). Exception: a P0 hotfix that blocks the release itself.

3. **The user explicitly said "push only, no PR" for this task.** An explicit opt-OUT is honoured; the absence of an explicit opt-IN is NOT a reason to skip.

4. **If a standing instruction in the session/dispatch prompt says the opposite** ("do not create a PR unless explicitly asked"), that instruction is the known root cause of the recurring "pushed but no PR" miss and is being retired. Under this project rule the default is PR-always; surface the conflict in the final report rather than silently skipping the PR.

## PR Conventions

Every PR follows the existing conventions:

- Opened against `develop` (coding-standards.md §Git)
- Body cites the issue with a closing keyword (GITHUB-ISSUE-PFLICHT / SUB-ISSUE-CLOSES)
- When a PR template exists, mirrors its section headings

## PR Scope: translations and documentation (#2578)

A changeset that is ENTIRELY a translation catalog (`backend/config/i18n/*.yaml`, the generated `frontend/src/data/i18n/*.json`) or ENTIRELY documentation (`docs/**`, `.claude/rules/**`, root `*.md`) gets its own PR, never mixed with a feature. A feature that incidentally touches a sentence of documentation stays one PR, this is for changesets with NOTHING else in them.

**Order: translations and documentation ship first, the feature PR follows.** The feature then finds its strings and docs already in place, and the integration branch never carries a partially-translated feature. Verified before deciding this (2026-08-12): no gate in this repo checks an i18n key for "referenced by code", so a key pre-staged ahead of its feature does not trip anything. A docs PR that must name a not-yet-real path or make target uses the existing `<!-- doc-ref-exempt: reason -->` marker (doc-ref-existence gate, #2254), no new tolerance needed.

**Check scope: only checks that say something about text run in full.**

- Documentation-only is already minimal via the existing `changes` job path-filter (#1617/#1658): `docs/**` and `.claude/rules/**` match neither the `backend` nor the `frontend` filter, so Backend/Frontend/Plugin Tests and ruff+mypy report success in seconds without installing anything (measured on PR #2572: 8-21s each). What runs and says something about docs: Docs drift verifier (doc-ref-existence, numeric claims vs. source, docs-hygiene ASCII-substitute ratchet, en<->de help parity, all four have caught real errors: a reference to a deleted file, #1903; the test-count-arithmetic WARN silently going stale, #2077) and the file-scoped pre-commit hooks. Both already run unconditionally; no workflow change needed for docs.
- Translation-only was NOT minimal before this rule (measured on PR #1754, a 14-file catalog-only PR: Backend Tests 5m51s, Frontend Tests 5m38s, the full suites, because i18n files live under `backend/**`/`frontend/**` and trip the same filters as code). The `changes` job in `ci.yml` now computes a third output, `i18n_only` (true only when every changed file matches the two i18n globs; dorny/paths-filter answers "did any file match", not "did every file match only this", so a plain `git diff --name-only` walk does the "only" part). When true on a PR: `lint-and-type-check` (ruff/mypy/pip-audit) and `plugin-tests` skip entirely; `backend-tests` runs only `backend/tests/test_i18n_parity.py` (key/value/placeholder/structural parity across all 11 catalogs) instead of the testmon-selective or full run, and skips the OpenAPI snapshot step; `frontend-tests` runs only `frontend/src/data/i18n/i18n-sync.test.ts` (backend-YAML vs. frontend-JSON catalog parity) instead of tsc/eslint/the circular-dep guard/Stylelint/the production build/`bun audit`. The pre-commit `i18n-script-sanity` hook (real umlauts, el/hi transliteration) and the Docs drift verifier's `verify_docs_i18n.py` (frontend catalog coverage) already run unconditionally and stay as-is. That single backend test file is run directly rather than left to testmon: testmon's dependency graph is built from Python coverage, so it never learns that a YAML catalog affects that test and would silently deselect it.

**Mixed PR**: any file outside the i18n/docs globs above flips `i18n_only` (or the docs path-filter) back to full scope, same jobs, same steps, nothing skipped. There is no way to touch code and land in the reduced path.

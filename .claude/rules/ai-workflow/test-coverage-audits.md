---
description: When and how to run test coverage audits
globs:
  - "**/*"
alwaysApply: false
---

# Test Coverage Audits

## When to run

- **After a major feature phase** (3+ new modules or endpoints): run a focused audit on the changed areas.
- **Before a release:** run a full pyramid audit covering all levels (unit, integration, E2E).
- **Quarterly:** run a full audit even without a release to catch organic drift.
- **On request:** when the user asks for a coverage check or gap analysis.

## Format

Audits follow the structure in `docs/audits/current-coverage.md`:

1. **Coverage map** - table per pyramid level (backend unit, plugin unit, integration, frontend unit, E2E). Each row: module/endpoint, test file, coverage rating (HIGH/MEDIUM/LOW/NONE).

2. **Prioritized gap list** - categorized as Critical (A/B), Standard (C), Nice-to-have (D). Critical = regression pinning or data integrity. Standard = normal coverage for untested modules. Nice-to-have = unlikely edge cases.

3. **Summary statistics** - tested/total counts per level, overall coverage percentage.

## File location conventions

```
docs/audits/
  current-coverage.md            # always the latest audit
  history/
    2026-04-12-coverage.md       # snapshot frozen at audit date
    2026-MM-DD-coverage.md       # subsequent snapshots
```

`current-coverage.md` is overwritten on every audit. Before overwriting, copy the previous version to `history/YYYY-MM-DD-coverage.md`. History files are never modified after creation.

## Delta tracking

Every audit must include:

- **Baseline:** the test counts at the start of the audit period.
- **Current:** the test counts after all changes.
- **Delta:** explicit +N per suite (e.g., "Backend: 244 -> 308, +64").
- **Gaps closed:** list of items that moved from "untested" to "tested" since the last audit.

When closing gaps in a session, update `current-coverage.md` immediately - do not wait for the next full audit.

## Where coverage runs

Coverage runs on CI, not as part of the normal local workflow. Running full coverage locally (`make test-coverage`) is heavy and thermally stresses the developer machine, so it is opt-in only.

- `make test` - default everyday command. Fast, no coverage. Stays green as the gate after every change.
- `make test-coverage` - explicit opt-in. Runs backend, frontend, and every plugin with `pytest --cov` and `vitest --coverage`. Frontend coverage requires Node 20+; lower versions fail with a `node:inspector/promises` ImportError. CI uses Node 24 so this is only a local concern.
- `.github/workflows/coverage.yml` - night shift (#575): runs daily (03:00 UTC) + `workflow_dispatch`, not on PRs (coverage is a report, not a merge gate). Uploads HTML reports + coverage.xml as GitHub Actions artifacts (14 day retention).

To pull the latest coverage reports without running coverage locally:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
gh run download --name adaptive-learner-plugin-gamification-coverage  # etc.
```

Codecov integration is intentionally not wired up. Adding it is a separate prompt: enable the repo on codecov.io, add `CODECOV_TOKEN` to GitHub Secrets, append a `codecov-action` step after each coverage step in `coverage.yml`.

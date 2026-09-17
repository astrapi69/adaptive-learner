# Current test coverage

The single canonical, always-current source for test **counts** and
**coverage** (per `CLAUDE.md`, `quality-checks.md`, and the developer
`testing.md`). Other docs reference this file instead of duplicating a
number that would drift.

Counts are collected with `--collect-only` (no run needed); coverage
percentages come from the CI `coverage.yml` night shift, not from a
local run (`make test-coverage` is heavy and thermally stressful, so it
is opt-in only). Re-measure with the commands in the last section.

## Test counts

| Level | Suite | Count | How measured (this session, v2.14.0) |
|---|---|---|---|
| Unit + integration | Backend (`backend/tests`) | 1824 | `cd backend && poetry run pytest --collect-only -q` |
| Unit + integration | Plugins (14 packages, sum below) | 1130 | per-plugin `pytest --collect-only`, backend's shared venv |
| Unit + component | Frontend (Vitest) | 9775 (935 files) | `cd frontend && bunx vitest run` (tail total, CI push run) |
| **Grand total** | measured this session | 12729 | 1824 + 1130 + 9775 |

E2E (Playwright smoke + Dexie-mode + visual) is separate from
`make test` and is not counted here; run `cd e2e && npx playwright
test`.

### Plugins, per package

| Plugin | Tests |
|---|---|
| assessment | 110 |
| session | 237 |
| tracking | 64 |
| tools | 58 |
| gamification | 69 |
| content-loader | 332 |
| anki | 20 |
| notebooklm | 27 |
| learning-repo | 53 |
| missions | 41 |
| ai-anthropic | 35 |
| ai-openai | 32 |
| ai-gemini | 34 |
| ai-perplexity | 18 |
| **Total** | **1130** |

## Delta since the last recorded baseline

The previous recorded baseline was this file's own v2.13.0-era
snapshot (before the v2.14.0 release: gamification, arcade,
mascot-variants, and playful-mode features landed a batch of new
tests).

| Suite | Baseline (prior) | Current (v2.14.0) | Delta |
|---|---|---|---|
| Backend | 1767 | 1824 | +57 |
| Plugins | 1123 | 1130 | +7 |
| Frontend (Vitest) | via `make test` / CI (prior) | 9775 | re-verify on CI |

## Coverage percentages

Coverage runs on CI (`.github/workflows/coverage.yml`, daily 03:00 UTC
+ `workflow_dispatch`), NOT as part of the local workflow. Pull the
latest HTML + `coverage.xml` reports without a local run:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
gh run download --name adaptive-learner-plugin-gamification-coverage   # etc. per plugin
```

Targets per module type live in `quality-checks.md` ("Coverage Targets
per Module Type"). Codecov is intentionally not wired up.

## Re-measuring (authoritative commands)

```bash
# Backend
cd backend && poetry run pytest --collect-only -q | tail -1

# Plugins (sum across all packages)
cd backend && for d in ../plugins/adaptive-learner-plugin-*/; do \
  poetry run pytest "$d/tests" --collect-only -q 2>/dev/null | tail -1; done

# Frontend (Vitest) - runs the suite; take the "Tests N passed" total
cd frontend && bunx vitest run 2>&1 | grep -E "Tests +[0-9]+"
```

Update this file when the counts move (this IS the canonical location -
do not copy the numbers elsewhere). Per `test-coverage-audits.md`, a
full audit additionally copies the previous version to
`docs/audits/history/YYYY-MM-DD-coverage.md` before overwriting. <!-- doc-ref-exempt: template placeholder, not a real path -->

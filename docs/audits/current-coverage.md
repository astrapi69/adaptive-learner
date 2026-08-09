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

| Level | Suite | Count | How measured (this session) |
|---|---|---|---|
| Unit + integration | Backend (`backend/tests`) | 1767 | `cd backend && poetry run pytest --collect-only -q` |
| Unit + integration | Plugins (14 packages, sum below) | 1123 | per-plugin `pytest --collect-only` |
| Unit + component | Frontend (Vitest) | via `make test` / CI | `cd frontend && bunx vitest run` (tail total) |
| **Backend + plugins** | measured this session | 2890 | 1767 + 1123 |

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
| gamification | 64 |
| content-loader | 330 |
| anki | 20 |
| notebooklm | 27 |
| learning-repo | 53 |
| missions | 41 |
| ai-anthropic | 35 |
| ai-openai | 32 |
| ai-gemini | 34 |
| ai-perplexity | 18 |
| **Total** | **1123** |

## Delta since the last recorded baseline

The previous recorded baseline was the `CLAUDE.md` v2.6.1 line
(backend 1475 + plugins 1096 + Vitest 7722 = 10293).

| Suite | Baseline (v2.6.1) | Current | Delta |
|---|---|---|---|
| Backend | 1475 | 1767 | +292 |
| Plugins | 1096 | 1123 | +27 |
| Frontend (Vitest) | 7722 | via `make test` / CI | re-verify on CI |

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
`docs/audits/history/YYYY-MM-DD-coverage.md` before overwriting.

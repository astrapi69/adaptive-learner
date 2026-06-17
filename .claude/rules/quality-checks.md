# Quality checks and test strategy

## BACKUP-AKZEPTANZTEST (acceptance gate, MANDATORY)

No backup-touching PR merges until a REAL round-trip in `make dev`
runs to completion: click Export, click Import, it MUST work — with
REAL data, not synthetic fixtures. Unit tests are necessary but NOT
sufficient; the manual round-trip is the gate. The full console
output (backend per-table INFO log + frontend `[Backup]` console
lines) MUST be attached to the PR as proof.

Origin: five consecutive "fixed" backup releases (#49, #57, #64,
#115, #117) each shipped with passing unit tests yet none produced a
working end-to-end import — the tests proved the fix in isolation but
never exercised the actual use case (user clicks Import, real backup,
real data). Building an engine and only checking it starts, never
that the car drives.

Rules:
- A backup PR's description includes the captured console output of
  a successful Export -> Import round-trip against real data.
- The round-trip is run AFTER the code changes are live (restart /
  reload the backend so the new logging is active).
- "It passes `make test`" is never the merge justification for a
  backup change. The round-trip is.
- If the round-trip crashes: fix the next error, re-import, re-capture
  — repeat until the import completes with zero unexpected errors. No
  commit before a clean round-trip exists.
- This pairs with the general rule "Operational gaps masquerade as
  wired infrastructure" in lessons-learned.md: a feature that works
  in a unit test is not the same as a feature that works.

## Visueller Device-Check (vor Merge)

Features die primaer visuell oder interaktiv sind (Banners, Dialoge,
Toasts, Overlays, Touch-Interaktionen) muessen in der PR-Beschreibung
einen Screenshot oder eine Beschreibung des manuellen Checks auf
mindestens einem echten Geraet enthalten:

- Desktop (Chrome/Firefox)
- Mobile (iOS Safari ODER Android Chrome)

Kein Screenshot = kein Merge fuer visuelle Features. Unit-Tests und
Playwright pruefen Funktion, nicht ob der User es sehen und bedienen
kann.

Hintergrund: ein Element kann in jedem Unit-Test gruen sein und trotzdem
fuer den User unsichtbar oder unbedienbar sein - Text-auf-gleichfarbigem-
Hintergrund, ein Banner hinter der iOS-Safari-Adressleiste, ein
Touch-Target unter dem Home-Indicator, ein Overlay das die Navigation
verdeckt. Diese Klasse von Fehlern findet nur ein Blick auf ein echtes
Geraet (oder eine ehrliche Beschreibung dessen, was dort geprueft wurde).

## Quick check after every change

### 1. Run the tests

```bash
# Everything at once (MUST be green before every commit)
make test

# Individually when targeted:
make test-backend                  # pytest backend
make test-plugins                  # all 13 plugin test suites
make test-plugin-assessment        # assessment only
make test-plugin-session           # session (largest plugin) only
make test-plugin-gamification      # XP / badges / streak
make test-plugin-learning-repo     # Phase 42 / 49 Learning Repository
make test-plugin-content-loader    # Phase 43 content sets
make test-frontend                 # Vitest (happy-dom)

# E2E (needs a running app)
make dev                    # start the app
npx playwright test         # E2E tests
```

### 2. Type check

```bash
# Frontend: TypeScript compiler
cd frontend && npx tsc --noEmit

# Backend: mypy (optional, not set up yet)
# cd backend && poetry run mypy app/
```

### 3. Manually check the rules

Go through this checklist before committing:

- [ ] No `any` in TypeScript without a comment
- [ ] No fetch() calls outside of api/client.ts
- [ ] No browser dialogs (alert, confirm, prompt); use AppDialog
- [ ] No hardcoded strings in the UI; use the i18n YAML
- [ ] New UI elements work in all 6 theme variants (3 themes x light/dark)
- [ ] CSS uses variables, no hardcoded colors
- [ ] No em-dash in code or text
- [ ] Conventional Commit message (feat:, fix:, refactor:, ...)

---

## Test strategy

### Test pyramid

```
      /    E2E     \        Playwright
     / ------------ \       Few, critical user flows
    / Integration    \      pytest + TestClient
   / ---------------- \    API endpoints with real DB state
  /    Unit Tests      \    pytest + Vitest
 / -------------------- \  Business logic in isolation
/   Mutation Testing      \ mutmut (Python) + Stryker (TypeScript)
 --------------------------  Verifies that tests actually catch bugs
```

Current counts: see [docs/audits/current-coverage.md](docs/audits/current-coverage.md).

### Unit tests (Backend - pytest)

**What to test:** service logic, conversions, validations, mappings.
**What NOT to test:** FastAPI routing (integration tests cover that).

**Where:** `backend/tests/` and `plugins/{name}/tests/`

**Example - new service:**
```python
# plugins/adaptive-learner-plugin-gamification/tests/test_xp_service.py

def test_three_star_band():
    """90% correct unlocks 3 stars."""
    assert compute_stars(correct=90, total=100) == 3

def test_streak_caps_at_seven_days():
    """A 20-day streak collapses to the 7-day multiplier."""
    long_streak = {date(2026, 5, day) for day in range(8, 28)}
    assert current_streak_days(long_streak, today=date(2026, 5, 27)) == 20
    award = calculate_lesson_session_xp(stars=3, first_attempt=True, streak_days=20)
    # Base 30 + star 30 + first-attempt 20 = 80, capped multiplier = 2.75
    assert award.xp_earned == 220
```

**Naming convention:** `test_{what_is_tested}.py`, functions: `test_{scenario}()`

**When to write new tests:**
- New service or new function: at least a happy path + one error case.
- Bug fix: failing test first, then fix.
- Import/export logic: test roundtrips (input -> transformation -> output -> compare).

### Unit tests (Frontend - Vitest)

**Status:** set up (happy-dom, Node 18 compatible).

**What to test:** API client functions, utility functions, complex hooks.
**What NOT to test:** simple components that just render (E2E tests cover that).

**Where:** next to the file: `api/client.test.ts`, `hooks/useI18n.test.ts`

**How to run:**
```bash
make test-frontend          # all frontend tests
cd frontend && npx vitest   # watch mode
```

**Example:**
```typescript
// src/api/client.test.ts
import { describe, it, expect, vi } from 'vitest'
import { api } from './client'

describe('API Client', () => {
  it('listProjects returns the user\'s learning projects', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1', topic: 'Spanish', goal: 'A2 in 3 months' }])
    })
    const projects = await api.projects.list('user-1')
    expect(projects).toHaveLength(1)
    expect(projects[0].topic).toBe('Spanish')
  })
})
```

### Integration tests (Backend - pytest + TestClient)

**What to test:** API endpoints with real DB state, plugin interaction.
**Difference from unit tests:** here FastAPI runs via TestClient with a real SQLite DB (in-memory).

**Where:** `backend/tests/test_api.py`, `backend/tests/test_phase4.py` (already exist)

**Example:**
```python
# backend/tests/test_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_project_and_start_session():
    """Create a learning project, start a session, end it."""
    # Create user (most flows need one)
    resp = client.post("/api/users", json={"name": "Tester", "language": "en"})
    assert resp.status_code == 200
    user_id = resp.json()["id"]

    # Create project
    resp = client.post(f"/api/users/{user_id}/projects",
                       json={"topic": "Spanish", "goal": "A2 in 3 months", "timeframe": "3m"})
    assert resp.status_code == 200
    project_id = resp.json()["id"]

    # Start a session via the session plugin
    resp = client.post("/api/plugins/session/start",
                       json={"project_id": project_id, "method": "deductive"})
    assert resp.status_code == 200
    session_id = resp.json()["session_id"]

    # End it via tracking
    resp = client.post(f"/api/plugins/tracking/end/{session_id}")
    assert resp.status_code == 200
```

**When to write new integration tests:**
- New API endpoint: happy path + error case (404, 422).
- Plugin installation: ZIP upload -> plugin active -> endpoint reachable.
- Backup roundtrip: export -> wipe -> import -> verify every domain row is back.

### E2E tests (Playwright)

**What to test:** critical user flows from the learner's perspective.
**Where:** `e2e/smoke/` (the existing 17 spec files) + `e2e/dexie/` (the Dexie-mode release gate).

**Existing coverage:**
- Onboarding: assessment -> profile -> first project.
- Dashboard: create / delete / archive a learning project.
- Session: start a 7-step session, send messages, end + rate.
- Curriculum: edit lesson rich-text content (TipTap).
- Settings: provider switch, key entry, language, theme, plugins.
- Navigation: every of the 13 routes reachable, links work.
- Dexie-mode release gate (`make test-dexie-smoke`): every nav-reachable route renders in the GH-Pages-shape build with NO backend. **Cadence (#552):** runs **daily** (scheduled, 04:00 UTC), **before every release** (gate in `make release-test`), and on `release/*` branches — **NOT on every PR** (expensive ~6 min, rarely PR-relevant; same rationale as the mutation-testing workflows). Trigger ad hoc via `workflow_dispatch` or locally with `make test-dexie-smoke`.

**When to write new E2E tests:**
- New plugin with UI: at least one flow (enable plugin -> use feature).
- New dialog/modal: open, fill the form, submit, check the result.
- Regression: when a UI bug is found, write an E2E test for it.

**Example:**
```typescript
// e2e/smoke/session-flow.spec.ts
import { test, expect } from '@playwright/test'

test('start a deductive session, message, end with rating', async ({ page }) => {
  await page.goto('/')
  await page.click('[data-testid="start-session-deductive"]')
  await expect(page.locator('[data-testid="session-step"]')).toBeVisible()

  await page.fill('[data-testid="session-input"]', 'What is the past tense of "go"?')
  await page.click('[data-testid="session-send"]')
  await expect(page.locator('[data-testid="session-message-assistant"]')).toBeVisible()

  await page.click('[data-testid="session-end"]')
  await page.click('[data-testid="rating-stars-3"]')
  await page.click('[data-testid="rating-submit"]')
  await expect(page).toHaveURL(/\/dashboard/)
})
```

### Coverage targets per module type

These are target coverage levels, not hard gates. They guide where to invest test effort and flag when a module is under-tested relative to its risk.

**Project-wide target: 85-95% of modules at MEDIUM or above.** Currently at ~70% (2026-04-12 audit). The gap is mostly on the frontend side.

**Principle: frontend coverage is not subordinate to backend coverage.** A 95% backend with a 32% frontend is not "good enough". The frontend is the user's interface - bugs there are visible immediately. Both sides of the pyramid must reach their targets independently.

#### Backend (Python)

| Module Type | Target | Rationale |
|-------------|--------|-----------|
| Services (`app/services/`) | HIGH (>= 80%) | Core business logic, highest bug risk |
| Routers (`app/routers/`) | MEDIUM-HIGH (>= 70%) | Integration tests covering happy path + error cases |
| Models (`app/models/`) | LOW-MEDIUM | Tested indirectly via integration tests; direct tests only for custom methods |
| Schemas (`app/schemas/`) | MEDIUM | Validators and field transformations need explicit tests |
| Utilities (`app/utils/`, `licensing.py`, `job_store.py`) | HIGH (>= 80%) | Pure functions, easy to test, often security-relevant |

#### Plugins (Python)

| Module Type | Target | Rationale |
|-------------|--------|-----------|
| Core logic (converters, generators, checkers) | HIGH (>= 80%) | The plugin's reason to exist |
| `plugin.py` (hook implementations) | MEDIUM | Tested indirectly through integration; explicit tests for non-trivial hooks |
| `routes.py` | MEDIUM | At least happy-path integration test per endpoint |

#### Frontend (TypeScript/React)

| Module Type | Target | Rationale |
|-------------|--------|-----------|
| `api/client.ts` | HIGH (>= 90%) | Every API call, error path, and interceptor |
| Hooks (`hooks/`) | HIGH (>= 80%) | State logic, side effects, computed values |
| Utility functions (`utils/`) | HIGH (>= 90%) | Pure functions, trivial to test |
| Complex form components (ExportDialog, CreateBookModal, BookMetadataEditor) | MEDIUM (>= 60%) | Validate form logic, conditional fields, submission |
| Simple display components (BookCard, Tooltip, ThemeToggle) | LOW | E2E covers rendering; unit tests only for non-trivial logic |
| Page components | LOW | E2E covers navigation and layout |
| Contexts/Providers | MEDIUM | Test the provider logic, not the React tree |

#### E2E (Playwright)

| Flow Type | Target | Rationale |
|-----------|--------|-----------|
| Data-critical flows (backup, import, export, trash) | MUST HAVE | Silent data corruption is the worst bug class |
| Core user journeys (assessment -> first session -> end + rate) | MUST HAVE | Happy path must always work |
| Plugin UI flows | SHOULD HAVE (one smoke per plugin) | Verify plugin UI mounts and basic interaction |
| Edge cases (long titles, empty states, error recovery) | NICE TO HAVE | Fill as bugs surface |

### Mutation testing (Backend - mutmut)

**Purpose:** checks whether the tests actually catch real bugs. mutmut changes the source code (mutants) and checks whether at least one test fails. Surviving mutants reveal gaps in test quality.

**Status:** to be set up. Dev dependency via Poetry.

**Setup:**
```bash
cd backend
poetry add --group dev mutmut
```

**pyproject.toml configuration:**
```toml
[tool.mutmut]
paths_to_mutate = "app/"
tests_dir = "tests/"
runner = "python -m pytest"
dict_synonyms = "Struct,NamedStruct"
```

**For plugins separately:**
```toml
# plugins/adaptive-learner-plugin-export/pyproject.toml
[tool.mutmut]
paths_to_mutate = "adaptive_learner_export/"
tests_dir = "tests/"
runner = "python -m pytest"
```

**How to run:**
```bash
# Full backend (slow, nightly or manual)
cd backend && poetry run mutmut run

# Just one module (faster, targeted)
cd backend && poetry run mutmut run --paths-to-mutate app/services/

# Just one plugin
cd plugins/adaptive-learner-plugin-export && poetry run mutmut run

# Show results
poetry run mutmut results

# Surviving mutants in detail
poetry run mutmut show <id>

# HTML report
poetry run mutmut html
```

**When to run:**
- After bigger refactorings (check whether the tests still hold).
- Before a phase is declared complete.
- Nightly in the CI pipeline (later).
- When coverage is high but confidence in test quality is low.

**How to act on the results:**
- Surviving mutants in critical code (services, conversions): add tests.
- Surviving mutants in trivial code (logging, formatting): ignore, no test bloat.
- Mutation score as a guideline: >= 60% for core modules (app/services/, plugin logic), no hard gate.
- Include `mutmut results` in the session summary when it was run.

**Test the critical modules first:**
1. `plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/xp_service.py` - XP curve + rule
2. `plugins/adaptive-learner-plugin-session/adaptive_learner_session/` - session orchestration + evaluation
3. `plugins/adaptive-learner-plugin-learning-repo/adaptive_learner_learning_repo/renderer.py` - Markdown emission
4. `backend/app/services/` - core business logic
5. `backend/app/licensing.py` - security-critical

**Reference prompt for Claude Code:**
```
I want to integrate mutmut (mutation testing) into this project.

Steps:
1. Analyze the existing pyproject.toml and the current test structure
2. Add mutmut as a dev dependency via Poetry
3. Configure mutmut in pyproject.toml (paths_to_mutate, tests_dir, runner)
4. Run a first mutmut run and show me the results
5. If tests are missing or mutants survive, propose concrete improvements

Important: use Poetry for everything, no pip calls.
```

### Mutation testing (Frontend - Stryker Mutator)

**Purpose:** same principle as mutmut, but for TypeScript/React. Stryker Mutator is the equivalent for the JS/TS ecosystem.

**Status:** **WIRED** (vitest runner). `@stryker-mutator/core` +
`@stryker-mutator/vitest-runner` are committed devDependencies;
`frontend/stryker.config.json` mutates the logic layers (`src/lib`,
`src/hooks`, `src/api`); `make stryker` / `make stryker-quick` run it;
`.github/workflows/mutation-frontend.yml` runs it on `workflow_dispatch`
+ a gated nightly schedule. The TypeScript checker is intentionally
omitted from the committed config (it slows runs and is brittle under
TS 6 strict); add it later if a typed-mutant signal is wanted.

**Committed config:** `frontend/stryker.config.json` — vitest runner
(`coverageAnalysis: perTest`), `thresholds.break: null` (a low score
never fails the build; the HTML report is the deliverable),
`reports/mutation/index.html` (gitignored).

**How to run:**
```bash
# Full run — src/lib + src/hooks + src/api (slow; nightly/manual)
make stryker

# Scoped run (fast, for a single file/dir while hardening tests)
make stryker-quick MUTATE="src/lib/apiKeyFormat.ts"
make stryker-quick MUTATE="src/lib/lesson/**/*.ts"

# Equivalent raw invocations
cd frontend && npx stryker run
cd frontend && npx stryker run --mutate "src/hooks/**/*.ts"
```

**CI:** `.github/workflows/mutation-frontend.yml`. Manual dispatch
always runs; the nightly `schedule` is a no-op unless the repo
variable `ENABLE_NIGHTLY_MUTATION == "true"` (Settings -> Variables).
Per the "wired != working" rule, trigger it once via
`workflow_dispatch` after merge and confirm the uploaded
`frontend-mutation-report` artifact before relying on the schedule.

**Test the critical frontend modules first:**
1. `src/api/client.ts` - all API calls, error handling
2. `src/hooks/useI18n.ts` - i18n logic
3. `src/hooks/useTheme.ts` - theme logic
4. Utility functions

**Reference prompt for Claude Code:**
```
I want to integrate Stryker Mutator (mutation testing) on the frontend.

Steps:
1. Vitest is already running. Install @stryker-mutator/core, @stryker-mutator/vitest-runner, @stryker-mutator/typescript-checker
2. Create stryker.config.json (mutate: src/api/, src/hooks/, src/components/, checkers: typescript, testRunner: vitest)
3. Run a first stryker run on src/api/client.ts and show the results
4. If mutants survive, propose concrete tests
```

---

## Automation (still to build)

### Recommended Makefile extensions

```makefile
# Frontend type check
check-types:
	cd frontend && npx tsc --noEmit

# Backend mutation testing (nightly/manual)
mutmut-backend:
	cd backend && poetry run mutmut run

mutmut-export:
	cd plugins/adaptive-learner-plugin-export && poetry run mutmut run

mutmut-results:
	cd backend && poetry run mutmut results

mutmut-html:
	cd backend && poetry run mutmut html
	@echo "Report: backend/html/index.html"

# Frontend mutation testing (nightly/manual)
stryker:
	cd frontend && npx stryker run

stryker-api:
	cd frontend && npx stryker run --mutate "src/api/**/*.ts"

# All checks together (before push)
check-all: test check-types
	@echo "All checks passed."

# Everything together
test-all: test test-frontend
	@echo "All tests passed."
```

### CI pipeline (later, when GitHub Actions is set up)

```
1. make check-types        # TypeScript compiler
2. make test-backend       # pytest backend
3. make test-plugins       # pytest plugins
4. make test-frontend      # Vitest
5. make dev-bg             # start the app
6. npx playwright test     # E2E
7. make dev-down           # stop the app

Nightly (separate, slower):
8. make mutmut-backend     # mutation testing backend (Python)
9. make mutmut-export      # mutation testing export plugin (Python)
10. make stryker           # mutation testing frontend (TypeScript)
```

### CI cadence: PR gates vs the night shift (#575)

PRs run **correctness gates only** — the checks whose failure must block a
merge. Everything informational, warn-only, or driven by external state runs
on the **night shift** (a daily/weekly schedule + `workflow_dispatch`), so a
PR is not slowed by work that can never block it.

| Runs on every PR (correctness gates) | Night shift (schedule + `workflow_dispatch`) |
|---|---|
| `ci.yml`: backend / plugin / frontend tests, ruff + mypy, pre-commit, docs-drift verifier | **Security Scan** (pip-audit / npm audit / bandit) — weekly + `push: release/**`; warn-only, never merge-critical |
| `complexity-check.yml` → **complexity-gate** (baseline ratchet, hard exit 1) | **Coverage** (`coverage.yml`, backend + frontend) — daily; a report, not a gate |
| | **Content stats drift** (`content-stats.yml`) — daily; validates the README against a FRESH content-repo checkout (drift is driven by the *separate* content repo, so a PR can't predict it) |
| | **complexity-report** (full radon/eslint warn-view) — daily |
| | **dexie-smoke** (daily, #552) + mutation testing (`mutmut`, `stryker`) |

Rule of thumb when adding a CI job: if its failure should NOT block a merge,
it belongs on the night shift, not on the `pull_request` trigger. The local
pre-commit hooks (e.g. "Validate content repo stats in README") still catch
the app-side half of the moved checks before commit.

### Test Impact Analysis (#615): selective on PRs, full nightly + release

On a PR, run only the tests whose covered code changed; on develop/main push,
nightly, and release, run the full suite. The full suite is the safety net
against false negatives — never weaken the nightly to make a selective PR run
green; debug the selective mechanism instead.

| Trigger | Frontend | Backend | E2E (Dexie) |
|---------|----------|---------|-------------|
| PR | `vitest --changed origin/<base>` | `pytest --testmon` | Nightly only |
| develop push | Full suite | Full suite | Nightly only |
| Nightly (04:00 UTC) | Full suite | Full suite | Full suite |
| Release (`make release-test`) | Full suite | Full suite | Full suite |

Mechanics: frontend uses `vitest run --changed origin/<base>` (#615); backend
uses `pytest-testmon` (`.testmondata` cached in CI, run-id key + prefix
restore-key to stay warm + current). Plugin tests (`make test-plugins`, ~37s)
stay full — too cheap to optimise. **Fallback to the full suite is automatic**:
an unresolvable base ref (frontend) or a testmon cache-miss (backend, which
makes testmon run + rebuild the DB) — never a silent skip. `make test`,
`make release-test`, and the nightly/release workflows are unaffected (they
call the full Makefile targets directly).

---

## Priority for the next improvements

1. **Set up mutmut** - mutation testing for backend + gamification + session plugins
2. **Set up Stryker** - mutation testing for the frontend (Vitest is already running)
3. **make check-all** - a single command for everything before push
4. **Cross-language parity tests** - extend the Phase 49F + Phase 50 pattern to any new shared logic
5. **Set up mypy nightly** - in addition to the per-commit run, sweep the plugin tree
6. **CI pipeline** - GitHub Actions with all checks + nightly mutmut/Stryker (partially shipped)

## Coverage Targets per Module Type

- Services and business logic: 95% minimum
- API endpoints: 90% minimum
- Frontend components with logic: 85% minimum
- Frontend presentational components: 65% minimum
- Hooks and utilities: 95% minimum
- Models and schemas: 80% minimum
- Plugin routes: 90% minimum

Overall project target: 85-95% coverage.

Frontend coverage is not subordinate to backend coverage. User-facing
bugs destroy trust as effectively as backend bugs destroy data.

100% coverage is not the goal. Meaningful coverage is the goal:
tests must assert real behavior properties, not just line execution.
Regression pins for known bug classes count for more than line count.

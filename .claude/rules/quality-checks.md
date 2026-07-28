---
description: Test strategy, coverage targets, mutation testing, BACKUP-AKZEPTANZTEST, visual device check, feature screenshots, test pyramid, pre-commit checklists
globs:
  - backend/tests/**/*.py
  - plugins/*/tests/**/*.py
  - frontend/src/**/*.test.ts
  - frontend/src/**/*.test.tsx
  - e2e/**/*.spec.ts
  - .pre-commit-config.yaml
  - Makefile
alwaysApply: false
---

# Quality Checks and Test Strategy

## Test Pyramid

```
         /  E2E  \          Playwright
        /    -    \         Few, critical user flows
       / Integration\       pytest + TestClient
      /      -       \      API endpoints with real DB state
     /   Unit Tests   \     pytest + Vitest
    /        -         \    Business logic in isolation
   / Mutation Testing   \   mutmut (Python) + Stryker (TypeScript)
  /          -           \  Verifies that tests actually catch bugs
```

Current counts: see docs/audits/current-coverage.md (canonical, do not duplicate).

## Coverage Targets per Module Type

| Module type | Target | Rationale |
|---|---|---|
| Backend services | HIGH (>= 80%) | Core business logic, data integrity |
| Backend routers | MEDIUM-HIGH (>= 70%) | Thin delegation layer, but input validation matters |
| Plugin services | HIGH (>= 80%) | Same as backend services |
| Plugin routes | MEDIUM (>= 60%) | Plugin-specific endpoints |
| Frontend api/client.ts | HIGH (>= 90%) | Central API layer, errors here cascade everywhere |
| Frontend components | MEDIUM (>= 60%) | UI logic, state management |
| Frontend utilities | HIGH (>= 80%) | Pure functions, easy to test |
| Data-critical E2E flows | MUST HAVE | Backup/restore, session lifecycle, content import |

## BACKUP-AKZEPTANZTEST (Acceptance Gate, MANDATORY)

No backup-touching PR merges until a REAL round-trip in `make dev` runs to completion: click Export, click Import, it MUST work — with REAL data, not synthetic fixtures. Unit tests are necessary but NOT sufficient; the manual round-trip is the gate. The full console output (backend per-table INFO log + frontend `[Backup]` console lines) MUST be attached to the PR as proof.

**Origin**: five consecutive "fixed" backup releases (#49, #57, #64, #115, #117) each shipped with passing unit tests yet none produced a working round-trip in the real app. Synthetic fixtures do not catch schema drift, missing columns, or JSON serialization edge cases that only surface with real user data.

### What the test covers

1. Start `make dev` with a real database containing real user data.
2. Click Export in Settings > Data. Verify the `.alb` file downloads.
3. Delete the database or switch to a fresh profile.
4. Click Import, select the `.alb` file.
5. Verify: all projects, sessions, lessons, settings, plugin data restored.
6. Verify: no console errors, no toast errors, no 500s in the backend log.

### When it applies

- Any change to `backend/app/routers/backup.py`
- Any change to backup/restore service functions
- Any change to the data model that affects serialization
- Any change to the `.alb` format or its schema
- Any change to Dexie import/export paths

### When it does NOT apply

- Pure documentation changes to backup help pages
- UI-only changes to the backup section (styling, i18n, layout) without logic changes
- Changes to unrelated routers or services

## Visual Device Check (MANDATORY for visual features)

Features that are primarily visual or interactive (banners, dialogs, toasts, overlays, touch interactions) MUST include a screenshot or description of a manual check on at least one real device in the PR description:

- Desktop (Chrome/Firefox)
- Mobile (iOS Safari OR Android Chrome)

No screenshot = no merge for visual features. Unit tests and Playwright verify function, not whether the user can see and operate it.

**Background**: an element can be green in every unit test and still be invisible or unusable for the user — text on same-colored background, tap target too small, overflow hidden on mobile, z-index covered by another element.

### What counts as a visual feature

- New or changed dialogs, modals, drawers
- New or changed toast notifications
- New or changed banners, alerts, badges
- Layout changes to existing pages
- New or changed responsive behavior
- Touch/drag interactions
- Animation or transition changes

### What does NOT require a visual check

- Pure backend changes (API, services, models)
- Pure logic changes in frontend utilities
- Test-only changes
- Documentation-only changes

## Feature Screenshots (Recommended)

For non-visual features that change user-facing behavior, a screenshot is recommended but not mandatory. It helps reviewers understand the change without running the app.

## Mutation Testing

### Python (mutmut)

```bash
# Run mutation testing on backend
cd backend && poetry run mutmut run

# Run on a specific plugin
cd plugins/adaptive-learner-plugin-export && poetry run mutmut run

# View results
cd backend && poetry run mutmut results

# Generate HTML report
cd backend && poetry run mutmut html
# Report: backend/html/index.html
```

**When to run**: nightly or before a release. NOT on every commit (too slow).

**How to interpret**:
- Surviving mutants in critical code (services, data handling): add tests immediately.
- Surviving mutants in trivial code (formatting, logging): ignore or document.
- Killed mutants: tests are working as expected.

**Configuration**: `mutmut` config in `backend/setup.cfg` or `pyproject.toml`. Mutate only service and utility modules, not routes or tests.

### TypeScript (Stryker)

```bash
# Run on full frontend
cd frontend && bunx stryker run

# Run on API layer only
cd frontend && bunx stryker run --mutate "src/api/**/*.ts"
```

**When to run**: nightly or before a release.

**How to interpret**: same as mutmut. Focus on `src/api/`, `src/lib/`, `src/storage/` — the logic layers. Component mutation testing is optional (high noise, low signal).

## Pre-Commit Checklist

Every commit MUST pass:

1. `ruff check` (Python lint)
2. `ruff format --check` (Python format)
3. `eslint` (TypeScript lint)
4. `prettier --check` (TypeScript format)
5. `pytest -x -q` (backend smoke test)

See code-hygiene.md for the full pre-commit configuration.

## Makefile Targets for Quality Checks

```makefile
# Fast checks (every commit)
check-types:
	cd frontend && bunx tsc --noEmit

# All fast checks together (before push)
check-all: test check-types
	@echo "All checks passed."

# All tests together
test-all: test test-frontend
	@echo "All tests passed."

# Mutation testing (nightly/manual)
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
	cd frontend && bunx stryker run

stryker-api:
	cd frontend && bunx stryker run --mutate "src/api/**/*.ts"
```

## Test Writing Guidelines

See tdd.md for the TDD workflow (Red-Green-Refactor, four-test-per-feature guideline).

See coding-standards.md §Tests for:
- Test frameworks per layer (pytest, Vitest, Playwright)
- Mocking rules
- Bug-fix discipline (failing test FIRST)
- `make test` must stay green

### New code minimum coverage

- New service function: at least happy path + one error case.
- New endpoint: at least one happy-path test.
- New plugin hook: at least one test verifying the hook fires and returns expected shape.
- New frontend utility: at least happy path + one edge case.

### Test naming convention

```python
# Python
def test_get_session_returns_session_when_exists(): ...
def test_get_session_raises_not_found_when_missing(): ...
def test_end_session_raises_conflict_when_already_ended(): ...
```

```typescript
// TypeScript
it("returns session when it exists", () => { ... })
it("throws ApiError with 404 when session is missing", () => { ... })
it("displays toast error on end-session failure", () => { ... })
```

Pattern: `test_{action}_{expected_outcome}_when_{condition}`. The name must describe the behavior, not the implementation.

## Integration Test Rules

- Use `TestClient(app)` for backend integration tests.
- Use real SQLite in-memory database (`ADAPTIVE_LEARNER_TEST=1`), NOT mocks for the DB layer.
- Mock external services (AI providers, Edge-TTS, LanguageTool).
- Each test gets a fresh database via the `db` fixture (see `backend/tests/conftest.py`).
- Plugin integration tests load the plugin via PluginForge and test through the real route.

## E2E Test Rules (Playwright)

- E2E tests live in `e2e/smoke/`.
- Cover critical user flows: session lifecycle, backup round-trip, content import.
- Use `data-testid` selectors, NOT brittle CSS selectors.
- Test at relevant viewport sizes: 600px (mobile), 800px (tablet), 1080px (desktop).
- E2E tests are separate from `make test`. Run with `cd e2e && npx playwright test`.

## When to Add Tests

| Change type | Test requirement |
|---|---|
| New feature | Unit + integration + E2E (if UI) |
| Bug fix | Regression test FIRST (Red), then fix (Green) |
| Refactoring | Existing tests must stay green; add tests if coverage drops |
| New endpoint | At least one happy-path integration test |
| New plugin | Hook tests + route tests |
| Data model change | Migration test + serialization round-trip |
| Backup/restore change | BACKUP-AKZEPTANZTEST (manual round-trip) |
| Visual/interactive change | Visual Device Check (screenshot) |

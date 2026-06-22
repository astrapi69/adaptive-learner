# Testing

AdaptiveLearner's test discipline is enforced by `make test`
on every change. The strategy is a pyramid: unit at the base,
integration in the middle, E2E smoke at the top.

## Test counts

| Layer | Tool |
|---|---|
| Backend unit + integration | pytest ^9 |
| Plugin tests (13 plugins) | pytest ^9 |
| Frontend unit + integration | Vitest 4 |
| E2E smoke | Playwright |
| Dexie-mode release gate | Playwright |

The counts grow every release. To avoid duplicated numbers
that drift out of sync, this page does NOT hardcode a total.
`docs/audits/current-coverage.md` is the single canonical,
always-current source for test counts and coverage. The 13
plugins are assessment, the three AI providers (anthropic /
openai / gemini), session, tracking, tools, gamification,
anki, notebooklm, learning-repo, content-loader, and missions.

## Backend pytest

```bash
make test-backend
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

Tests live in `backend/tests/`. Fixtures in `conftest.py`
provide a fresh in-memory SQLite DB per test, the
`TestClient`, and a mocked plugin manager. Test isolation is
hard — `ADAPTIVE_LEARNER_TEST=1` is set before any `app.*`
import.

## Plugin tests

Each plugin has its own `tests/` directory:

```bash
make test-plugins              # all 13
make test-plugin-session       # just one
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Plugin tests don't load the FastAPI app — they exercise the
plugin's modules in isolation. Mock the `pluggy.PluginManager`
when testing hook firing.

## Frontend Vitest

```bash
make test-frontend                # runs Vitest from frontend/
cd frontend && npx vitest         # watch mode
cd frontend && npx vitest run src/storage/  # one directory
```

Run Vitest from `frontend/` (its config lives in
`frontend/vite.config.ts`), or via `make test-frontend`. From
the repo root the config is not found, the `node` environment
is used, and DOM-touching tests fail with
`ReferenceError: document is not defined`.

Tests live alongside the source: `Component.test.tsx` next to
`Component.tsx`. happy-dom is the environment; React 19 + RTL.
The i18n parity guard (11 languages), the theme-token parity
guard, and the design-token "no hardcoded colors" guard run as
Vitest tests inside this same suite.

## Mock patterns

**AI providers**: mock `global.fetch` and assert on the URL,
headers, body:

```typescript
beforeEach(() => {
  global.fetch = vi.fn(async (input, init) => {
    calls.push({url, method, body});
    return new Response(JSON.stringify({content: [{type: "text", text: "hi"}]}), {status: 200});
  });
});
```

**fake-indexeddb**: at the top of every Dexie test file:

```typescript
import "fake-indexeddb/auto";

beforeEach(async () => {
  await _resetDbForTests();
  const {IDBFactory} = await import("fake-indexeddb");
  (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});
```

Each test gets a fresh in-memory IndexedDB — no leakage.

**api/client.ts mocks** (legacy pages):

```typescript
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {...actual, api: {...actual.api, users: {...actual.api.users, get: apiGetMock}}};
});
```

The page imports `getStorage()`, which delegates to
ApiStorage, which delegates to `api.*`. The mock cuts in at
the `api.*` layer and still fires through the storage stack.

## Playwright E2E

```bash
cd e2e && npx playwright test
cd e2e && npx playwright test --ui   # interactive
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

Smoke specs cover the critical user paths:

- Landing language picker + onboarding form
- Assessment 12 questions + radar render
- Session start + end + rate
- Settings language + API key
- Curriculum create
- Mobile viewports (iPhone SE, iPhone 14, Pixel 7, iPad)

Specs use `data-testid` selectors only — no brittle CSS
selectors. The smoke specs are NOT on the `make test` path;
they need a running app (`make dev-bg` first).

Beyond `e2e/smoke/`, the `e2e/` tree holds three more spec
families:

- `e2e/dexie/` — the Dexie-mode release gate. Builds the
  frontend with `VITE_STORAGE_MODE=dexie` (the GitHub-Pages
  shape, no backend) and walks every nav-reachable route; any
  error toast or page crash fails it. Run with
  `make test-dexie-smoke`.
- `e2e/visual/` — visual-baseline regression specs.
- `e2e/manual-automation/` — Playwright automation of the
  manual test plan.

## Coverage

```bash
make test-coverage   # opt-in; slow + thermally heavy
```

Coverage is a report, not a merge gate, so it does not run on
PRs. The `coverage.yml` workflow runs nightly (and on demand);
download the artifacts:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Targets per `.claude/rules/quality-checks.md`:

- Services + business logic: 95% min
- API endpoints: 90% min
- Frontend components with logic: 85% min
- Hooks + utilities: 95% min

Overall: 85-95% project-wide.

## Pre-commit

```bash
cd backend && poetry run pre-commit install
```

Hooks: ruff check (auto-fix), ruff format, trailing
whitespace, end-of-file fixer, check-yaml, check-json,
check-added-large-files, check-merge-conflict, frontend
ESLint, a plugin lockfile/pyproject pairing guard, and a
bundled-content stats validator. In the CI pre-commit job the
`prettier-frontend` and `eslint` hooks are skipped (the
Frontend Tests job runs ESLint with deps installed instead).

## CI

CI splits into two tiers: correctness gates run on every PR
(they must pass to merge), and the expensive or warn-only
suites run on the night shift and at release time.

`.github/workflows/ci.yml` runs on push to `develop` / `main`
and on every PR (Python 3.12):

1. Backend tests (pytest)
2. Plugin tests (`make test-plugins`, all 13 via the backend venv)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`),
   circular-dependency check, Stylelint, Vitest, `vite build`,
   `npm audit`
4. Pre-commit hooks on all files
5. Backend ruff + mypy + pip-audit
6. Docs drift verifier (`verify_docs.py` + mkdocs-nav sync)

**Test Impact Analysis (#615):** on a PR only the impacted
tests run — `vitest run --changed origin/<base>` and
`pytest --testmon`. Push to `develop` / `main`, the nightly
runs, and release runs always run the FULL suite. The fallback
to the full suite is automatic (unresolvable base ref, or a
testmon cache miss).

Two more PR gates live in their own workflows:

- `complexity-check.yml` — the complexity ratchet gate
  (`make check-complexity-gate`, radon for Python + ESLint
  complexity for TS). It is a baseline ratchet: it fails only
  on NEW or regressed offenders versus `.complexity-baseline`,
  so it blocks new complexity without forcing a sweep of
  pre-existing debt. The full warn-only complexity report runs
  nightly.
- `cohesion-check.yml` — the file-size guard (gate against
  `.filesize-whitelist`). The companion folder-size guard runs
  locally via `make check-folder-size`.

**Night shift / release (not on PRs):**

- `dexie-smoke.yml` — Dexie-mode E2E gate (daily + on
  `release/**` + dispatch; `make test-dexie-smoke` locally)
- `coverage.yml` — coverage report (daily + dispatch)
- `security-scan.yml` — pip-audit / npm audit / bandit
  (weekly + on `release/**` + dispatch; warn-only)
- `content-stats.yml` — content-stats drift vs a fresh content
  checkout (daily + dispatch)
- `mutation-frontend.yml` — Stryker mutation testing (gated
  nightly + dispatch); backend mutation testing uses mutmut

`.github/workflows/release-gate.yml` runs on tag pushes:
verifies version pins are synced across all version-bearing
files (no drift), plugin lockfiles match, and regenerated
artifacts are up to date.

## Manual test plan

What automation cannot cover (layout, readability, touch
interaction, theme contrast) is checked by a manual checklist
before every larger release:
[MANUAL-TESTPLAN.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/MANUAL-TESTPLAN.md).

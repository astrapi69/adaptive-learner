# Testing

AdaptiveLearner's test discipline is enforced by `make test`
on every change. The strategy is a pyramid: unit at the base,
integration in the middle, E2E smoke at the top.

## Test counts (v1.20.0)

| Layer | Count | Tool |
|---|---|---|
| Backend unit + integration | 786 | pytest ^9 |
| Plugin tests (10 plugins) | 615 | pytest ^9 |
| Frontend unit + integration | 1233 | Vitest 4 |
| E2E smoke | 16 spec files | Playwright |
| **Total (`make test`)** | **2634** | |

Plugin breakdown: assessment 110 + ai-anthropic 34 +
ai-openai 31 + ai-gemini 33 + session 215 + tracking 64 +
tools 58 + gamification 23 + anki 20 + notebooklm 27.

## Backend pytest

```bash
make test-backend      # 786 tests, ~35s
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
make test-plugins              # all 7
make test-plugin-session       # just one
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Plugin tests don't load the FastAPI app — they exercise the
plugin's modules in isolation. Mock the `pluggy.PluginManager`
when testing hook firing.

## Frontend Vitest

```bash
make test-frontend                # 387 tests, ~2s
cd frontend && npx vitest         # watch mode
cd frontend && npx vitest run src/storage/  # one directory
```

Tests live alongside the source: `Component.test.tsx` next to
`Component.tsx`. happy-dom is the environment; React 19 + RTL.

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

## Coverage

```bash
make test-coverage   # opt-in; slow + thermally heavy
```

Coverage runs on CI for every push to main; download the
artifacts:

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
whitespace, end-of-file fixer, check-yaml, check-merge-conflict.
Backend-only — frontend lint runs at CI time, not pre-commit.

## CI

`.github/workflows/ci.yml` runs every push to main + every PR:

1. Backend tests (Python 3.12 + 3.13 matrix)
2. Plugin tests (one job per plugin; matrix-strategy)
3. Frontend Vitest + tsc + lint
4. ruff check + format-check

`.github/workflows/release-gate.yml` runs on tag pushes:
verifies version pins are synced (no drift across 12 files),
plugin lockfiles match, regenerated artifacts are up to date.

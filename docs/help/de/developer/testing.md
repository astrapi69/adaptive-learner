# Testen

AdaptiveLearners Test-Disziplin wird durch `make test` bei
jeder Änderung erzwungen. Die Strategie ist eine Pyramide:
Unit-Tests an der Basis, Integration in der Mitte, E2E-Smoke
oben.

## Test-Zahlen (v1.20.0)

| Schicht | Anzahl | Werkzeug |
|---|---|---|
| Backend-Unit + -Integration | 786 | pytest ^9 |
| Plugin-Tests (10 Plugins) | 615 | pytest ^9 |
| Frontend-Unit + -Integration | 1233 | Vitest 4 |
| E2E-Smoke | 16 Spec-Dateien | Playwright |
| **Gesamt (`make test`)** | **2634** | |

Plugin-Aufschlüsselung: assessment 110 + ai-anthropic 34 +
ai-openai 31 + ai-gemini 33 + session 215 + tracking 64 +
tools 58 + gamification 23 + anki 20 + notebooklm 27.

## Backend-pytest

```bash
make test-backend      # 786 Tests, ~35s
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb  # bei erstem Fehler in Debugger
```

Tests leben in `backend/tests/`. Fixtures in `conftest.py`
liefern pro Test eine frische In-Memory-SQLite-DB, den
`TestClient` und einen gemockten Plugin-Manager. Test-
Isolation ist hart — `ADAPTIVE_LEARNER_TEST=1` wird vor jedem
`app.*`-Import gesetzt.

## Plugin-Tests

Jedes Plugin hat sein eigenes `tests/`-Verzeichnis:

```bash
make test-plugins              # alle 10
make test-plugin-session       # nur eines
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Plugin-Tests laden die FastAPI-App nicht — sie üben die
Plugin-Module isoliert. Mock den `pluggy.PluginManager`, wenn
du Hook-Firing testest.

## Frontend-Vitest

```bash
make test-frontend                # 1233 Tests, ~6s
cd frontend && npx vitest         # Watch-Modus
cd frontend && npx vitest run src/storage/  # ein Verzeichnis
```

Tests liegen neben dem Quelltext: `Component.test.tsx` neben
`Component.tsx`. happy-dom ist die Umgebung; React 19 + RTL.

## Mock-Patterns

**KI-Anbieter**: `global.fetch` mocken und auf URL, Headers,
Body prüfen:

```typescript
beforeEach(() => {
  global.fetch = vi.fn(async (input, init) => {
    calls.push({url, method, body});
    return new Response(JSON.stringify({content: [{type: "text", text: "hi"}]}), {status: 200});
  });
});
```

**fake-indexeddb**: am Anfang jeder Dexie-Test-Datei:

```typescript
import "fake-indexeddb/auto";

beforeEach(async () => {
  await _resetDbForTests();
  const {IDBFactory} = await import("fake-indexeddb");
  (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});
```

Jeder Test bekommt eine frische In-Memory-IndexedDB — kein
Leak.

**api/client.ts-Mocks** (Legacy-Seiten):

```typescript
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {...actual, api: {...actual.api, users: {...actual.api.users, get: apiGetMock}}};
});
```

Die Seite importiert `getStorage()`, das an ApiStorage
delegiert, das wiederum an `api.*` delegiert. Der Mock klinkt
sich auf der `api.*`-Ebene ein und feuert weiter durch den
Storage-Stack.

## Playwright-E2E

```bash
cd e2e && npx playwright test
cd e2e && npx playwright test --ui   # interaktiv
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

Smoke-Specs decken die kritischen User-Pfade ab:

- Landing-Sprachwahl + Onboarding-Formular
- Lerntyp-Test 12 Fragen + Radar
- Session starten + beenden + bewerten
- Einstellungen Sprache + API-Key
- Curriculum anlegen
- Mobile Viewports (iPhone SE, iPhone 14, Pixel 7, iPad)

Specs nutzen ausschließlich `data-testid`-Selektoren — keine
brüchigen CSS-Selektoren. Smoke-Specs sind NICHT im
`make test`-Pfad; sie brauchen eine laufende App
(`make dev-bg` zuerst).

## Coverage

```bash
make test-coverage   # opt-in; langsam + thermisch heftig
```

Coverage läuft auf CI bei jedem Push auf main; Artefakte
herunterladen:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Targets per `.claude/rules/quality-checks.md`:

- Services + Business-Logik: 95% min
- API-Endpunkte: 90% min
- Frontend-Komponenten mit Logik: 85% min
- Hooks + Utilities: 95% min

Gesamt: 85-95% projektweit.

## Pre-Commit

```bash
cd backend && poetry run pre-commit install
```

Hooks: ruff check (Auto-Fix), ruff format, Trailing
Whitespace, End-of-File-Fixer, check-yaml,
check-merge-conflict. Nur Backend — Frontend-Lint läuft zur
CI-Zeit, nicht pre-commit.

## CI

`.github/workflows/ci.yml` läuft bei jedem Push auf main +
jedem PR:

1. Backend-Tests (Python 3.12 + 3.13 Matrix)
2. Plugin-Tests (ein Job pro Plugin; Matrix-Strategy)
3. Frontend-Vitest + tsc + Lint
4. ruff check + Format-Check

`.github/workflows/release-gate.yml` läuft bei Tag-Pushes:
verifiziert Version-Pins (kein Drift über 12 Dateien), Plugin-
Lockfiles passen, regenerierte Artefakte sind aktuell.

## Manueller Testplan

Was Automatisierung nicht abdeckt (Layout, Lesbarkeit,
Touch-Bedienung, Theme-Kontraste), prüft eine manuelle
Checkliste vor jedem größeren Release:
[MANUAL-TESTPLAN.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/MANUAL-TESTPLAN.md).

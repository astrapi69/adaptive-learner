# Testen

AdaptiveLearners Test-Disziplin wird durch `make test` bei
jeder Änderung erzwungen. Die Strategie ist eine Pyramide:
Unit-Tests an der Basis, Integration in der Mitte, E2E-Smoke
oben.

## Test-Zahlen

| Schicht | Werkzeug |
|---|---|
| Backend-Unit + -Integration | pytest ^9 |
| Plugin-Tests (13 Plugins) | pytest ^9 |
| Frontend-Unit + -Integration | Vitest 4 |
| E2E-Smoke | Playwright |
| Dexie-Modus-Release-Gate | Playwright |

Die Zahlen wachsen mit jedem Release. Um duplizierte Zahlen zu
vermeiden, die auseinanderdriften, hält diese Seite KEINE
Gesamtzahl fest. `docs/audits/current-coverage.md` ist die
einzige kanonische, stets aktuelle Quelle für Test-Zahlen und
Coverage. Die 13 Plugins sind assessment, die drei KI-Anbieter
(anthropic / openai / gemini), session, tracking, tools,
gamification, anki, notebooklm, learning-repo, content-loader
und missions.

## Backend-pytest

```bash
make test-backend
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
make test-plugins              # alle 13
make test-plugin-session       # nur eines
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Plugin-Tests laden die FastAPI-App nicht — sie üben die
Plugin-Module isoliert. Mock den `pluggy.PluginManager`, wenn
du Hook-Firing testest.

## Frontend-Vitest

```bash
make test-frontend                # führt Vitest aus frontend/ aus
cd frontend && bunx vitest         # Watch-Modus
cd frontend && bunx vitest run src/storage/  # ein Verzeichnis
```

Vitest aus `frontend/` ausführen (die Konfiguration liegt in
`frontend/vite.config.ts`), oder über `make test-frontend`. Aus
dem Repo-Wurzelverzeichnis wird die Konfiguration nicht
gefunden, die `node`-Umgebung verwendet, und DOM-nutzende Tests
scheitern mit `ReferenceError: document is not defined`.

Tests liegen neben dem Quelltext: `Component.test.tsx` neben
`Component.tsx`. happy-dom ist die Umgebung; React 19 + RTL.
Die i18n-Paritäts-Prüfung (11 Sprachen), die
Theme-Token-Paritäts-Prüfung und die Design-Token-Prüfung
("keine hartkodierten Farben") laufen als Vitest-Tests in
derselben Suite.

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

Neben `e2e/smoke/` enthält der `e2e/`-Baum drei weitere
Spec-Familien:

- `e2e/dexie/` — das Dexie-Modus-Release-Gate. Baut das
  Frontend mit `VITE_STORAGE_MODE=dexie` (die GitHub-Pages-Form,
  ohne Backend) und läuft jede über die Navigation erreichbare
  Route ab; jeder Fehler-Toast oder Seitenabsturz lässt es
  scheitern. Ausführen mit `make test-dexie-smoke`.
- `e2e/visual/` — Visuelle Baseline-Regressions-Specs.
- `e2e/manual-automation/` — Playwright-Automatisierung des
  manuellen Testplans.

## Coverage

```bash
make test-coverage   # opt-in; langsam + thermisch heftig
```

Coverage ist ein Bericht, kein Merge-Gate, und läuft daher
nicht bei PRs. Der `coverage.yml`-Workflow läuft nächtlich
(und auf Abruf); Artefakte herunterladen:

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
Whitespace, End-of-File-Fixer, check-yaml, check-json,
check-added-large-files, check-merge-conflict, Frontend-ESLint,
eine Plugin-Lockfile/pyproject-Paarungs-Prüfung und ein
Bundled-Content-Statistik-Validator. Im CI-Pre-Commit-Job
werden die Hooks `prettier-frontend` und `eslint`
übersprungen (der Frontend-Tests-Job führt ESLint stattdessen
mit installierten Abhängigkeiten aus).

## CI

CI teilt sich in zwei Stufen: Korrektheits-Gates laufen bei
jedem PR (sie müssen zum Mergen grün sein), und die teuren oder
nur-warnenden Suiten laufen zur Nachtschicht und beim Release.

`.github/workflows/ci.yml` läuft bei Push auf `develop` /
`main` und bei jedem PR (Python 3.12):

1. Backend-Tests (pytest)
2. Plugin-Tests (`make test-plugins`, alle 13 über die
   Backend-venv)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`),
   Circular-Dependency-Prüfung, Stylelint, Vitest,
   `vite build`, `npm audit`
4. Pre-Commit-Hooks über alle Dateien
5. Backend ruff + mypy + pip-audit
6. Docs-Drift-Verifizierer (`verify_docs.py` + mkdocs-nav-Sync)

**Test Impact Analysis (#615):** bei einem PR laufen nur die
betroffenen Tests — `vitest run --changed origin/<base>` und
`pytest --testmon`. Push auf `develop` / `main`, die
nächtlichen Läufe und der Release-Lauf führen immer die VOLLE
Suite aus. Der Rückfall auf die volle Suite ist automatisch
(nicht auflösbare Basis-Referenz oder ein testmon-Cache-Miss).

Zwei weitere PR-Gates leben in eigenen Workflows:

- `complexity-check.yml` — das Komplexitäts-Ratschen-Gate
  (`make check-complexity-gate`, radon für Python +
  ESLint-Komplexität für TS). Es ist ein Baseline-Ratschen: es
  scheitert nur an NEUEN oder verschlechterten Verstößen
  gegenüber `.complexity-baseline`, blockiert also neue
  Komplexität, ohne ein Aufräumen der bestehenden Schuld zu
  erzwingen. Der volle nur-warnende Komplexitätsbericht läuft
  nächtlich.
- `cohesion-check.yml` — die Dateigrößen-Prüfung (Gate gegen
  `.filesize-whitelist`). Die begleitende Ordnergrößen-Prüfung
  läuft lokal über `make check-folder-size`.

**Nachtschicht / Release (nicht bei PRs):**

- `dexie-smoke.yml` — Dexie-Modus-E2E-Gate (täglich + auf
  `release/**` + Abruf; lokal `make test-dexie-smoke`)
- `coverage.yml` — Coverage-Bericht (täglich + Abruf)
- `security-scan.yml` — pip-audit / npm audit / bandit
  (wöchentlich + auf `release/**` + Abruf; nur-warnend)
- `content-stats.yml` — Content-Statistik-Drift gegen ein
  frisches Content-Checkout (täglich + Abruf)
- `mutation-frontend.yml` — Stryker-Mutation-Testing (gegatetes
  Nächtlich + Abruf); Backend-Mutation-Testing nutzt mutmut

`.github/workflows/release-gate.yml` läuft bei Tag-Pushes:
verifiziert, dass alle versionstragenden Dateien im Gleichschritt
sind (kein Drift), Plugin-Lockfiles passen, und regenerierte
Artefakte aktuell sind.

## Manueller Testplan

Was Automatisierung nicht abdeckt (Layout, Lesbarkeit,
Touch-Bedienung, Theme-Kontraste), prüft eine manuelle
Checkliste vor jedem größeren Release:
[MANUAL-TESTPLAN.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/MANUAL-TESTPLAN.md).

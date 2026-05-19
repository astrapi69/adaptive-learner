# Dev-Umgebung aufsetzen

## Voraussetzungen

- **Python 3.12+** (3.11 reicht fürs Backend, Plugins testen
  aber mit 3.12).
- **Node 24+** (von Vite 8 gefordert). Ältere Node-Versionen
  scheitern beim Build mit `crypto.hash is not a function`.
- **Poetry** für Python-Dependencies. Installation:
  `curl -sSL https://install.python-poetry.org | python3 -`.
- **npm** (kommt mit Node).
- **GNU Make** für die Orchestrierungs-Targets. Das Makefile
  ist die Source of Truth — jeder CI-Befehl steht dort.

## Klonen + installieren

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install
```

`make install` führt aus:

1. `cd backend && poetry install` — Backend + Plugin-
   Path-Deps.
2. `cd frontend && npm ci` — Frontend-Dependencies (Node 24).
3. Installiert jedes Plugin aus `plugins/` als Path-Dep ins
   Backend-Venv (`develop = true` — Änderungen wirken sofort).

Wenn `make install` scheitert, ist die häufigste Ursache, dass
Poetry das falsche Python wählt. In `backend/` (und jedem
Plugin, falls nötig) `poetry env use python3.12` ausführen und
neu installieren.

## Konfiguration

Das Backend liest seine Konfig aus einer 3-Schichten-Kette:

1. **Defaults** in `backend/config/app.yaml`.
2. **User-Overlay** unter
   `~/.config/adaptive_learner/secrets.yaml` (gitignored,
   optional).
3. **Umgebungsvariablen** mit Präfix `ADAPTIVE_LEARNER_*` —
   höchste Priorität.

Die einzige Pflicht-Variable ist `ADAPTIVE_LEARNER_SECRET_KEY`
— wird genutzt, um User-API-Keys mit Fernet zu verschlüsseln.
Erzeugen mit `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
Wenn nicht gesetzt, generiert `start.sh` automatisch einen und
schreibt ihn in `~/.config/adaptive_learner/secrets.yaml`.

## Starten

```bash
make dev
```

Startet Backend auf Port 18001 und Frontend auf Port 15174,
parallel. Backend mit Hot-Reload via uvicorns `--reload`;
Frontend nutzt Vites Dev-Server. Ctrl-C einmal stoppt beide.

Hintergrund-Modus:

```bash
make dev-bg   # Backend + Frontend im Hintergrund starten
make dev-down # beide stoppen
```

## Tests

```bash
make test                 # Backend + Plugins + Frontend Vitest
make test-backend         # nur Backend pytest
make test-frontend        # nur Frontend Vitest
make test-coverage        # opt-in Coverage-Run (langsam)
```

E2E-Tests:

```bash
cd e2e && npx playwright test
```

Nur Smoke-Specs — noch keine umfassende UI-Abdeckung. Smoke-
Specs decken Landing, Onboarding, Session, Settings,
Curriculum und mobile Viewports ab.

## Linting + Formatieren

```bash
cd backend && poetry run ruff check .       # Python-Lint
cd backend && poetry run ruff format .      # Python-Formatter
cd frontend && npx tsc --noEmit             # TypeScript-Check
cd frontend && npm run lint                 # ESLint
cd frontend && npm run format               # Prettier
```

Pre-Commit-Hooks erzwingen ruff + Formatter-Checks bei jedem
Commit:

```bash
cd backend && poetry run pre-commit install
```

## Docs

```bash
make docs-install   # einmalig, installiert das MkDocs-Venv in docs/
make docs-serve     # lokal auf localhost:8000 mit Hot-Reload
make docs-build     # statische Seite nach site/ bauen
```

Das Docs-Venv ist getrennt vom Backend-Venv — MkDocs hat ein
eigenes `docs/pyproject.toml` mit mkdocs-material +
mkdocs-static-i18n.

## Häufige Stolperfallen

- **`make dev` crasht mit "port already in use"**: Eine
  andere AdaptiveLearner-Instanz läuft noch. `make dev-down`
  oder `pkill -f uvicorn`.
- **Tests scheitern mit "duplicate column name"**: Eine
  Alembic-Migration hat das Schema verändert.
  `backend/adaptive_learner.db` löschen und neu starten.
- **`npm run build` scheitert auf Node 18**: Auf Node 24
  hochziehen. Vite 8 verlangt es.

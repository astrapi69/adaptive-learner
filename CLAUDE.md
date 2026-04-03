# Adaptive Learner

Adaptives Lernsystem basierend auf der Artikelserie "Von Theorie zur Praxis". Aufgebaut auf PluginForge (PyPI), einem wiederverwendbaren Plugin-Framework basierend auf pluggy. Erkennt den Lerntyp des Nutzers, fuehrt KI-gestuetzte Lernsessions durch und wechselt automatisch zwischen 6 Methoden.

**Repository:** https://github.com/astrapi69/adaptive-learner
**PluginForge:** https://github.com/astrapi69/pluginforge (PyPI: pluginforge)
**Konzept:** docs/CONCEPT.md
**Roadmap:** docs/ROADMAP.md
**Version:** 0.0.0 (Scaffolding, python-poetry-template)

## Entwicklungsrichtlinien

Detaillierte Regeln fuer Claude Code in `.claude/rules/`:

- `architecture.md` - Schichtenmodell, Plugin-Struktur, Datenfluss
- `coding-standards.md` - Benennung, Formatierung, Tests, Dependencies
- `ai-workflow.md` - Reihenfolge bei Features/Plugins, Verbote, Dokumentation
- `lessons-learned.md` - Bekannte Fallstricke (PluginForge, AI-Provider, Sessions)
- `quality-checks.md` - Selbstpruefung, Teststrategie, Checklisten vor dem Commit
- `code-hygiene.md` - Linting, Formatierung, Pre-Commit Hooks, Error-Handling, API-Konventionen

Bei Widerspruch zwischen CLAUDE.md und Rules gelten die Rules.

## Architektur (Zwei-Schichten)

1. **PluginForge** (externes PyPI-Paket, basiert auf pluggy)
   - PluginManager: wraps pluggy + YAML-Config + Lifecycle + Dependency Resolution
   - FastAPI-Router-Integration (Plugins liefern eigene Router)
   - i18n ueber YAML (config/i18n/{lang}.yaml)
   - Anwendungsunabhaengig, jeder kann es nutzen

2. **Adaptive Learner App** (dieses Repo)
   - Schlanker Kern: User, LearningProject CRUD, Settings, API-Key-Verwaltung
   - Alles Weitere via Plugins: Assessment, Sessions, AI-Provider, Tracking, Tools

## Tech Stack

- **PluginForge:** Python 3.11+, pluggy, PyYAML (PyPI: pluginforge)
- **Backend:** FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2
- **Frontend:** React 18, TypeScript, Vite, Recharts
- **AI-Provider:** anthropic SDK, openai SDK, google-generativeai SDK
- **Sicherheit:** cryptography (Fernet fuer API-Key-Verschluesselung)
- **Tooling:** Poetry, npm, Docker, Make
- **Code-Qualitaet:** ruff, black, mypy, pre-commit, pytest-cov

## Befehle

```bash
# Entwicklung
make install              # Backend (Poetry) + Frontend (npm)
make dev                  # Backend (8000) + Frontend (5173) parallel
make dev-backend          # Nur Backend
make dev-frontend         # Nur Frontend

# Tests
make test                 # Alle Backend-Tests
make test-plugins         # Alle Plugin-Tests
make lint                 # ruff + black check
make format               # ruff + black fix

# Produktion
make build                # Docker Compose build
make up                   # Docker Compose up
make down                 # Docker Compose down

# Sonstiges
make clean                # Build-Artefakte und Caches entfernen
make help                 # Alle Targets anzeigen
```

## Verzeichnisstruktur

```
adaptive-learner/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI Entry, PluginManager Init
│   │   ├── database.py          # SQLAlchemy + SQLite
│   │   ├── hookspecs.py         # pluggy Hook-Specs
│   │   ├── models/              # User, LearningProject, UserSettings
│   │   ├── schemas/             # Pydantic Request/Response
│   │   ├── routers/             # users, projects, settings
│   │   └── services/
│   │       └── crypto.py        # API-Key-Verschluesselung (Fernet)
│   ├── plugins/
│   │   ├── assessment/          # Lerntyp-Ermittlung (12 Fragen)
│   │   ├── session/             # 7-Schritte-Zyklus, Chat, Prompts
│   │   ├── ai_anthropic/        # Claude API Provider
│   │   ├── ai_openai/           # GPT API Provider
│   │   ├── ai_gemini/           # Gemini API Provider
│   │   ├── tracking/            # Fortschritt, ProgressCommits
│   │   └── tools/               # Werkzeug-Empfehlungen
│   ├── config/
│   │   ├── app.yaml
│   │   ├── plugins/             # session.yaml, ai-anthropic.yaml, etc.
│   │   └── i18n/                # de.yaml, en.yaml, es.yaml, fr.yaml, el.yaml
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/client.ts
│   │   ├── i18n/translations/   # de.ts, en.ts, es.ts, fr.ts, el.ts
│   │   ├── components/          # ProfileRadar, SessionChat, CycleProgress, etc.
│   │   ├── pages/               # Landing, Onboarding, Assessment, Dashboard, Session, Progress, Settings
│   │   └── styles/global.css
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── CONCEPT.md
│   └── ROADMAP.md
├── .claude/rules/               # Regeln fuer Claude Code
├── Makefile
├── docker-compose.yml
└── README.md
```

## Sechs Methoden (Interne Keys)

| Key | Methode | Farbe |
|-----|---------|-------|
| `deductive` | Deduktiv | #3B82F6 (Blau) |
| `inductive` | Induktiv | #8B5CF6 (Violett) |
| `error_based` | Fehlerzentriert | #EF4444 (Rot) |
| `dialogic` | Dialogisch | #10B981 (Gruen) |
| `contextual` | Kontextuell | #F59E0B (Amber) |
| `ai_adaptive` | KI-adaptiv | #6366F1 (Indigo) |

## 7-Schritte-Zyklus (Keys)

`input` -> `attempt` -> `error` -> `feedback` -> `adapt` -> `repeat` -> `integrate`

## Plugin-Registrierung (v0.1.0)

Plugins liegen im Repo (backend/plugins/). Manuelle Registrierung in main.py via `pm.register_plugin()`. Entry Points erst ab v0.3.0.

## API-Endpunkte

### Core

- GET/POST /api/users, GET/PATCH /api/users/{id}
- POST /api/users/{id}/projects, GET /api/users/{id}/projects
- GET/PATCH /api/settings/{user_id}
- POST /api/settings/{user_id}/api-key

### Plugins

- GET /api/plugins/assessment/questions
- POST /api/plugins/assessment/evaluate
- GET /api/plugins/assessment/profile/{project_id}
- POST /api/plugins/session/start
- POST /api/plugins/session/{id}/message
- POST /api/plugins/session/{id}/rate
- POST /api/plugins/session/{id}/end
- GET /api/plugins/tracking/progress/{project_id}
- GET /api/plugins/tracking/commits/{project_id}
- GET /api/plugins/tools/recommendations/{project_id}

## Datenmodell

User: id, name, email, language, created_at, updated_at
LearningProject: id, user_id, topic, goal, timeframe, daily_minutes, current_problem, active
UserSettings: id, user_id, active_provider, api_key_anthropic (encrypted), api_key_openai, api_key_gemini
LearningProfile: id, user_id, project_id, deductive, inductive, error_based, dialogic, contextual, ai_adaptive (floats 0-1)
LearningSession: id, project_id, method, started_at, ended_at, cycle_step, status
SessionMessage: id, session_id, role, content, created_at
SessionRating: id, session_id, understanding (1-5), stress (1-5), method_fit (1-5)
ProgressCommit: id, project_id, session_id, method, understanding, stress, error_rate, duration_minutes
MethodSwitch: id, project_id, from_method, to_method, reason, switched_at

## Plugins

| Plugin | Beschreibung |
|--------|-------------|
| assessment | Lerntyp-Ermittlung, 12 Fragen, Profil-Berechnung |
| session | 7-Schritte-Zyklus, Chat, Methoden-Prompts, Wechsel-Logik |
| ai-anthropic | Claude API Provider |
| ai-openai | GPT API Provider |
| ai-gemini | Gemini API Provider |
| tracking | ProgressCommits, Stagnation-Detection, Dashboard-Daten |
| tools | Werkzeug-Empfehlungen (Anki, NotebookLM, KI-Prompt) |

## Erledigte Phasen

(Noch keine - Projekt startet.)

## Naechste Schritte

Siehe docs/ROADMAP.md fuer die nummerierte Taskliste.

## Tests

Noch keine. Ziel: >= 80% Coverage.

- Backend: pytest + TestClient
- Plugins: pytest mit Mocks (keine echten AI-Calls)
- Frontend: Vitest (spaeter)
- E2E: Playwright (spaeter)

## Verwandte Projekte

- [pluginforge](https://github.com/astrapi69/pluginforge) - Plugin-Framework (PyPI: pluginforge)
- [bibliogon](https://github.com/astrapi69/bibliogon) - Buch-Autoren-Plattform (erste App auf PluginForge)
- Artikelserie "Von Theorie zur Praxis" auf Medium

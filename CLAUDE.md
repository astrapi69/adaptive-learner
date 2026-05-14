# CLAUDE.md

## Was ist Adaptive Learner?

Adaptives Lernsystem basierend auf der Artikelserie "Von Theorie zur Praxis". Zweite App auf PluginForge (nach Bibliogon). Erkennt Lerntyp, fuehrt KI-Lernsessions durch, wechselt automatisch zwischen 6 Methoden.

**Repository:** https://github.com/astrapi69/adaptive-learner
**Konzept:** docs/CONCEPT.md (lesen vor jeder Aenderung)
**Lizenz:** MIT

## Tech Stack

- Python 3.12+, Poetry
- pluginforge (PyPI, basiert auf pluggy)
- FastAPI 0.136+, SQLAlchemy 2.0, Pydantic 2.11+, SQLite
- React 19, TypeScript 6, Vite 8, Recharts 3.8
- anthropic SDK (erster AI-Provider)
- Node.js 24+, npm
- Lucide React (Icons)
- ruff, mypy, pre-commit, pytest, vitest
- Docker, Make

## Verzeichnisstruktur

Das Repo basiert auf python-poetry-template. Es wird umgebaut zu einer Backend+Frontend Struktur:

```
adaptive-learner/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI + PluginForge Setup
│   │   ├── database.py          # SQLAlchemy + SQLite
│   │   ├── hookspecs.py         # AdaptiveLearnerHookSpec
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py          # User, UserSettings
│   │   │   └── project.py       # LearningProject
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   └── settings.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── users.py
│   │   │   ├── projects.py
│   │   │   └── settings.py
│   │   └── services/
│   │       └── crypto.py        # Fernet API-Key-Verschluesselung
│   ├── plugins/
│   │   ├── assessment/
│   │   │   ├── __init__.py
│   │   │   ├── plugin.py        # AssessmentPlugin(BasePlugin)
│   │   │   ├── questions.py     # Fragen (5 Sprachen)
│   │   │   └── models.py        # LearningProfile
│   │   ├── session/
│   │   │   ├── __init__.py
│   │   │   ├── plugin.py        # SessionPlugin(BasePlugin)
│   │   │   ├── prompts.py       # System-Prompts pro Methode + Schritt
│   │   │   ├── models.py        # LearningSession, SessionMessage, SessionRating
│   │   │   └── switching.py     # Methoden-Wechsel-Logik
│   │   ├── ai_anthropic/
│   │   │   ├── __init__.py
│   │   │   └── plugin.py
│   │   ├── ai_openai/
│   │   │   ├── __init__.py
│   │   │   └── plugin.py
│   │   ├── ai_gemini/
│   │   │   ├── __init__.py
│   │   │   └── plugin.py
│   │   ├── tracking/
│   │   │   ├── __init__.py
│   │   │   ├── plugin.py
│   │   │   └── models.py        # ProgressCommit, MethodSwitch
│   │   └── tools/
│   │       ├── __init__.py
│   │       └── plugin.py
│   ├── config/
│   │   ├── app.yaml
│   │   ├── plugins/
│   │   │   ├── session.yaml
│   │   │   ├── ai-anthropic.yaml
│   │   │   ├── ai-openai.yaml
│   │   │   └── ai-gemini.yaml
│   │   └── i18n/
│   │       ├── de.yaml
│   │       ├── en.yaml
│   │       ├── es.yaml
│   │       ├── fr.yaml
│   │       └── el.yaml
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_assessment.py
│   │   ├── test_session.py
│   │   ├── test_tracking.py
│   │   └── test_api.py
│   └── pyproject.toml           # Backend-Dependencies (FastAPI, pluginforge, etc.)
├── frontend/
│   ├── src/
│   │   ├── api/client.ts
│   │   ├── i18n/
│   │   │   ├── index.ts
│   │   │   └── translations/    # de.ts, en.ts, es.ts, fr.ts, el.ts
│   │   ├── components/
│   │   │   ├── ProfileRadar.tsx
│   │   │   ├── ProgressTimeline.tsx
│   │   │   ├── SessionChat.tsx
│   │   │   ├── CycleProgress.tsx
│   │   │   ├── MethodBadge.tsx
│   │   │   ├── RatingDialog.tsx
│   │   │   └── MethodSwitchBanner.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx
│   │   │   ├── Onboarding.tsx
│   │   │   ├── Assessment.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Session.tsx
│   │   │   ├── Progress.tsx
│   │   │   └── Settings.tsx
│   │   ├── hooks/
│   │   │   ├── useSession.ts
│   │   │   └── useProfile.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles/global.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/
│   └── CONCEPT.md
├── .github/workflows/ci.yml    # Vom Template, anpassen
├── .pre-commit-config.yaml     # Vom Template, behalten
├── .env.example
├── .gitignore
├── Makefile                     # Erweitern fuer Backend+Frontend
├── docker-compose.yml
├── docker-compose.prod.yml
├── LICENSE
├── CLAUDE.md
└── README.md
```

## Umbau vom Template

Das Repo basiert auf python-poetry-template. Folgende Aenderungen:

1. `scripts/` und root `tests/` entfernen (Template-Reste)
2. Root `pyproject.toml` entfernen oder als Workspace-File behalten
3. `backend/` Ordner mit eigenem `pyproject.toml` anlegen
4. `frontend/` Ordner mit Vite + React anlegen
5. `Makefile` erweitern (install, dev, test fuer Backend+Frontend)
6. `docker-compose.yml` anlegen
7. `.github/workflows/ci.yml` anpassen

## Konventionen

- Python: Typehints, kein `Any` wo konkreter Typ moeglich
- TypeScript: kein `any`
- Keine Em-Dashes (--), stattdessen Bindestriche (-) oder Kommata
- Commits: Englisch, konventionell (feat/fix/refactor/docs/test)
- API-Prefix: /api/
- Plugin-Routen: /api/plugins/{plugin-name}/
- SQLAlchemy 2.0 Mapped Columns
- Pydantic v2 mit ConfigDict(from_attributes=True)
- Konfiguration in YAML, nicht hartcodiert
- Logging: `logging.getLogger(__name__)`

## Plugin-Registrierung (v0.1.0)

Plugins liegen im Repo (backend/plugins/). Manuelle Registrierung in main.py:

```python
from pluginforge import PluginManager
from app.hookspecs import AdaptiveLearnerHookSpec
from plugins.assessment.plugin import AssessmentPlugin
from plugins.session.plugin import SessionPlugin
from plugins.ai_anthropic.plugin import AnthropicPlugin
from plugins.tracking.plugin import TrackingPlugin
from plugins.tools.plugin import ToolsPlugin

pm = PluginManager("config/app.yaml")
pm.register_hookspecs(AdaptiveLearnerHookSpec)

pm.register_plugin(AssessmentPlugin())
pm.register_plugin(SessionPlugin())
pm.register_plugin(AnthropicPlugin())
pm.register_plugin(TrackingPlugin())
pm.register_plugin(ToolsPlugin())

pm.mount_routes(app)
```

## Sechs Methoden - Keys

```python
METHODS = ["deductive", "inductive", "error_based", "dialogic", "contextual", "ai_adaptive"]
```

Konsistent ueberall: DB, API, Frontend, Config, Prompts.

## 7-Schritte-Zyklus - Keys

```python
CYCLE_STEPS = ["input", "attempt", "error", "feedback", "adapt", "repeat", "integrate"]
```

## System-Prompt-Strategie

Jede Methode hat ein Prompt-Template. Der Prompt wird zusammengebaut aus:

1. Methoden-Instruktion (was soll die KI tun)
2. Thema + Ziel des Lernprojekts
3. Aktueller Zyklus-Schritt (1-7)
4. Bisheriger Session-Verlauf
5. Sprache des Nutzers

Templates in `plugins/session/prompts.py`:

| Methode | Prompt-Kern |
|---------|------------|
| deductive | "Erklaere Regel zuerst, dann Uebungen" |
| inductive | "Gib Beispiele, Nutzer leitet Regel ab" |
| error_based | "Provoziere typische Fehler, erklaere warum" |
| dialogic | "Fuehre Gespraech, korrigiere sofort, Stress niedrig" |
| contextual | "Simuliere Alltagssituation zum Thema" |
| ai_adaptive | "Waehle passende Methode, begruende" |

## Methoden-Wechsel-Logik

`plugins/session/switching.py`:

- Verstaendnis stagniert ueber 3 Sessions UND Stress > 3.0 -> Wechsel empfehlen
- Empfohlene Methode: Naechstbeste aus Profil, die laenger nicht genutzt wurde
- Nutzer entscheidet (Empfehlung, kein Zwang)

## API-Key-Handling

- POST /api/settings/{user_id}/api-key: Key kommt rein
- Fernet-Verschluesselung, Schluessel aus `ADAPTIVE_LEARNER_SECRET_KEY` Env-Variable
- In DB gespeichert (UserSettings)
- Beim AI-Aufruf: entschluesseln, an SDK uebergeben
- Frontend bekommt NIE den Klartext, nur "gespeichert" + Provider-Name

## Methoden-Farben (Frontend)

```typescript
const METHOD_COLORS = {
  deductive:   "#3B82F6",  // Blau
  inductive:   "#8B5CF6",  // Violett
  error_based: "#EF4444",  // Rot
  dialogic:    "#10B981",  // Gruen
  contextual:  "#F59E0B",  // Amber
  ai_adaptive: "#6366F1",  // Indigo
};
```

## Frontend i18n (v0.1.0)

Einfaches Pattern ohne externes Framework:

```typescript
const translations = { de: {...}, en: {...}, es: {...}, fr: {...}, el: {...} };
const t = translations[currentLang];
```

## Config-Dateien

### config/app.yaml

```yaml
app:
  name: "Adaptive Learner"
  version: "0.1.0"
  default_language: "de"
  secret_key_env: "ADAPTIVE_LEARNER_SECRET_KEY"

plugins:
  entry_point_group: "adaptivelearner.plugins"
  enabled:
    - "assessment"
    - "session"
    - "ai-anthropic"
    - "tracking"
    - "tools"

database:
  url: "sqlite:///./adaptive_learner.db"

cors:
  origins:
    - "http://localhost:5173"
```

### config/plugins/session.yaml

```yaml
default_method: "ai_adaptive"
max_session_duration_minutes: 60
cycle_steps: 7
stagnation_threshold_sessions: 3
stagnation_stress_threshold: 3.0
```

### config/plugins/ai-anthropic.yaml

```yaml
default_model: "claude-sonnet-4-20250514"
max_tokens: 2048
```

## Backend pyproject.toml Dependencies

```toml
[tool.poetry.dependencies]
python = "^3.12"
pluginforge = ">=0.1.0"
fastapi = {extras = ["standard"], version = "^0.136"}
sqlalchemy = "^2.0.49"
pydantic = "^2.11"
pyyaml = "^6.0"
cryptography = "^45.0"
anthropic = "^0.55"

[tool.poetry.group.dev.dependencies]
pytest = "^8.3"
pytest-cov = "^6.0"
httpx = "^0.28"
ruff = "^0.11"
mypy = "^1.15"
```

## Frontend package.json Dependencies

```json
{
  "dependencies": {
    "lucide-react": "^1.8.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.14.1",
    "recharts": "^3.8.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^24.12.2",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^5.2.0",
    "@vitest/coverage-v8": "^4.1.6",
    "happy-dom": "^20.9.0",
    "typescript": "^6.0.3",
    "vite": "^8.0.12",
    "vitest": "^4.1.6"
  },
  "engines": { "node": ">=24.0.0" }
}
```

## Makefile Targets (erweitert)

```makefile
# Backend
install-backend:    cd backend && poetry install --with dev
dev-backend:        cd backend && poetry run uvicorn app.main:app --reload --port 8000
test:               cd backend && poetry run pytest
lint:               cd backend && poetry run ruff check .
format:             cd backend && poetry run ruff format .

# Frontend
install-frontend:   cd frontend && npm install
dev-frontend:       cd frontend && npm run dev
test-frontend:      cd frontend && npx vitest run

# Beide
install:            make install-backend && make install-frontend
dev:                make dev-backend & make dev-frontend

# Docker
build:              docker compose build
up:                 docker compose up
```

## Tests

- pytest, Ziel >= 80% Coverage
- AI-Provider: Mocks (keine echten API-Calls)
- Assessment: Deterministische Profil-Berechnung
- Switching-Logik: Unit-Tests mit verschiedenen Rating-Szenarien
- API: FastAPI TestClient + httpx

## Implementierungs-Reihenfolge

1. Template-Reste aufraemen (scripts/, root tests/ entfernen)
2. `backend/` Struktur anlegen mit `pyproject.toml`
3. `backend/app/database.py` + Core-Models (User, LearningProject, UserSettings)
4. `backend/app/hookspecs.py`
5. `backend/app/main.py` (FastAPI + PluginForge)
6. Core-Router (users, projects, settings)
7. `backend/plugins/assessment/` (Fragen DE+EN, Profil-Berechnung)
8. `backend/plugins/ai_anthropic/`
9. `backend/plugins/session/` (Prompts, Zyklus, Chat)
10. `backend/plugins/tracking/` (ProgressCommits)
11. `backend/plugins/tools/` (Empfehlungen)
12. `frontend/` Scaffolding (Vite + React + TypeScript)
13. Frontend: Landing, Onboarding, Assessment
14. Frontend: Dashboard (Recharts)
15. Frontend: Session Chat-Interface
16. Frontend: Settings, Progress
17. Config-Dateien (app.yaml, plugin YAMLs, i18n)
18. Docker Compose
19. Tests
20. README aktualisieren

## Kontext

Basiert auf vier Artikeln der Serie "Von Theorie zur Praxis":
1. "Adaptive Learning: Lerne, wie du wirklich lernst" - 6 Methoden, Lernzyklus
2. "Adaptives Lernen in der Praxis" - Prompt-Verlaeufe
3. "Lernfortschritt versionieren: Git als Lernsystem" - Tracking
4. "Effizient lernen: Die drei Bausteine" - Anki, NotebookLM, KI-Prompt

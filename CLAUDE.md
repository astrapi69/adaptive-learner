# CLAUDE.md

## Was ist AdaptivLearner?

Adaptives Lernsystem basierend auf der Artikelserie "Von Theorie zur Praxis". Zweite Anwendung auf PluginForge (nach Bibliogon). Erkennt den Lerntyp des Nutzers, fuehrt KI-gestuetzte Lernsessions durch und wechselt automatisch zwischen 6 Methoden.

**Repository:** https://github.com/astrapi69/adaptive-learner
**Konzept:** docs/CONCEPT.md (lesen vor jeder Aenderung)
**Lizenz:** MIT
**Ziel:** v0.1.0 mit Assessment, Sessions, Tracking, Claude-Provider

## Tech Stack

- Python 3.11+
- PluginForge (eigenes Framework, basiert auf pluggy) - muss als Dependency installiert sein
- FastAPI (Backend)
- SQLAlchemy 2.0 + SQLite (Datenbank)
- React 18 + TypeScript + Vite (Frontend)
- Recharts (Charts im Dashboard)
- anthropic SDK (erster AI-Provider)
- Poetry (Backend), npm (Frontend)
- Docker, Make

## Verzeichnisstruktur

```
adaptivlearner/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI Entry + PluginForge Setup
│   │   ├── database.py          # SQLAlchemy + SQLite
│   │   ├── models/
│   │   │   ├── user.py          # User
│   │   │   └── project.py       # LearningProject
│   │   ├── schemas/             # Pydantic Request/Response
│   │   ├── routers/
│   │   │   ├── users.py
│   │   │   ├── projects.py
│   │   │   └── settings.py
│   │   ├── services/
│   │   │   └── crypto.py        # API-Key-Verschluesselung (Fernet)
│   │   └── hookspecs.py         # AdaptivLearnerHookSpec
│   ├── plugins/
│   │   ├── assessment/
│   │   │   ├── __init__.py
│   │   │   ├── plugin.py        # AssessmentPlugin(BasePlugin)
│   │   │   ├── questions.py     # Fragen in 5 Sprachen
│   │   │   └── models.py        # LearningProfile
│   │   ├── session/
│   │   │   ├── __init__.py
│   │   │   ├── plugin.py        # SessionPlugin(BasePlugin)
│   │   │   ├── prompts.py       # System-Prompts pro Methode
│   │   │   ├── models.py        # LearningSession, SessionMessage, SessionRating
│   │   │   └── switching.py     # Methoden-Wechsel-Logik
│   │   ├── ai_anthropic/
│   │   │   ├── __init__.py
│   │   │   └── plugin.py        # AnthropicPlugin(BasePlugin)
│   │   ├── ai_openai/
│   │   │   ├── __init__.py
│   │   │   └── plugin.py        # OpenAIPlugin(BasePlugin)
│   │   ├── ai_gemini/
│   │   │   ├── __init__.py
│   │   │   └── plugin.py        # GeminiPlugin(BasePlugin)
│   │   ├── tracking/
│   │   │   ├── __init__.py
│   │   │   ├── plugin.py        # TrackingPlugin(BasePlugin)
│   │   │   └── models.py        # ProgressCommit, MethodSwitch
│   │   └── tools/
│   │       ├── __init__.py
│   │       └── plugin.py        # ToolsPlugin(BasePlugin)
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
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/client.ts        # REST-Client + TypeScript-Typen
│   │   ├── i18n/
│   │   │   ├── index.ts         # i18n-Setup
│   │   │   └── translations/    # Sprachdateien (DE, EN, ES, FR, EL)
│   │   ├── components/
│   │   │   ├── ProfileRadar.tsx       # RadarChart 6 Methoden
│   │   │   ├── ProgressTimeline.tsx   # LineChart Verstaendnis/Stress
│   │   │   ├── SessionChat.tsx        # Chat-Interface
│   │   │   ├── CycleProgress.tsx      # 7-Schritte Progress-Bar
│   │   │   ├── MethodBadge.tsx        # Methoden-Anzeige mit Farbe
│   │   │   ├── RatingDialog.tsx       # Session-Bewertung
│   │   │   └── MethodSwitchBanner.tsx # Wechsel-Empfehlung
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
│   │   └── styles/global.css
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   └── CONCEPT.md
├── Makefile
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

## Konventionen

- Python mit Typehints, kein `Any` wo konkreter Typ moeglich
- TypeScript ohne `any`
- Keine Em-Dashes (--), stattdessen Bindestriche (-) oder Kommata
- Commit Messages: Englisch, konventionell (feat/fix/refactor/docs/test)
- API-Prefix: /api/
- Plugin-Routen: /api/plugins/{plugin-name}/
- SQLAlchemy 2.0 Mapped Columns
- Pydantic v2 mit ConfigDict(from_attributes=True)
- Konfigurierbare Werte in YAML, nicht hartcodiert
- Logging: `logging.getLogger(__name__)`

## Plugin-Registrierung

Fuer v0.1.0 werden Plugins NICHT ueber Entry Points geladen (sie liegen im gleichen Repo). Stattdessen manuelle Registrierung in main.py:

```python
from pluginforge import PluginManager
from plugins.assessment.plugin import AssessmentPlugin
from plugins.session.plugin import SessionPlugin
# ...

pm = PluginManager("config/app.yaml")
pm.register_hookspecs(AdaptivLearnerHookSpec)

# Manuelle Registrierung (spaeter Entry Points)
pm.register_plugin(AssessmentPlugin())
pm.register_plugin(SessionPlugin())
# ...
```

Spaeter (v0.3.0) werden Plugins zu eigenen Paketen mit Entry Points.

## Sechs Methoden - Interne Keys

```python
METHODS = [
    "deductive",    # Regel lernen, dann anwenden
    "inductive",    # Anwenden, dann Regel ableiten
    "error_based",  # Bewusst Fehler provozieren
    "dialogic",     # Gespraeche mit Rueckmeldung
    "contextual",   # Simulierte Alltagssituationen
    "ai_adaptive",  # System waehlt
]
```

Diese Keys werden ueberall konsistent verwendet: DB, API, Frontend, Config.

## 7-Schritte-Zyklus

```python
CYCLE_STEPS = [
    "input",        # 1. Information/Aufgabe
    "attempt",      # 2. Versuch ohne Sicherheitsnetz
    "error",        # 3. Abweichung erkennen
    "feedback",     # 4. Erklaerung (nicht nur richtig/falsch)
    "adapt",        # 5. Methode/Fokus anpassen
    "repeat",       # 6. Erneuter Versuch
    "integrate",    # 7. Wissen integrieren
]
```

Der Session-Plugin steuert den Zyklus. Der System-Prompt aendert sich je nach Schritt.

## System-Prompt-Strategie

Jede Methode hat einen eigenen System-Prompt-Template. Der Prompt wird dynamisch zusammengebaut aus:

1. Basis-Instruktion (Methode + Sprache)
2. Thema und Ziel des Lernprojekts
3. Aktueller Zyklus-Schritt
4. Bisheriger Verlauf der Session (Kontext)
5. Bekannte Schwaechen aus dem Tracking

Beispiel-Template (Deduktiv, Schritt 1 "Input"):

```
Du bist ein Lerncoach der die deduktive Methode verwendet.
Sprache: {lang}
Thema: {topic}
Ziel: {goal}

SCHRITT: Input
Erklaere dem Nutzer eine Regel oder ein Prinzip zum Thema.
Sei praezise und strukturiert. Gib eine klare Definition,
dann ein Beispiel. Frage am Ende ob der Nutzer bereit ist
fuer den naechsten Schritt (Versuch).
```

Die Prompt-Templates liegen in `plugins/session/prompts.py`.

## Methoden-Wechsel-Logik

In `plugins/session/switching.py`:

```python
def should_switch_method(recent_ratings: list[dict],
                          current_method: str,
                          config: dict) -> dict | None:
    """
    Prueft ob ein Methodenwechsel empfohlen werden sollte.

    Kriterien:
    - Verstaendnis-Durchschnitt stagniert ueber N Sessions
    - Stress-Durchschnitt ueber Schwellwert
    - Methoden-Fit-Bewertung konsistent niedrig

    Returns: {"to_method": str, "reason": str} oder None
    """
```

Empfohlene Methode basiert auf dem Lernprofil: Naechstbeste Methode die noch nicht probiert wurde oder die laenger nicht genutzt wurde.

## API-Key-Handling

- Frontend sendet Key einmalig an POST /api/settings/api-key
- Backend verschluesselt mit Fernet (Key aus Env-Variable)
- Gespeichert in DB (UserSettings-Tabelle)
- Bei AI-Aufrufen: Key entschluesseln, an Provider SDK uebergeben
- Frontend bekommt NIE den Klartext-Key zurueck, nur Provider-Name + "gespeichert"

## Frontend i18n

Kein externes i18n-Framework noetig fuer v0.1.0. Simples Pattern:

```typescript
const translations = { de: {...}, en: {...}, es: {...}, fr: {...}, el: {...} };
const t = translations[currentLang];
// Nutzung: t.dashboard.title
```

Sprache wird in User-Settings gespeichert und beim Laden aus der API geholt.

## Methoden-Farben (Frontend)

Konsistente Farbzuordnung in der gesamten UI:

```typescript
const METHOD_COLORS = {
  deductive:  "#3B82F6",  // Blau
  inductive:  "#8B5CF6",  // Violett
  error_based: "#EF4444", // Rot
  dialogic:   "#10B981",  // Gruen
  contextual: "#F59E0B",  // Amber
  ai_adaptive: "#6366F1", // Indigo
};
```

## Tests

- Backend: pytest, >= 80% Coverage
- Plugins einzeln testbar (Mock fuer AI-Provider)
- AI-Provider-Tests mit Mocks (keine echten API-Calls in Tests)
- Assessment: Profil-Berechnung deterministisch testbar
- Switching-Logik: Unit-Tests mit verschiedenen Rating-Szenarien
- API: FastAPI TestClient

## Makefile Targets

```makefile
install:        cd backend && poetry install && cd ../frontend && npm install
dev:            # Backend (8000) + Frontend (5173) parallel starten
dev-backend:    cd backend && poetry run uvicorn app.main:app --reload
dev-frontend:   cd frontend && npm run dev
test:           cd backend && poetry run pytest
lint:           cd backend && poetry run ruff check . && cd ../frontend && npm run lint
build:          docker compose build
up:             docker compose up
```

## Naechste Schritte (Implementierungs-Reihenfolge)

1. `pyproject.toml` mit PluginForge-Dependency
2. `app/main.py` mit FastAPI + PluginForge-Setup
3. `app/database.py` + Core-Models (User, LearningProject)
4. `app/hookspecs.py` (alle Hook-Specs definieren)
5. `plugins/assessment/` (Fragen DE+EN, Profil-Berechnung)
6. `plugins/ai_anthropic/` (Claude-Provider)
7. `plugins/session/` (7-Schritte-Zyklus, Prompts, Chat)
8. `plugins/tracking/` (ProgressCommits, Dashboard-Daten)
9. `plugins/tools/` (Statische Empfehlungen)
10. Frontend: Landing, Onboarding, Assessment
11. Frontend: Dashboard mit Recharts
12. Frontend: Session-Chat-Interface
13. Frontend: Settings (API-Key, Sprache, Provider)
14. Docker Compose
15. Tests

## Kontext

AdaptivLearner basiert auf vier Artikeln:
1. "Adaptive Learning: Lerne, wie du wirklich lernst" - 6 Methoden, Lernzyklus
2. "Adaptives Lernen in der Praxis" - Prompt-Verlaeufe, konkrete Techniken
3. "Lernfortschritt versionieren: Git als Lernsystem" - Tracking-Konzept
4. "Effizient lernen: Die drei Bausteine" - Anki, NotebookLM, KI-Prompt

Alles zusammen ergibt das System das wir hier bauen.

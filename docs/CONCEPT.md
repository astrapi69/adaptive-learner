# Adaptive Learner - Konzeptdokument

**Repository:** https://github.com/astrapi69/adaptive-learner
**Basis:** [python-poetry-template](https://github.com/astrapi69/python-poetry-template)
**Plugin-Framework:** [PluginForge](https://pypi.org/project/pluginforge/) (auf PyPI)
**Artikelserie:** [Von Theorie zur Praxis](https://asterios-raptis.medium.com/) (Lern-Artikel)
**Version:** 0.1.0 (geplant)
**Stand:** 2026-03-27

---

## 1. Ziel

Adaptive Learner ist ein adaptives Lernsystem basierend auf der Artikelserie "Von Theorie zur Praxis". Es ist die zweite Anwendung die auf PluginForge aufbaut (nach Bibliogon).

Kernthese: Die beste Lernmethode ist keine feste Methode, sondern die Faehigkeit, zwischen Methoden zu wechseln. Das System lernt, wie der Nutzer lernt, und passt sich an.

---

## 2. Fachliches Modell (aus der Artikelserie)

### 2.1 Sechs Lernmethoden (Artikel 1)

| Methode | Key | Beschreibung | Staerke |
|---------|-----|-------------|---------|
| Deduktiv | `deductive` | Regel lernen, dann anwenden | Strukturierte Regelsysteme |
| Induktiv | `inductive` | Anwenden, dann Regel ableiten | Intuition wichtiger als Praezision |
| Fehlerzentriert | `error_based` | Bewusst Fehler provozieren, korrigieren | Themen mit Teilwissen |
| Dialogisch | `dialogic` | Gespraeche mit sofortiger Rueckmeldung | Hoher Stress, Motivationsaufbau |
| Kontextuell | `contextual` | Simulierte Alltagssituationen | Transfer in reale Anwendungen |
| KI-adaptiv | `ai_adaptive` | System waehlt basierend auf Daten | Nutzer weiss nicht was passt |

### 2.2 Der 7-Schritte-Lernzyklus (Artikel 1)

1. **Input** (`input`) - Information, Beispiel, Aufgabe
2. **Versuch** (`attempt`) - Anwendung ohne Sicherheitsnetz
3. **Fehler** (`error`) - Abweichung zwischen Erwartung und Ergebnis
4. **Feedback** (`feedback`) - Korrektur mit Erklaerung
5. **Anpassung** (`adapt`) - Methode/Tempo/Fokus aendern
6. **Wiederholung** (`repeat`) - Erneuter Versuch unter veraenderten Bedingungen
7. **Integration** (`integrate`) - Wissen bleibt durch Erfahrung

### 2.3 Git-Prinzip fuer Lernfortschritt (Artikel 3)

- "Commits" = abgeschlossene Sessions mit Metadaten
- "Diffs" = Performance-Veraenderung zwischen Sessions
- Fehlermuster-Erkennung ueber Zeit

### 2.4 Drei Werkzeug-Bausteine (Artikel 4)

1. **Spaced Repetition** (Anki) - Fakten und Vokabeln
2. **Active Recall** (NotebookLM) - Verstaendnis mit eigenem Material
3. **Adaptiver KI-Prompt** - Personalisierte Lernsteuerung

---

## 3. Architektur

### 3.1 Schichtenmodell

```
+----------------------------------------------------------+
|  Frontend (React 18, TypeScript, Vite)                   |
+----------------------------------------------------------+
|  Backend (FastAPI)                                        |
|  - User/Project CRUD                                     |
|  - Session-Orchestrierung                                |
|  - API-Key-Verwaltung                                    |
+----------------------------------------------------------+
|  PluginForge (von PyPI)                                   |
|  +-- pluggy, YAML-Config, Lifecycle, FastAPI-Integration |
+----------------------------------------------------------+
|  Plugins (im Repo unter backend/plugins/)                |
|  +-- plugin-assessment    (Lerntyp-Ermittlung)           |
|  +-- plugin-session       (7-Schritte-Zyklus, Chat)      |
|  +-- plugin-ai-anthropic  (Claude API)                   |
|  +-- plugin-ai-openai     (GPT API)                      |
|  +-- plugin-ai-gemini     (Gemini API)                   |
|  +-- plugin-tracking      (Fortschritt, Commits)         |
|  +-- plugin-tools         (Werkzeug-Empfehlungen)        |
+----------------------------------------------------------+
```

### 3.2 Tech-Stack

| Komponente | Technologie |
|------------|-------------|
| Plugin-Framework | pluginforge (von PyPI) |
| Backend | FastAPI, SQLAlchemy 2.0, SQLite |
| Frontend | React 18, TypeScript, Vite, Recharts |
| AI-Provider | anthropic SDK, openai SDK, google-generativeai SDK |
| Tooling | Poetry, npm, Docker, Make |
| Code-Qualitaet | ruff, black, mypy, pre-commit, pytest-cov |

---

## 4. Datenmodell

### 4.1 Core (Backend)

```
User
  id: UUID (PK)
  name: str
  email: str (optional, unique)
  language: str (default "de")
  created_at, updated_at: datetime

LearningProject
  id: UUID (PK)
  user_id: UUID (FK)
  topic: str
  goal: str
  timeframe: str
  daily_minutes: int
  current_problem: str
  active: bool
  created_at, updated_at: datetime

UserSettings
  id: UUID (PK)
  user_id: UUID (FK, unique)
  active_provider: str (default "anthropic")
  api_key_anthropic: str (verschluesselt, nullable)
  api_key_openai: str (verschluesselt, nullable)
  api_key_gemini: str (verschluesselt, nullable)
```

### 4.2 Plugin-Tabellen

```
LearningProfile (plugin-assessment)
  id, user_id, project_id
  deductive, inductive, error_based, dialogic, contextual, ai_adaptive: float (0.0-1.0)
  assessed_at, version

LearningSession (plugin-session)
  id, project_id, method, started_at, ended_at, cycle_step, status

SessionMessage (plugin-session)
  id, session_id, role, content, created_at

SessionRating (plugin-session)
  id, session_id, understanding (1-5), stress (1-5), method_fit (1-5), notes

ProgressCommit (plugin-tracking)
  id, project_id, session_id, method
  understanding, stress, error_rate: float
  duration_minutes, committed_at

MethodSwitch (plugin-tracking)
  id, project_id, from_method, to_method, reason, switched_at
```

---

## 5. Hook-Specs

```python
from pluginforge import hookspec

class AdaptiveLearnerHookSpec:

    @hookspec
    def get_assessment_questions(self, lang: str) -> list[dict]:
        """Fragen fuer den Lerntyp-Test."""

    @hookspec
    def calculate_profile(self, answers: list[dict]) -> dict:
        """Lernprofil aus Antworten berechnen."""

    @hookspec(firstresult=True)
    def create_session_prompt(self, project: dict, profile: dict,
                               method: str, step: int, lang: str) -> str:
        """System-Prompt fuer Lernsession."""

    @hookspec(firstresult=True)
    def ai_complete(self, messages: list[dict], model: str,
                     api_key: str) -> str:
        """Nachricht an KI-Provider senden."""

    @hookspec
    def recommend_method_switch(self, project_id: str,
                                 current_method: str,
                                 recent_ratings: list[dict]) -> dict | None:
        """Methodenwechsel empfehlen."""

    @hookspec
    def on_session_complete(self, session: dict, rating: dict) -> None:
        """Nach Session-Abschluss."""

    @hookspec
    def get_progress_summary(self, project_id: str) -> dict:
        """Fortschrittszusammenfassung."""

    @hookspec
    def get_tool_recommendations(self, profile: dict, lang: str) -> list[dict]:
        """Werkzeug-Empfehlungen."""
```

---

## 6. API-Endpunkte

### Core

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | /api/users | Nutzer anlegen |
| GET | /api/users/{id} | Nutzer laden |
| PATCH | /api/users/{id} | Nutzer aktualisieren |
| POST | /api/users/{id}/projects | Lernprojekt anlegen |
| GET | /api/users/{id}/projects | Projekte auflisten |
| GET/PATCH | /api/settings/{user_id} | Einstellungen |
| POST | /api/settings/{user_id}/api-key | API-Key speichern |

### Plugin-Routen

| Methode | Pfad | Plugin |
|---------|------|--------|
| GET | /api/plugins/assessment/questions | assessment |
| POST | /api/plugins/assessment/evaluate | assessment |
| GET | /api/plugins/assessment/profile/{project_id} | assessment |
| POST | /api/plugins/session/start | session |
| POST | /api/plugins/session/{id}/message | session |
| POST | /api/plugins/session/{id}/rate | session |
| POST | /api/plugins/session/{id}/end | session |
| GET | /api/plugins/tracking/progress/{project_id} | tracking |
| GET | /api/plugins/tracking/commits/{project_id} | tracking |
| GET | /api/plugins/tools/recommendations/{project_id} | tools |

---

## 7. Frontend-Seiten

| Route | Seite | Beschreibung |
|-------|-------|-------------|
| `/` | Landing | Sprachauswahl, Einstieg |
| `/onboarding` | Onboarding | Lernprojekt anlegen |
| `/assessment` | Assessment | 12-Fragen Lerntyp-Test |
| `/dashboard` | Dashboard | Profil, Fortschritt, Session starten |
| `/session` | Session | Chat-Interface, 7-Schritte-Zyklus |
| `/progress` | Progress | Charts, Commit-Historie |
| `/settings` | Settings | Sprache, API-Key, Provider |

---

## 8. Mehrsprachigkeit

5 Sprachen: DE, EN, ES, FR, EL

- UI-Strings: PluginForge i18n (config/i18n/{lang}.yaml)
- KI-Sessions: Sprache als Parameter im System-Prompt
- Assessment-Fragen: In allen 5 Sprachen

---

## 9. Sicherheit

- API-Keys: Fernet-verschluesselt in DB, Schluessel aus `ADAPTIVE_LEARNER_SECRET_KEY`
- Kein Klartext-Key ans Frontend
- CORS konfigurierbar via app.yaml

---

## 10. Roadmap

### Phase 1: MVP (v0.1.0)

- Backend: FastAPI + SQLAlchemy + PluginForge
- Core: User, Project CRUD, Settings
- plugin-assessment (DE + EN)
- plugin-session (7-Schritte-Zyklus)
- plugin-ai-anthropic (Claude)
- plugin-tracking (Basis)
- plugin-tools (statisch)
- Frontend: Alle Seiten, Recharts Dashboard
- Docker Compose, i18n DE + EN

### Phase 2: Multi-Provider + i18n (v0.2.0)

- plugin-ai-openai, plugin-ai-gemini
- i18n komplett: ES, FR, EL
- Verbesserte Stagnation-Detection

### Phase 3: Erweiterte Analyse (v0.3.0)

- Git-Prinzip UI, Fehlermuster-Erkennung
- Export Lernverlauf als PDF/Markdown
- Plugins in separate PyPI-Pakete

### Phase 4: SaaS (v0.4.0)

- PostgreSQL, JWT-Auth, Multi-User
- Premium-Plugins, Stripe

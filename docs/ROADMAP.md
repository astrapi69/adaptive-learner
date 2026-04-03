# Adaptive Learner - Anforderungen und Roadmap

Offene Punkte, geplante Features und technische Schulden.
Checkboxen: `[ ]` = offen, `[x]` = erledigt.
IDs: S=Setup, B=Backend, P=Plugin, F=Frontend, I=i18n, Q=Tests, D=DevOps, T=Technische Schulden.

Prompt-Referenz: `Setze B-01 um.` reicht als Anweisung.

---

## Naechste Schritte (priorisiert)

Diese Punkte haben Vorrang vor den kategorisierten Listen unten.

- [ ] S-01: Template-Reste aufraumen (scripts/, root tests/, root pyproject.toml anpassen)
- [ ] S-02: Backend-Verzeichnisstruktur anlegen (backend/ mit eigenem pyproject.toml)
- [ ] S-03: Frontend-Scaffolding (Vite + React + TypeScript)
- [ ] B-01: database.py + Core-Models (User, LearningProject, UserSettings)
- [ ] B-02: hookspecs.py (alle Hook-Specs definieren)
- [ ] B-03: main.py (FastAPI + PluginForge Setup)
- [ ] B-04: Core-Router (users, projects, settings)
- [ ] B-05: crypto.py (Fernet API-Key-Verschluesselung)

## Setup

- [ ] S-01: Template-Reste aufraumen (scripts/, root tests/ entfernen)
- [ ] S-02: Backend-Verzeichnis mit pyproject.toml (pluginforge, FastAPI, SQLAlchemy, etc.)
- [ ] S-03: Frontend-Scaffolding (Vite + React 18 + TypeScript + Recharts)
- [ ] S-04: Makefile erweitern (install, dev, test fuer Backend+Frontend)
- [ ] S-05: docker-compose.yml anlegen
- [ ] S-06: .env.example mit ADAPTIVE_LEARNER_SECRET_KEY
- [ ] S-07: .pre-commit-config.yaml anpassen fuer Backend+Frontend
- [ ] S-08: .github/workflows/ci.yml anpassen

## Backend

- [ ] B-01: database.py (SQLAlchemy + SQLite, Session-Factory)
- [ ] B-02: hookspecs.py (AdaptiveLearnerHookSpec, alle Hooks)
- [ ] B-03: main.py (FastAPI, PluginManager, register_plugin, mount_routes)
- [ ] B-04: Core-Router users.py (POST, GET, PATCH)
- [ ] B-05: Core-Router projects.py (POST, GET, PATCH)
- [ ] B-06: Core-Router settings.py (GET, PATCH, POST api-key)
- [ ] B-07: crypto.py (Fernet encrypt/decrypt, Key aus Env-Variable)
- [ ] B-08: Core-Models (User, LearningProject, UserSettings) mit SQLAlchemy 2.0
- [ ] B-09: Pydantic Schemas (Request/Response fuer alle Core-Endpunkte)
- [ ] B-10: config/app.yaml (App-Config, Plugin-Liste, DB-URL, CORS)
- [ ] B-11: Alembic-Migrationen (spaeter, nach MVP)
- [ ] B-12: Rate Limiting fuer AI-Provider-Aufrufe (konfigurierbar)

## Plugins

### Phase 1: Assessment (Lerntyp-Ermittlung)

- [ ] P-01: assessment/plugin.py (AssessmentPlugin, BasePlugin, hookimpl)
- [ ] P-02: assessment/questions.py (12 Fragen, DE + EN)
- [ ] P-03: assessment/models.py (LearningProfile SQLAlchemy Model)
- [ ] P-04: assessment/routes.py (GET questions, POST evaluate, GET profile)
- [ ] P-05: config/plugins/assessment.yaml

### Phase 1: AI-Provider (Claude zuerst)

- [ ] P-06: ai_anthropic/plugin.py (AnthropicPlugin, ai_complete Hook)
- [ ] P-07: config/plugins/ai-anthropic.yaml (default_model, max_tokens)

### Phase 1: Session (7-Schritte-Zyklus)

- [ ] P-08: session/plugin.py (SessionPlugin, create_session_prompt, process_message Hooks)
- [ ] P-09: session/prompts.py (System-Prompt-Templates pro Methode + Schritt)
- [ ] P-10: session/models.py (LearningSession, SessionMessage, SessionRating)
- [ ] P-11: session/switching.py (Methoden-Wechsel-Logik, Stagnation-Detection)
- [ ] P-12: session/routes.py (POST start, POST message, POST rate, POST end)
- [ ] P-13: config/plugins/session.yaml (default_method, stagnation_threshold, etc.)

### Phase 1: Tracking (Fortschritt)

- [ ] P-14: tracking/plugin.py (TrackingPlugin, on_session_complete, get_progress_summary)
- [ ] P-15: tracking/models.py (ProgressCommit, MethodSwitch)
- [ ] P-16: tracking/routes.py (GET progress, GET commits)

### Phase 1: Tools (Empfehlungen)

- [ ] P-17: tools/plugin.py (ToolsPlugin, get_tool_recommendations)
- [ ] P-18: tools/routes.py (GET recommendations)

### Phase 2: Weitere AI-Provider

- [ ] P-19: ai_openai/plugin.py (OpenAIPlugin, ai_complete Hook)
- [ ] P-20: ai_gemini/plugin.py (GeminiPlugin, ai_complete Hook)
- [ ] P-21: config/plugins/ai-openai.yaml, ai-gemini.yaml
- [ ] P-22: Provider-Auswahl im Frontend (Settings)

### Phase 3: Erweiterte Analyse

- [ ] P-23: Fehlermuster-Erkennung (Tracking-Plugin erweitern)
- [ ] P-24: Session-Vergleich ueber Zeit
- [ ] P-25: Export Lernverlauf als PDF/Markdown

### Phase 4: SaaS

- [ ] P-26: JWT-Authentifizierung
- [ ] P-27: PostgreSQL statt SQLite
- [ ] P-28: Multi-User
- [ ] P-29: Premium-Plugins (erweiterte Analyse, Team-Features)
- [ ] P-30: Stripe-Integration

## Frontend

### Phase 1: Core-Seiten

- [ ] F-01: Landing.tsx (Sprachauswahl, Einstieg)
- [ ] F-02: Onboarding.tsx (Lernprojekt anlegen: Thema, Ziel, Timeframe, Minuten, Problem)
- [ ] F-03: Assessment.tsx (12 Fragen, Progress-Bar, Profil-Ergebnis)
- [ ] F-04: Dashboard.tsx (Profil-Radar, Fortschritts-Charts, Session starten)
- [ ] F-05: Session.tsx (Chat-Interface, Zyklus-Progress, Methoden-Badge)
- [ ] F-06: Settings.tsx (Sprache, API-Key, Provider-Auswahl)
- [ ] F-07: Progress.tsx (Detaillierte Charts, Commit-Historie)

### Phase 1: Komponenten

- [ ] F-08: ProfileRadar.tsx (Recharts RadarChart, 6 Methoden)
- [ ] F-09: ProgressTimeline.tsx (Recharts LineChart, Verstaendnis/Stress)
- [ ] F-10: SessionChat.tsx (Chat-Nachrichten, Input, Send)
- [ ] F-11: CycleProgress.tsx (7-Schritte Progress-Bar)
- [ ] F-12: MethodBadge.tsx (Methoden-Name + Farbe)
- [ ] F-13: RatingDialog.tsx (Verstaendnis, Stress, Method-Fit, je 1-5)
- [ ] F-14: MethodSwitchBanner.tsx (Wechsel-Empfehlung mit Accept/Dismiss)

### Phase 1: Infrastruktur

- [ ] F-15: api/client.ts (Typed REST Client fuer alle Endpunkte)
- [ ] F-16: i18n Setup (Translations DE + EN)
- [ ] F-17: Routing (React Router, alle Seiten)
- [ ] F-18: Methoden-Farben als Konstanten
- [ ] F-19: global.css (Basis-Styles, CSS Variables fuer Theming)

### Phase 2: i18n komplett

- [ ] F-20: Translations ES, FR, EL
- [ ] F-21: Assessment-Fragen in allen 5 Sprachen

## i18n

- [ ] I-01: Backend i18n/de.yaml + en.yaml (Core + Plugin-Strings)
- [ ] I-02: Frontend Translations DE + EN
- [ ] I-03: Assessment-Fragen DE + EN
- [ ] I-04: Backend i18n/es.yaml, fr.yaml, el.yaml
- [ ] I-05: Frontend Translations ES, FR, EL
- [ ] I-06: Assessment-Fragen ES, FR, EL

## Tests

- [ ] Q-01: conftest.py mit Fixtures (TestClient, in-memory DB, Mock-Plugins)
- [ ] Q-02: test_api.py (Core-Endpunkte: Users, Projects, Settings)
- [ ] Q-03: test_assessment.py (Profil-Berechnung, Fragen-Laden)
- [ ] Q-04: test_session.py (Prompt-Generierung, Zyklus-Steuerung)
- [ ] Q-05: test_tracking.py (ProgressCommits, Stagnation-Detection)
- [ ] Q-06: test_switching.py (Methoden-Wechsel-Logik, Edge Cases)
- [ ] Q-07: test_crypto.py (Fernet encrypt/decrypt)
- [ ] Q-08: AI-Provider Mocks (kein echter API-Call)
- [ ] Q-09: Frontend Vitest Setup
- [ ] Q-10: E2E Playwright Setup
- [ ] Q-11: CI-Pipeline (GitHub Actions)
- [ ] Q-12: Mutation Testing mit mutmut (spaeter)

## DevOps

- [ ] D-01: docker-compose.yml (Backend + Frontend)
- [ ] D-02: docker-compose.prod.yml (Production mit Nginx)
- [ ] D-03: Dockerfile Backend (Multi-Stage, non-root)
- [ ] D-04: Dockerfile Frontend (Build + Nginx)
- [ ] D-05: GitHub Actions CI

## Technische Schulden

(Noch keine - Projekt startet frisch.)

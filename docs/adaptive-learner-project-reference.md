# Adaptive Learner - Projekt-Referenz

**Datum:** 2026-05-17
**Repository:** https://github.com/astrapi69/adaptive-learner
**Aktueller Tag:** v0.0.0-template (Skeleton aus Bibliogon v0.33.0)
**Status:** Template steht, Domain-Umbau als naechster Schritt

---

## 1. Was ist Adaptive Learner?

Adaptives Lernsystem basierend auf der Artikelserie "Von Theorie zur Praxis" von Asterios Raptis (Medium). Erkennt den Lerntyp des Nutzers, fuehrt KI-gestuetzte Lernsessions durch und wechselt automatisch zwischen 6 Methoden.

Kernthese: Die beste Lernmethode ist keine feste Methode, sondern die Faehigkeit, zwischen Methoden zu wechseln.

Langfristiges Ziel: Kommerzielles SaaS-Produkt. Core Open Source (MIT), Premium-Plugins kostenpflichtig.

---

## 2. Herkunft und aktueller Stand

Das Repo wurde aus der Bibliogon-Codebase (v0.33.0) extrahiert. In einer 32-Commit-Session wurde:

- 11 Bibliogon-Plugins entfernt + gekoppelter Backend-Code gestripped
- Mass-Rename bibliogon -> adaptive_learner ueber 373 Dateien
- Domain-Models als EXAMPLE-DOMAIN markiert (Article, Book, Chapter, Comment, Author)
- 256 Test-Dateien mit TEMPLATE-Headern versehen
- CI Workflows, Makefile, Install-Scripts, i18n angepasst
- Launcher (PyInstaller, cross-OS) erhalten und umbenannt

Ergebnis: 1278 Backend-Tests gruen, 1104 Frontend-Tests gruen, null Bibliogon-Reste im Code.

---

## 3. Fachliches Modell (aus der Artikelserie)

### 3.1 Sechs Lernmethoden

| Key | Methode | Farbe | Staerke |
|-----|---------|-------|---------|
| `deductive` | Deduktiv | #3B82F6 (Blau) | Strukturierte Regelsysteme |
| `inductive` | Induktiv | #8B5CF6 (Violett) | Intuition wichtiger als Praezision |
| `error_based` | Fehlerzentriert | #EF4444 (Rot) | Themen mit Teilwissen |
| `dialogic` | Dialogisch | #10B981 (Gruen) | Hoher Stress, Motivationsaufbau |
| `contextual` | Kontextuell | #F59E0B (Amber) | Transfer in reale Anwendungen |
| `ai_adaptive` | KI-adaptiv | #6366F1 (Indigo) | Nutzer weiss nicht was passt |

### 3.2 Der 7-Schritte-Lernzyklus

1. **Input** (`input`) - Information, Beispiel, Aufgabe
2. **Versuch** (`attempt`) - Anwendung ohne Sicherheitsnetz
3. **Fehler** (`error`) - Abweichung zwischen Erwartung und Ergebnis
4. **Feedback** (`feedback`) - Korrektur mit Erklaerung
5. **Anpassung** (`adapt`) - Methode/Tempo/Fokus aendern
6. **Wiederholung** (`repeat`) - Erneuter Versuch
7. **Integration** (`integrate`) - Wissen bleibt durch Erfahrung

### 3.3 Git-Prinzip fuer Lernfortschritt

- "Commits" = abgeschlossene Sessions mit Metadaten
- "Diffs" = Performance-Veraenderung zwischen Sessions
- Fehlermuster-Erkennung ueber Zeit

### 3.4 Drei Werkzeug-Bausteine

1. Spaced Repetition (Anki)
2. Active Recall (NotebookLM)
3. Adaptiver KI-Prompt

---

## 4. Architektur

### 4.1 Schichtenmodell

```
+----------------------------------------------------------+
|  Frontend (React 19, TypeScript 6, Vite 8)               |
+----------------------------------------------------------+
|  Backend (FastAPI 0.136+)                                 |
+----------------------------------------------------------+
|  PluginForge (PyPI, basiert auf pluggy)                   |
+----------------------------------------------------------+
|  Plugins (backend/plugins/, manuelle Registrierung)       |
+----------------------------------------------------------+
|  Launcher (PyInstaller, Windows/Linux/macOS)              |
+----------------------------------------------------------+
```

### 4.2 Tech Stack (aktuelle Versionen)

**Backend:**

| Paket | Version |
|-------|---------|
| Python | ^3.12 |
| pluginforge | >=0.1.0 (PyPI) |
| FastAPI | ^0.136 (mit standard extras) |
| SQLAlchemy | ^2.0.49 |
| Pydantic | ^2.11 |
| PyYAML | ^6.0 |
| cryptography | ^45.0 |
| anthropic | ^0.55 |
| ruff | ^0.11 |
| mypy | ^1.15 |
| pytest | ^8.3 |
| pytest-cov | ^6.0 |
| httpx | ^0.28 |

**Frontend:**

| Paket | Version |
|-------|---------|
| React | ^19.2.0 |
| React DOM | ^19.2.0 |
| React Router DOM | ^7.14.1 |
| TypeScript | ^6.0.3 |
| Vite | ^8.0.12 |
| Recharts | ^3.8.1 |
| Lucide React | ^1.8.0 |
| Vitest | ^4.1.6 |
| happy-dom | ^20.9.0 |
| @testing-library/react | ^16.3.2 |
| Node.js | >=24.0.0 |

### 4.3 Verwandte Repositories

```
astrapi69/pluginforge                  # Framework (PyPI)
astrapi69/adaptive-learner             # Dieses Projekt (v0.0.0-template)
astrapi69/bibliogon                    # Upstream (Buch-Autoren-Plattform)
```

---

## 5. Domain-Migration (naechster Schritt)

### 5.1 Model-Mapping

| Bibliogon (EXAMPLE-DOMAIN) | Adaptive Learner | Beschreibung |
|----------------------------|------------------|-------------|
| Article | LearningTopic | Ein Lernthema |
| Book | Curriculum | Ein Lernprojekt/Kurs |
| Chapter | Lesson | Eine Lerneinheit |
| Comment | SessionNote | Notizen zu einer Session |
| Author | - | Entfaellt |
| - | User | Lernender |
| - | LearningProject | Lernziel mit Thema, Zeitrahmen |
| - | LearningProfile | 6-Methoden-Gewichtung (0.0-1.0) |
| - | LearningSession | Aktive Lernsession |
| - | SessionMessage | Chat-Nachricht in Session |
| - | SessionRating | Bewertung (Verstaendnis, Stress, Fit) |
| - | ProgressCommit | Fortschritts-Snapshot |
| - | MethodSwitch | Methodenwechsel-Dokumentation |
| - | UserSettings | Provider-Auswahl, API-Keys |

### 5.2 Tree-Adapter Integration

Waehrend der Domain-Migration wird ein TypeScript Tree-Adapter eingebaut fuer hierarchische Lernstrukturen:

- Basis: `tree-model` npm-Paket (~500 LOC, MIT, stabil)
- Adapter: `TypedTreeNode<V, K>` (~300-400 LOC)
- Features: Typed IDs, displayValue, leaf-Detection, Flat-zu-Tree-Konvertierung, Visitor-Pattern (callback-basiert)
- Location: `frontend/src/lib/tree/`
- Quelle: Java-Libs tree-api + gen-tree von astrapi69 (Hybrid-Port, nur was die App braucht)

Anwendungen im Adaptive Learner:
- Thema > Unterthema > Konzept > Lerneinheit (Curriculum-Baum)
- Skill-Tree Visualisierung (Grundlagen > Fortgeschritten > Experte)
- Assessment-Ergebnisse als Baum

### 5.3 T-01: Book Model Strip

Aufgeschobene Aufgabe aus dem Cleanup. Erledigt sich durch die Domain-Migration automatisch: Wenn Article/Book/Chapter durch Lern-Domain-Models ersetzt werden, fallen die 35 Feature-Columns weg. Cascade betrifft: Schemas, Router, Frontend-Interfaces, Migrations, ~50+ Tests.

---

## 6. Plugin-Architektur

### 6.1 Geplante Plugins

| Plugin | Beschreibung | Phase |
|--------|-------------|-------|
| assessment | Lerntyp-Ermittlung, 12 Fragen, Profil-Berechnung | 1 (MVP) |
| session | 7-Schritte-Zyklus, Chat, Methoden-Prompts, Wechsel-Logik | 1 |
| ai-anthropic | Claude API Provider | 1 |
| ai-openai | GPT API Provider | 2 |
| ai-gemini | Gemini API Provider | 2 |
| tracking | ProgressCommits, Stagnation-Detection, Dashboard-Daten | 1 |
| tools | Werkzeug-Empfehlungen (Anki, NotebookLM, KI-Prompt) | 1 |

### 6.2 Plugin-Dualitaet

Jedes Plugin hat zwei Rollen:
1. Erbt von `BasePlugin` (PluginForge) - Lifecycle: init, activate, deactivate
2. Nutzt `@hookimpl`-Dekoratoren (pluggy) - Hook-Aufrufe

Registrierung in v0.1.0 via `pm.register_plugin()` (manuell). Entry Points ab v0.3.0.

### 6.3 Hook-Specs

```python
class AdaptiveLearnerHookSpec:
    @hookspec
    def get_assessment_questions(self, lang: str) -> list[dict]

    @hookspec
    def calculate_profile(self, answers: list[dict]) -> dict

    @hookspec(firstresult=True)
    def create_session_prompt(self, project, profile, method, step, lang) -> str

    @hookspec(firstresult=True)
    def ai_complete(self, messages, model, api_key) -> str

    @hookspec
    def recommend_method_switch(self, project_id, current_method, recent_ratings) -> dict | None

    @hookspec
    def on_session_complete(self, session, rating) -> None

    @hookspec
    def get_progress_summary(self, project_id) -> dict

    @hookspec
    def get_tool_recommendations(self, profile, lang) -> list[dict]
```

---

## 7. API-Endpunkte (Ziel-State)

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
| GET | /api/plugins/session/switch-recommendation/{id} | session |
| POST | /api/plugins/session/{id}/switch | session |
| GET | /api/plugins/tracking/progress/{project_id} | tracking |
| GET | /api/plugins/tracking/commits/{project_id} | tracking |
| GET | /api/plugins/tools/recommendations/{project_id} | tools |
| GET | /api/plugins/tools/spaced/{project_id} | tools (v0.4.0) |

---

## 8. Frontend-Seiten (Ziel-State)

| Route | Seite | Beschreibung |
|-------|-------|-------------|
| `/` | Landing | Sprachauswahl, Einstieg |
| `/onboarding` | Onboarding | Lernprojekt anlegen |
| `/assessment` | Assessment | 12-Fragen Lerntyp-Test |
| `/dashboard` | Dashboard | Profil-Radar, Fortschritt, Session starten |
| `/session` | Session | Chat-Interface, 7-Schritte-Zyklus |
| `/progress` | Progress | Charts, Commit-Historie |
| `/settings` | Settings | Sprache, API-Key, Provider |

---

## 9. Mehrsprachigkeit

5 Sprachen: DE, EN, ES, FR, EL

- UI-Strings: PluginForge i18n (config/i18n/{lang}.yaml)
- KI-Sessions: Sprache als Parameter im System-Prompt
- Assessment-Fragen: In allen 5 Sprachen
- Aktuell im Template: 8 Sprachen (DE, EN, ES, FR, EL, PT, TR, JA) von Bibliogon geerbt

---

## 10. Sicherheit

- API-Keys: Fernet-verschluesselt in DB
- Schluessel aus Umgebungsvariable `ADAPTIVE_LEARNER_SECRET_KEY`
- Kein Klartext-Key ans Frontend
- CORS konfigurierbar via app.yaml
- Test-Isolation: `.adaptive-learner-production` Marker-Tripwire

---

## 11. System-Prompt-Strategie

Jede Methode hat ein Prompt-Template. Dynamisch zusammengebaut aus:

1. Methoden-Instruktion
2. Thema + Ziel des Lernprojekts
3. Aktueller Zyklus-Schritt (1-7)
4. Bisheriger Session-Verlauf
5. Sprache des Nutzers

| Methode | Prompt-Kern |
|---------|------------|
| deductive | "Erklaere Regel zuerst, dann Uebungen" |
| inductive | "Gib Beispiele, Nutzer leitet Regel ab" |
| error_based | "Provoziere typische Fehler, erklaere warum" |
| dialogic | "Fuehre Gespraech, korrigiere sofort, Stress niedrig" |
| contextual | "Simuliere Alltagssituation zum Thema" |
| ai_adaptive | "Waehle passende Methode, begruende" |

---

## 12. Methoden-Wechsel-Logik

- Verstaendnis stagniert ueber 3 Sessions UND Stress > 3.0 -> Wechsel empfehlen
- Empfohlene Methode: Naechstbeste aus Profil, die laenger nicht genutzt wurde
- Nutzer entscheidet (Empfehlung, kein Zwang)
- Wechsel-Grund dokumentiert in MethodSwitch.reason

---

## 12a. Mobile / PWA-Architektur (Phase 9 / v0.6.0)

Lernen ist von Natur aus mobil. v0.6.0 macht den Primaer-Use-Case
dort zugaenglich, wo Lernende tatsaechlich lernen: auf dem
Smartphone. **Polish, kein Mobile-First-Rewrite** — die
Desktop-Styles bleiben unveraendert; mobile Breakpoint-Regeln
werden hinzugefuegt.

### Architektur-Entscheidungen (Q1-Q6 aus Phase 9)

| # | Frage | Entscheidung | Warum |
|---|---|---|---|
| Q1 | CSS-Strategie | Polish, nicht Rewrite | Bestehende Desktop-Styles funktionieren; Risiko-arme Erweiterung statt full-CSS-Refactor. Mobile-first-Rewrite bleibt eine separate Aufgabe. |
| Q2 | Navigation auf Mobile | Hamburger-Drawer ueber Top-Bar | Spec sprach von "Sidebar auf Desktop, Hamburger auf Mobile". Bestehende Top-Bar funktioniert; "Sidebar" war lose Wortwahl. Hamburger + Drawer am Top-Bar-Standort. |
| Q3 | Touch-Targets (44x44) | Nur unter 768px | Apple/Google-Guideline gilt fuer Touch. Desktop-Buttons werden nicht aufgeblaeht. |
| Q4 | RatingDialog (Slider vs Buttons) | Universal: 1-5 Buttons | Slider fuer eine 5-stufige Skala ist auf jedem Geraet unpraezise UX. Einheitlicher Code-Pfad gewinnt. |
| Q5 | Swipe-Gesten (Assessment) | Verschoben auf v0.7.x | Buttons funktionieren fuer prev/next. Gesten-Pass mit a11y-Implikationen (Tastatur, reduced-motion, Screen-Reader) lohnt eigene Phase. |
| Q6 | Lighthouse + Geraete-Tests | Manuell beim Smoke-Tester | Lighthouse aus dieser Umgebung nicht ausfuehrbar. Playwright-Viewport-Pins decken den automatisierbaren Teil. |

### Komponenten + Hooks

- **`InstallPrompt`** (`frontend/src/components/InstallPrompt.tsx`) —
  faengt `beforeinstallprompt`-Event, rendert eigenen
  dismissable Banner, persistiert Dismissal in
  `localStorage[adaptive-learner.install_dismissed]`.
- **`useOnlineStatus`** (`frontend/src/hooks/useOnlineStatus.ts`) —
  reaktiver Online/Offline-Hook ueber `navigator.onLine` +
  `online`/`offline`-Events.
- **`Navigation.nav-online-indicator`** — `role="status"` mit
  Dot + Label, Label versteckt unter 768px.

### Service-Worker-Strategie

Wiring in `frontend/vite.config.ts` unter `VitePWA(...)`:

- **Statische Assets** (JS, CSS, Fonts, Icons, HTML): Precache
  ueber `globPatterns`.
- **GET `/api/`**: NetworkFirst mit 4s-Timeout, 24h-LRU,
  60-Eintrag-Cap. Rueckkehrende Nutzer sehen Dashboard /
  Progress / Commits offline.
- **Mutating `/api/`** (POST/PATCH/DELETE): NetworkOnly. Niemals
  Write-Responses cachen.
- **`navigateFallback: "/index.html"`** fuer SPA-Routing.
- **`navigateFallbackDenylist: [/^\/api\//]`** verhindert, dass
  die SPA-Shell echte Backend-Fehler maskiert.
- **`offline.html`** als precache-eintrag — statisches
  Sicherheitsnetz, falls selbst die SPA-Shell nicht erreichbar
  ist.

### Manifest

- `name: "Adaptive Learner"` / `short_name: "Adaptive"` (≤12
  Zeichen pro Android-Empfehlung).
- Icons 192/512 als SVG (`purpose: "any"`) + PNG
  (`purpose: "any maskable"` fuer Android-Cropping).
- `theme_color: "#6366f1"` (entspricht `--accent` CSS-Variable).
- `categories: ["education", "productivity"]` + `lang: "en"`
  fuer Store-Listings.

### Offline-Verhalten

- Vergangene Sessions, Dashboard, Lernprofil bleiben lesbar.
- Neue Session-Erstellung ist offline blockiert
  (`/session`-Mount erkennt Offline-State, zeigt
  Inline-Nachricht statt POST zu feuern).
- Online/Offline-Indikator in Navigation mit
  `aria-live="polite"`.

### Test-Abdeckung

- `e2e/smoke/mobile-viewports.spec.ts` parametrisiert ueber 4
  Viewports (iPhone SE 375, iPhone 14 390, Pixel 7 412,
  iPad 768) mit je 4 Checks: kein horizontaler Overflow,
  Hamburger sichtbar, Dashboard kein Overflow, Online-Indikator
  sichtbar. 16 neue E2E-Cases.
- Vitest-Tests fuer `InstallPrompt`, `useOnlineStatus`,
  `Navigation`-Hamburger + Indikator, `RatingDialog`-Buttons,
  `Session`-Offline-Guard.

---

## 13. Roadmap

### Phase 1: Domain-Migration + MVP

- Domain-Models ersetzen (Article/Book/Chapter -> LearningTopic/Curriculum/Lesson)
- Tree-Adapter integrieren (frontend/src/lib/tree/)
- T-01 erledigt sich automatisch (Book-Model-Strip)
- Plugin: assessment (12 Fragen, DE + EN)
- Plugin: ai-anthropic (Claude)
- Plugin: session (7-Schritte-Zyklus)
- Plugin: tracking (Basis)
- Plugin: tools (statisch)
- Frontend: Onboarding, Assessment, Dashboard, Session, Settings
- i18n: DE + EN

### Phase 2: Multi-Provider + vollstaendige i18n

- Plugin: ai-openai, ai-gemini
- Provider-Auswahl im Frontend
- i18n komplett: ES, FR, EL
- Assessment-Fragen in allen 5 Sprachen
- Verbesserte Stagnation-Detection

### Phase 3: Erweiterte Analyse + Template

- Git-Prinzip UI, Fehlermuster-Erkennung
- Export Lernverlauf als PDF/Markdown
- Plugins in separate PyPI-Pakete
- pluginforge-app-template Repo erstellen und publishen

### Phase 4: SaaS

- PostgreSQL, JWT-Auth, Multi-User
- Premium-Plugins, Stripe

---

## 14. Template-Projekt

Nach dem Cleanup wurde v0.0.0-template getaggt. Dieses Template dient als Basis fuer zukuenftige PluginForge-basierte Apps:

```bash
# Neues Projekt aus Template
git clone --branch v0.0.0-template https://github.com/astrapi69/adaptive-learner.git my-new-app
cd my-new-app
# Remote aendern, Domain-Models ersetzen, Plugins schreiben
```

Geplantes separates Repo: `astrapi69/pluginforge-app-template`

Beschreibung: "Full-stack application template built on PluginForge. FastAPI + React + TypeScript + SQLite + PyInstaller launcher. Plugin-driven architecture with CI, tests, i18n, and cross-OS distribution out of the box."

---

## 15. Artikelserie (Quellen)

1. "Adaptive Learning: Lerne, wie du wirklich lernst" - 6 Methoden, Lernzyklus
2. "Adaptives Lernen in der Praxis" - Prompt-Verlaeufe, konkrete Techniken
3. "Lernfortschritt versionieren: Git als Lernsystem" - Tracking-Konzept
4. "Effizient lernen: Die drei Bausteine" - Anki, NotebookLM, KI-Prompt

---

## 16. Entscheidungslog (aus dieser Session)

| Entscheidung | Ergebnis |
|-------------|---------|
| Strategie A (Bibliogon-Fork) vs B (Clean-Slate) | A: Bibliogon-Fork bereinigen |
| PluginForge Scope v0.1.0 | Alles rein (Config, Discovery, Lifecycle, FastAPI, Alembic, i18n) |
| AI-Provider | Alle gaengigen: Anthropic, OpenAI, Gemini |
| Sprachen | 5: DE, EN, ES, FR, EL |
| Naming | Direct: adaptive_learner / AdaptiveLearner / ADAPTIVE_LEARNER |
| UI-Name | "Adaptive Learner" (mit Space) |
| Bibliogon-Docs | Historische loeschen, infrastrukturelle adaptieren |
| Book Model Strip (C1) | Deferred (T-01), erledigt sich bei Domain-Migration |
| Plugin-gekoppelte Routes | Option A: Sauber rausschneiden, keine Stubs |
| Template-Tag | v0.0.0-template |
| Tree-Adapter | Integration geplant bei Domain-Migration |

---

## 17. CC-Prompt fuer naechste Session (Domain-Migration)

```
Read CLAUDE.md and .claude/rules/. This is the adaptive-learner project,
a Bibliogon-derived skeleton tagged v0.0.0-template.

The next phase is Domain Migration. The current EXAMPLE-DOMAIN models
(Article, Book, Chapter, Comment, Author) need to be replaced with
adaptive learning domain models.

Pre-flight: verify tests pass (make test + npm run build).

Phase 1: Backend Domain Models
- Replace Article -> LearningTopic
- Replace Book -> Curriculum (strip to bare CRUD: title, description,
  language, created_at, updated_at. This resolves T-01.)
- Replace Chapter -> Lesson
- Replace Comment -> SessionNote
- Remove Author model
- Add new models: User, LearningProject, LearningProfile,
  LearningSession, SessionMessage, SessionRating, ProgressCommit,
  MethodSwitch, UserSettings
- Update schemas, routers, services accordingly
- Create new Alembic migration (drop old tables, create new)
- Delete old migrations for removed features

Phase 2: Hook-Specs + Plugin Infrastructure
- Create backend/app/hookspecs.py with AdaptiveLearnerHookSpec
- Register hook-specs in main.py

Phase 3: First Plugins
- assessment plugin (12 questions DE+EN, profile calculation)
- ai-anthropic plugin (Claude provider, firstresult=True)
- session plugin (7-step cycle, prompt templates per method+step)
- tracking plugin (ProgressCommits, stagnation detection)
- tools plugin (static recommendations)

Phase 4: Frontend Domain Migration
- Replace Article/Book/Chapter pages with LearningTopic/Curriculum pages
- Build: Landing, Onboarding, Assessment, Dashboard, Session, Settings
- Integrate tree-model adapter in frontend/src/lib/tree/ for topic
  hierarchies (TypedTreeNode<V, K>, ~300-400 LOC, based on tree-model npm)
- Recharts: ProfileRadar (6 methods), ProgressTimeline, MethodDistribution

Phase 5: Verification
- All tests green
- Backend starts, frontend starts
- Full user flow works: Onboarding -> Assessment -> Dashboard -> Session

Atomic green commits. Conventional commit messages. If unsure, stop and ask.
```

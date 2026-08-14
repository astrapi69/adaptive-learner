# Architektur

Adaptive Learner ist eine 4-Schichten-Anwendung mit Plugin-Architektur.

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend           React 19 + TypeScript 6 + Vite 8 +       │
│                    Vitest 4 + Dexie 4 (IndexedDB) + TipTap  │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ /api/*
┌─────────────────────────────────────────────────────────────┐
│ Backend            FastAPI ^0.136 + SQLAlchemy ^2.0 +       │
│                    Pydantic v2 + Alembic + Fernet           │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ hookspecs
┌─────────────────────────────────────────────────────────────┐
│ PluginForge        ^0.10.0 (externes PyPI; identitätsgated  │
│                    über target_application)                 │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ entry_points
┌─────────────────────────────────────────────────────────────┐
│ Plugins            ein Poetry-Paket je Plugin unter plugins/│
│                    Katalog und Stufen stehen in CLAUDE.md   │
└─────────────────────────────────────────────────────────────┘
```

Neue Features gehören IMMER in ein Plugin, es sei denn, sie
berühren den Kern (Users / Projects / Settings / Curriculum /
Topics / Lessons / Backup / Sync / System / Import).

## Dual-Storage (v0.7.0)

Das Frontend hat einen einzigen Punkt, an dem der Backing-Store
gewählt wird: `getStorage(): IStorageService`. Zwei
Implementierungen erfüllen einen Vertrag:

- **`apiStorage`** (Standard): dünner Wrapper um
  `api/client.ts`, der mit dem FastAPI-Backend spricht.
- **`dexieStorage`** (local-first): vollständiger
  IndexedDB-Stack, der alle 30 SQLAlchemy-Modelle spiegelt.
  KI-Aufrufe gehen direkt aus dem Browser über den
  `storage/ai/`-Namespace.

`IStorageService` (`storage/types/core/service.ts`) stellt 29
Namespaces bereit (users, projects, settings, assessment,
session mit Streaming, tracking, tools, curricula, topics,
lessons, plugins, imports, system, backup, export, subjects,
tags, projectTaxonomy, gamification, anki, pronunciation,
notebooklm, contentLoader, lessonProgress, elementErrors,
pluginSettings, learningRepo, missions, github). Beide Backings
implementieren jede Methode. `DexieStorage` ist in
domänenspezifische Namespace-Module unter `storage/dexie/`,
`storage/gamification/`, `storage/lessons/`, `storage/content/`
usw. aufgeteilt - kein God-File.

Die Factory liest
`localStorage["adaptive-learner.storage_mode"]`, dann
`VITE_STORAGE_MODE` (vom GH-Pages-Build gesetzt), und fällt
sonst auf `api` zurück. Der Moduswechsel ist kein Live-Swap:
die Einstellungsseite speichert die Wahl und zeigt per Toast
einen Hinweis, dass ein Reload nötig ist.

## Drei-Schichten-Geheimnisse (v1.20.0 / Phase 34)

```
Umgebungsvariablen  > secrets.yaml         > Fernet-DB-Spalte
ADAPTIVE_LEARNER_*    ~/.config/...yaml      api_key_<provider>
```

Jeder KI-Aufruf läuft die Kette über
`services/settings.resolve_api_key` ab:

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`-Umgebungsvariable.
2. `ai.<provider>.api_key` in
   `~/.config/adaptive_learner/secrets.yaml`.
3. Fernet-entschlüsselte DB-Spalte.
4. `None` - der KI-Aufruf zeigt einen Fehler in der UI.

Die Quellenangabe liegt auf `UserSettingsOut.key_source_*`
(Enum: `env` / `secrets_yaml` / `settings` / `none`). Die
Einstellungs-UI deaktiviert Speichern / Entfernen, wenn die
Quelle `env` oder `secrets_yaml` ist.

Dieselbe Kette gilt für `default_model`-Overrides pro Provider;
`secrets.yaml` schlägt den UI-Override gemäß dem Phase-34-Design
(Datei-Konfiguration gewinnt für Power-User über die UI).

## Plugin-Struktur

```
plugins/adaptive-learner-plugin-<name>/
  adaptive_learner_<name>/
    plugin.py     # <Name>Plugin(BasePlugin), hook implementations
    routes.py     # FastAPI router (delegates to service functions)
    <module>.py   # business logic
  tests/
    test_*.py     # pytest tests
  pyproject.toml  # entry point: [project.entry-points."adaptive_learner.plugins"]
```

- Die Plugin-Klasse erbt von `BasePlugin` (pluginforge).
- Geschäftslogik lebt in eigenen Modulen, NICHT in routes.py.
- routes.py enthält nur FastAPI-Endpunkte, die delegieren.
- Hook-Specs leben in `backend/app/hookspecs.py`.
- Plugin-Abhängigkeiten als Klassenattribut: `depends_on =
  ["session"]`.
- Alle Plugins sind frei (MIT). Eine Lizenzierungsschicht gibt es nicht.

## Hooks (10 Specs in `backend/app/hookspecs.py`)

| Hook | Wann | First-result? |
|---|---|---|
| `get_assessment_questions(lang)` | Laden der Assessment-Seite | ja |
| `calculate_profile(answers)` | Assessment absenden | ja |
| `create_session_prompt(...)` | Jeder Chat-Turn | ja |
| `ai_complete(messages, model, api_key, max_tokens)` | Standard-KI-Aufruf | ja (Provider routet per Modell-Präfix) |
| `ai_complete_async(...)` | Parallele Auswertung an der Cycle-Grenze (v1.5.0) | ja |
| `ai_complete_stream(...)` | Streaming-Session-Antwort (v1.6.0) | ja |
| `recommend_method_switch(...)` | Dashboard + Session | ja |
| `on_session_complete(session, rating)` | Session-Ende | broadcast |
| `get_progress_summary(project_id)` | Dashboard-Widgets | broadcast |
| `get_tool_recommendations(profile, lang)` | Dashboard-Tools | broadcast |

## Datenfluss

```
UI (React) → IStorageService
            → (API mode) FastAPI router → service → SQLAlchemy → SQLite
            → (Dexie mode) Dexie table → IndexedDB
            ↓
            AI orchestrator → resolve_api_key (env > yaml > DB)
                            → pluginforge → provider plugin's ai_complete*
                            → Anthropic / OpenAI / Gemini / Perplexity SDK
```

Einbahnstraße. Kein direkter DB-Zugriff aus Routern. Kern-
Request-Services erreichen die DB nur über ein
**Repository**-Interface (`backend/app/repositories/`,
zusammengesetzt in `deps.py`); das Repository-Paket ist HTTP-frei
und liefert Domänen-Entitäten zurück. Plugins nutzen weiterhin
SQLAlchemy-`Session` direkt (die Repository-Migration Phase 2
steht noch aus). Kein Frontend-Code im Backend.

## Fehlerbehandlung

```
Frontend       ApiError (status + detail) → Toast für den User
API client     HTTP-Fehler → in ApiError umgewandelt
Router         Dünn, fängt nichts. Globaler Exception-Handler mappt.
Service        Wirft AdaptiveLearnerError-Subklassen
Plugin         Wirft PluginError(plugin_name, message)
External       ExternalServiceError(service, message) für Provider-SDKs
```

Services werfen NIEMALS `HTTPException`; Router fangen NICHTS.
Der globale Exception-Handler in `main.py` mappt Domänenfehler
auf HTTP-Statuscodes. Das vollständige Muster steht in
`.claude/rules/code-hygiene.md`.

## Persistenz

- Backend: SQLAlchemy + SQLite. Alembic-Migrationen in
  `backend/migrations/versions/`.
- Sync-Surface: 30 Tabellen (`sync_service.ALL_SYNC_TABLES`).
  Append-only-History-Zeilen (Sessions, Messages, Ratings,
  Progress-Commits, Step-Evaluations, Method-Switches,
  importierte Conversations, importierte Messages, Anki-Cards,
  Study-Questions) plus veränderliche Settings- + Curriculum-
  Zeilen.
- Backup-Format: JSON; API-Keys werden beim Export entfernt;
  Restore ist ein Merge.
- Test-Isolation: Produktionsdaten-Verzeichnisse tragen einen
  `.adaptive-learner-production`-Marker; sieht ein Test ihn je,
  bricht der Lauf mit `pytest.exit(returncode=2)` ab.

## Frontend-Struktur (nach den God-Folder-Splits)

Ordner sind nach Concern/Domäne gruppiert, jeder mit einem
Barrel (`index.ts`) + Parent-Re-Export:

```
frontend/src/
  api/          FastAPI client (the only place fetch() lives)
  components/   UI, grouped by concern: dashboard/ lesson/ exercises/
                content/ settings/ nav/ progress/ session/ import/ ...
  features/     feature-strategy gating (useFeatureAvailable, featureConfig)
  hooks/        React hooks
  lib/          business logic, grouped by domain: lesson/ srs/ ai/
                adaptive/ review/ gamification/ content/ learning-path/ ...
  pages/        route components + content/ dashboard/ lesson/
                learning-path/ onboarding/ system/ subdirs
  shared/       app-independent reusable components
  storage/      dual storage; see the Storage layer page. Subdirs:
                dexie/ backup/ content/ gamification/ lessons/ ai/
                anki/ sync/ services/ types/
  styles/       design tokens + per-theme CSS
```

## Navigation (EXP-037)

Die primäre Navigation besteht aus **7 gruppierten Einträgen**
(Dashboard, Lernpfad, Meine Inhalte, Entdecken, Fortschritt,
Settings, Help) über ein wiederverwendbares `NavGroup`. Auf
Mobilgeräten zeigt eine `BottomTabBar` 5 Tabs (Lernen, Inhalte,
Entdecken, Fortschritt, Mehr) plus ein "Mehr"-Bottom-Sheet
(während Lektionen und im Funnel ausgeblendet). Mehrere Seiten
sind tab-basierte Hubs:

- **Dashboard** - Tabs Overview / Activity / Missions
  (`DashboardOverviewTab` / `DashboardActivityTab` /
  `DashboardMissionsTab`; nur der aktive Tab wird gemountet).
- **ProgressHub** (`/progress`) - Übersicht / Statistik /
  Meine Pfade.
- **DiscoverHub** (`/discover`) - ergänzt einen Import-Tab;
  **ContentHub** ist "Meine Inhalte" (nur heruntergeladene
  Inhalte).

Alte Links bleiben über Redirects erhalten (`/statistics` →
`/progress?tab=stats`, `/import` → `/discover?tab=import`, …).

## Theming

CSS-Variablen-Design-Tokens steuern jede visuelle Eigenschaft -
12 Theme-Dateien (`light`, `dark`, `ocean`, `forest`,
`high-contrast`, `sepia` + die empfohlenen WCAG-AA-Presets
`catppuccin-latte/-mocha`, `supabase`, `graphite`, `soft-pop`,
`amethyst-haze`) plus ein `auto`-Modus, der dem OS folgt. Das
kanonische Token-Set lebt einmal pro Theme in
`frontend/src/styles/themes/theme-*.css`; theme-agnostische
Tokens liegen in `global.css`. **Tailwind CSS v4 + shadcn/ui**
sind adaptiert (ab v1.54.0, schrittweise Migration): Utilities
konsumieren die CSS-Variablen über eine `@theme`-Bridge, sodass
jedes Theme automatisch umfärbt. Neue UI nutzt Tailwind-Utilities
(token-backed); keine hartkodierten Farben, erzwungen durch
`no-hardcoded-colors.test.ts`.

## Mobile / PWA

`@media (max-width: 768px)` ist der kanonische Mobile-Cut-over
(Hamburger-Drawer, 44×44-Touch-Targets, gestapelte Layouts).
`@media (max-width: 360px)` ist das Safety-Net für extrem
schmale Geräte. Desktop-Styles ≥769px bleiben unverändert.

Service-Worker (Workbox über vite-plugin-pwa): NetworkFirst auf
GET `/api/` mit 4s-Timeout, 24h-LRU, 60-Einträge-Cap.
Veränderndes `/api/` ist NetworkOnly.

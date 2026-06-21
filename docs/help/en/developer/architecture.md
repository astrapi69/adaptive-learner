# Architecture

Adaptive Learner is a 4-layer plugin-driven application.

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
│ PluginForge        ^0.10.0 (external PyPI; identity-gated   │
│                    via target_application)                  │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ entry_points
┌─────────────────────────────────────────────────────────────┐
│ Plugins            10 packages under plugins/               │
│                    (ai-{anthropic,openai,gemini}, assessment,│
│                    session, tracking, tools, gamification,  │
│                    anki, notebooklm)                        │
└─────────────────────────────────────────────────────────────┘
```

New features ALWAYS belong in a plugin, unless they touch the
core (users / projects / settings / curriculum / topics /
lessons / backup / sync / system / import).

## Dual storage (v0.7.0)

The frontend has a single seam where the backing store is
chosen: `getStorage(): IStorageService`. Two implementations
satisfy one contract:

- **`apiStorage`** (default): thin wrapper around
  `api/client.ts` that talks to the FastAPI backend.
- **`dexieStorage`** (local-first): full IndexedDB stack
  mirroring all 30 SQLAlchemy models. AI calls fire direct
  from the browser via `storage/ai-providers.ts`.

`IStorageService` exposes 22 namespaces (users, projects,
settings, assessment, session with streaming, tracking,
tools, curricula, topics, lessons, plugins, system, backup,
export, subjects, tags, projectTaxonomy, imports,
gamification, anki, pronunciation, notebooklm). Both
backings implement every method.

The factory reads
`localStorage["adaptive-learner.storage_mode"]` then
`VITE_STORAGE_MODE` (set by the GH Pages build) then
defaults to `api`. Switching modes is not a live-swap: the
Settings page persists the choice and toasts a reload-
required notice.

## Three-layer secrets (v1.20.0 / Phase 34)

```
env vars            > secrets.yaml         > Fernet DB column
ADAPTIVE_LEARNER_*    ~/.config/...yaml      api_key_<provider>
```

Every AI call walks the chain via
`services/settings.resolve_api_key`:

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` env var.
2. `ai.<provider>.api_key` in
   `~/.config/adaptive_learner/secrets.yaml`.
3. Fernet-decrypted DB column.
4. `None` — the AI call surfaces an error to the UI.

Source attribution lives on `UserSettingsOut.key_source_*`
(enum: `env` / `secrets_yaml` / `settings` / `none`).
Settings UI disables Save / Remove when source is env or
secrets_yaml.

Same chain applies to `default_model` overrides per
provider; `secrets.yaml` beats the UI override per the
Phase 34 design (file-config wins over UI for power users).

## Plugin structure

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

- Plugin class inherits from `BasePlugin` (pluginforge).
- Business logic lives in its own modules, NOT in routes.py.
- routes.py contains only FastAPI endpoints that delegate.
- Hook specs live in `backend/app/hookspecs.py`.
- Plugin dependencies as a class attribute: `depends_on =
  ["session"]`.
- All plugins are free (MIT). The licensing infrastructure
  exists but is dormant (`LICENSING_ENABLED = False`).

## Hooks (8 specs in `backend/app/hookspecs.py`)

| Hook | When | First-result? |
|---|---|---|
| `get_assessment_questions(lang)` | Assessment page load | yes |
| `calculate_profile(answers)` | Assessment submit | yes |
| `create_session_prompt(...)` | Each chat turn | yes |
| `ai_complete(messages, model, api_key, max_tokens)` | Standard AI call | yes (provider routes by model prefix) |
| `ai_complete_async(...)` | Parallel cycle-boundary eval (v1.5.0) | yes |
| `ai_complete_stream(...)` | Streaming session reply (v1.6.0) | yes |
| `recommend_method_switch(...)` | Dashboard + Session | yes |
| `on_session_complete(session, rating)` | Session end | broadcast |
| `get_progress_summary(project_id)` | Dashboard widgets | broadcast |
| `get_tool_recommendations(profile, lang)` | Dashboard tools | broadcast |

## Data flow

```
UI (React) → IStorageService
            → (API mode) FastAPI router → service → SQLAlchemy → SQLite
            → (Dexie mode) Dexie table → IndexedDB
            ↓
            AI orchestrator → resolve_api_key (env > yaml > DB)
                            → pluginforge → provider plugin's ai_complete*
                            → Anthropic / OpenAI / Gemini SDK
```

Unidirectional. No direct DB access from routers (services
own the SQLAlchemy work). No frontend code in the backend.

## Error handling

```
Frontend       ApiError (status + detail) → toast for the user
API client     HTTP error → converted to ApiError
Router         Thin, catches nothing. Global exception handler maps.
Service        Throws AdaptiveLearnerError subclasses
Plugin         Throws PluginError(plugin_name, message)
External       ExternalServiceError(service, message) for provider SDKs
```

Services NEVER throw `HTTPException`; routers catch
NOTHING. The global exception handler in `main.py` maps
domain errors to HTTP status codes. See
`.claude/rules/code-hygiene.md` for the full pattern.

## Persistence

- Backend: SQLAlchemy + SQLite. Alembic migrations in
  `backend/migrations/versions/`.
- Sync surface: 30 tables (`sync_service.ALL_SYNC_TABLES`).
  Append-only
  history rows (sessions, messages, ratings, progress
  commits, step evaluations, method switches, imported
  conversations, imported messages, anki cards, study
  questions) plus mutable settings + curriculum rows.
- Backup format: JSON; API keys stripped on export; restore
  is a merge.
- Test isolation: production data dirs carry a
  `.adaptive-learner-production` marker; if a test ever
  sees it, the run aborts with `pytest.exit(returncode=2)`.

## Theming

5 themes (Classic, Cool Modern, Nord, Notebook, Studio) ×
light/dark = 10 variants. CSS variables throughout; no
Tailwind. Custom properties in
`frontend/src/styles/global.css`. New UI elements MUST use
the variable set.

## Mobile / PWA

`@media (max-width: 768px)` is the canonical mobile cut-over
(hamburger drawer, 44×44 touch targets, stacked layouts).
`@media (max-width: 360px)` is the extreme-narrow safety
net. Desktop styles ≥769px unchanged.

Service worker (Workbox via vite-plugin-pwa): NetworkFirst
on GET `/api/` with 4s timeout, 24h LRU, 60-entry cap.
Mutating `/api/` is NetworkOnly.

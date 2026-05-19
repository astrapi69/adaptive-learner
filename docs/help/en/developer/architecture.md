# Architecture

Adaptive Learner is a four-layer system. The boundaries are
strict: each layer's code only knows about the layer below it.

```
1. Frontend       React 19 + TypeScript 6 (strict) + Vite 8
2. Backend        FastAPI + SQLAlchemy 2.0 + SQLite + Pydantic v2
3. PluginForge    External PyPI package, based on pluggy
4. Plugins        Standalone packages, registered via entry points
```

## Frontend: dual storage

Since v0.7.0 the frontend has a single seam where the backing
store is chosen. Every page consumes an `IStorageService` via
the `getStorage()` factory. Two implementations satisfy it:

- **ApiStorage** — thin pass-through to `api/client.ts`, which
  calls the FastAPI backend. v0.6.0 behaviour.
- **DexieStorage** — persists everything in IndexedDB via
  Dexie 4.4.2. AI calls fire direct to Anthropic / OpenAI /
  Gemini from the browser.

The factory reads `localStorage["adaptive-learner.storage_mode"]`
(set by Settings) then `VITE_STORAGE_MODE` (set by GH Pages
build) then defaults to `api`. Switching is intentionally not
a live-swap — Settings persists the choice and toasts a
reload-required notice.

[Storage layer in depth](storage-layer.md)

## Backend: layered FastAPI

```
UI (React) -> API client -> FastAPI router -> service/plugin -> SQLAlchemy -> SQLite
```

Unidirectional. Routers are thin (validate input, call a
service, return the response). Business logic lives in
service modules and plugins. Services throw
`AdaptiveLearnerError` subclasses; the global exception
handler in `main.py` maps them to HTTP codes.

## Plugin system

[PluginForge](https://github.com/astrapi69/pluginforge) is an
external PyPI package (we pin `^0.7.0`). It wraps
[pluggy](https://pluggy.readthedocs.io/) — Python's de-facto
plugin spec used by pytest, tox, devpi, and many more.

v0.7.0 brought identity gating: every plugin declares
``target_application = "adaptive_learner"`` and the
``PluginManager`` is constructed with
``app_id="adaptive_learner"``. Foreign plugins that target a
different app are filtered out automatically, even when their
entry-point group collides.

Eight hook specifications live in `backend/app/hookspecs.py`.
Seven plugins ship with the project:

| Plugin | Routes | Hooks |
|---|---|---|
| assessment | /questions, /evaluate, /profile/{id} | get_assessment_questions, calculate_profile |
| ai-anthropic | (hook-only) | ai_complete (firstresult, model `claude-*`) |
| ai-openai | (hook-only) | ai_complete (firstresult, model `gpt-*`) |
| ai-gemini | (hook-only) | ai_complete (firstresult, model `gemini-*`) |
| session | /start, /{id}/message, /{id}/rate, /{id}/end, /switch-recommendation/{id}, /{id}/switch | create_session_prompt (firstresult), recommend_method_switch |
| tracking | /progress/{id}, /commits/{id} | on_session_complete, get_progress_summary |
| tools | /recommendations/{id}, /spaced/{id} | get_tool_recommendations |

PluginForge bootstraps the registry in
`backend/app/main.py` at app startup. Plugin discovery is via
entry points in each plugin's `pyproject.toml`:

```toml
[project.entry-points."adaptive_learner.plugins"]
my_plugin = "my_plugin.plugin:MyPlugin"
```

## Data flow

A typical session message:

```
User types -> SessionChat.send() -> getStorage().session.message()
                                                |
                          ApiStorage                       DexieStorage
                              |                                |
        POST /api/plugins/session/{id}/message     direct AI call (Anthropic/OpenAI/Gemini)
                              |                                |
                  session plugin route                  step evaluator
                              |                                |
                    ai_complete hook                   write to IndexedDB
                              |
                       step evaluator
                              |
                  write to SQLite tables
```

Both paths produce the same `SessionMessageExchangeResult`
shape; the frontend doesn't branch on storage mode for chat
behaviour.

## Repository layout

```
adaptive-learner/
├── backend/app/           FastAPI shell + database + hookspecs + plugin manager
├── backend/config/        app.yaml + i18n/ (8 languages)
├── frontend/src/storage/  IStorageService + ApiStorage + DexieStorage
├── frontend/src/pages/    Landing, Onboarding, Assessment, Dashboard, ...
├── plugins/               7 plugins, each a standalone Poetry package
├── launcher/              Cross-OS PyInstaller desktop launcher
├── docs/help/             MkDocs source for this site
├── .github/workflows/     CI + GH Pages deploy
└── Makefile, docker-compose.yml
```

[Setup the dev environment](setup.md)

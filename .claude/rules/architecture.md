# Architecture rules

## Layered architecture (4 layers, ALWAYS respected)

```
1. Frontend        React 19 + TypeScript 6 (strict) + Vite 8
2. Backend         FastAPI + SQLAlchemy 2.0 + SQLite + Pydantic v2
3. PluginForge     External PyPI package (pluginforge ^0.10.0), based on pluggy
4. Plugins         Standalone packages, registered via entry points
```

New features ALWAYS belong in a plugin, unless they touch the
core (User / LearningProject / LearningProfile / Curriculum /
LearningTopic / Lesson / LearningSession CRUD, settings,
backup/restore, sync, UI shell, 13-route navigation).

## Two repositories

| Repo | Purpose | License |
|------|---------|---------|
| `pluginforge` | Application-agnostic plugin framework (PyPI) | MIT |
| `adaptive-learner` | Adaptive learning platform, uses PluginForge | MIT (all plugins free during development) |

PluginForge is EXTERNAL. Changes to PluginForge are a separate
repo and a separate release cycle. Adaptive Learner pins
`pluginforge ^0.10.0`. v0.9.0 shipped the hard-filter transition
for `target_application` (plugins without it would be rejected
on a host with `app_id` set); all our plugins have declared
`target_application = "adaptive_learner"` since v1.7.0. v0.9.0
also added lifecycle visibility
(`PluginState.activated_at` / `.last_config_change`,
`inspect_plugin()` aggregator, `on_plugin_activated` /
`on_plugin_deactivated` / `on_config_refreshed` event hooks).

## Backend (Python/FastAPI)

### Structure per plugin

```
plugins/adaptive-learner-plugin-{name}/
  adaptive_learner_{name}/
    plugin.py          # {Name}Plugin(BasePlugin), hook implementations
    routes.py          # FastAPI router (delegates to service functions)
    {module}.py        # business logic (no FastAPI code here)
  tests/
    test_{name}.py     # pytest tests
  pyproject.toml       # entry point: [project.entry-points."adaptive_learner.plugins"]
```

### Rules

- Plugin class inherits from BasePlugin (pluginforge).
- Business logic in its own modules, NOT in routes.py.
- routes.py contains only FastAPI endpoints that delegate to service functions.
- Hook specs live in backend/app/hookspecs.py. Define new hooks there, with api_version. 10 hooks shipped; see CLAUDE.md plugin table for the catalogue.
- Pydantic v2 for all request/response schemas.
- SQLAlchemy 2.0 mapped models in backend/app/models/__init__.py (single-file domain model, currently 28 entities).
- Configuration via YAML (backend/config/plugins/{name}.yaml), NOT hardcoded.
- Extend i18n strings in backend/config/i18n/{lang}.yaml (8 languages: DE, EN, ES, FR, EL, PT, TR, JA, all fully translated).
- Plugin dependencies as a class attribute: `depends_on = ["session"]`.
- All plugins are free (MIT). Licensing infrastructure exists but is dormant (`LICENSING_ENABLED = False`).

### Repository pattern (data layer, EXP-024)

The request-service layer talks to the database ONLY through a
repository interface, never through a SQLAlchemy `Session` directly.
This is the strict three-layer contract (UI -> service -> repository ->
data) the EXP-024 audit established; Phase 1 migrated all 13
request-layer DB services.

- **`backend/app/repositories/`** holds the contracts + SQLAlchemy
  implementations (`<name>_repo.py`: an abstract `XRepository(Repository)`
  plus a `SqlAlchemyXRepository`). The package is **HTTP-free** — it
  never imports `fastapi`. Repositories return domain entities
  (SQLAlchemy models) or `None`; they do NOT raise domain errors.
- **`backend/app/deps.py`** is the composition root — the ONLY module
  that knows both FastAPI (`Depends`) and the concrete implementations.
  Each `get_<x>_repo(db = Depends(get_db))` binds a repository to the
  request-scoped session. Routers inject `Depends(get_<x>_repo)` and pass
  the repo into the service; a handler that needs two aggregates injects
  two repos (FastAPI caches `get_db`, so they share one session and one
  transaction).
- **Business logic stays in the service**: validation, orchestration,
  transaction-boundary decisions, and raising `AdaptiveLearnerError`
  subclasses. A repository signals a persistence-level condition (e.g. a
  UNIQUE violation) in backend-neutral terms via `RepositoryError` /
  `UniqueViolationError` (`repositories/base.py`); the service maps that
  onto the appropriate domain error.
- **Deliberate exceptions** (not request-layer DB services, so not
  migrated): `identity_service` / `conversation_analysis` /
  `adaptive_lesson` are `Session`-free; `subjects_seed` and
  `secrets_service.migrate_db_keys` are bootstrap code invoked from the
  lifespan, not via request DI. The one shared **data-layer primitive**
  that legitimately keeps a `Session` parameter is
  `sync_service._scoped_query` (the per-table user-scoping query builder)
  — consumed by BOTH `SyncRepository` and `BackupRepository` (EXP-024
  Option A: one scoping primitive, not rebuilt in two places).
- **Plugins are NOT yet migrated** (EXP-024 Phase 2). Plugin route
  modules still use `Session` directly; where a plugin handler resolves
  an API key it wraps `SqlAlchemySettingsRepository(db)` inline at the
  call site. New CORE services use the repository pattern; new plugin
  services may keep direct `Session` until Phase 2 lands.

### Plugin installation (ZIP)

Third-party plugins are installed as a ZIP through Settings > Plugins:
1. The ZIP must contain: plugin.yaml, a Python package with plugin.py
2. Extraction to plugins/installed/{name}/
3. Config to config/plugins/{name}.yaml
4. Dynamic registration via sys.path + PluginManager
5. Plugin names: lowercase letters, digits, hyphens only
6. Path traversal check on ZIP paths

### Licensing

- Adaptive Learner-specific, NOT part of PluginForge.
- Code in backend/app/licensing.py.
- HMAC-SHA256 signed license keys, offline-validatable.
- Licenses in config/licenses.json, managed through the Settings UI.
- Format: ADAPTIVE_LEARNER-{PLUGIN}-v{N}-{base64 payload}.{base64 signature}

## Frontend (React/TypeScript)

### UI component strategy

| Library | Purpose |
|---------|---------|
| Tailwind CSS + shadcn/ui | CSS framework (adopted v1.54.0+). Utility classes for styling; shadcn/ui for UI primitives. Migration is INCREMENTAL — see docs/development/tailwind-migration.md. |
| Radix UI | Unstyled accessible primitives (Dialog, Tabs, Dropdown, Select, Tooltip). shadcn/ui wraps these going forward; existing direct usage stays until migrated. |
| TipTap 2 | Rich-text editor in session notes, curriculum descriptions, lesson content (StarterKit + 15 extensions) |
| Lucide React | Icons |
| react-toastify | Toast notifications |
| Recharts 3 | Charts on the Dashboard / Progress pages |
| html5-qrcode | QR scanner for AI provider keys |
| Dexie 4 | IndexedDB wrapper for the Dexie-mode storage backing |

**CSS Framework: Tailwind CSS + shadcn/ui (adopted v1.54.0+).** New
components MUST use Tailwind utility classes. Existing components are
migrated when touched, not proactively (no Big Bang rewrite). The 6
themes continue to work through CSS variables — Tailwind CONSUMES them
(theme integration: CSS variables mapped into the Tailwind config). See
docs/development/tailwind-migration.md.

Rejected: MUI (too opinionated), Ant Design (too heavy).

### Theming

- 5 themes: Classic, Cool Modern, Nord, Notebook, Studio (each with Light + Dark = 10 variants). Audit recipe to verify the current count: `grep -oE 'data-app-theme="[a-z-]+"' frontend/src/styles/global.css | sort -u`.
- Everything via CSS variables. The canonical tokens live in
  frontend/src/styles/global.css + styles/themes/theme-*.css.
- Tailwind CSS (v4) consumes those CSS variables via a `@theme` mapping
  in frontend/src/styles/tailwind.css (theme integration: CSS variables
  mapped into the Tailwind config). Switching `[data-theme]` flips the
  variables, so every Tailwind utility recolors automatically across all
  6 themes. New UI uses Tailwind utilities (which still resolve to the
  CSS variables); do not add new hand-written rules to global.css.

### Plugin UI (manifest-driven)

Plugins declare UI extensions via get_frontend_manifest(). The frontend queries /api/plugins/manifests.

Predefined UI slots:

| Slot | Location |
|------|----------|
| settings_section | Settings > Plugins |
| dashboard_widget | Dashboard cards (e.g. Learning Repository widget) |
| session_panel | Session step sidebar |

For complex plugin UIs: Web Components as custom elements (compiled JS bundle in the plugin ZIP).

### TipTap editor (rich-text in notes / curriculum / lessons)

- 15 official extensions + 1 community (Figure/Figcaption via @pentestpad/tiptap-extension-figure).
- 24 toolbar buttons.
- Used as the editor for session-rating notes, curriculum descriptions, and lesson content (since v1.14.0).
- IMPORTANT: the image node is registered as `imageFigure`, NOT `image` — see lessons-learned.md for the gotcha.
- Before writing custom code, ALWAYS check whether an official TipTap extension exists.

### Component structure

- 13 routes in frontend/src/pages/: Landing, Onboarding, Assessment, Dashboard, Session, Curriculum, Progress, Settings, Import, ImportDetail, Anki, Pronunciation, NotFound.
- Shared components in frontend/src/components/.
- API calls ONLY through `getStorage()` (which returns an `IStorageService` — either ApiStorage or DexieStorage). NEVER call `fetch()` or `api.*` directly from a component; route through the storage abstraction so both modes work. See the "Dual storage" section below.

### UX patterns for forms

- **Stepped modal** for creation dialogs: step 1 shows only required fields, step 2 is collapsible (Radix Collapsible, "More details") for optional fields.
- **Reason:** modals stay compact for quick creation, optional fields don't clutter it.
- **Example:** CreateProjectModal - step 1: topic, goal (required only). Step 2: timeframe, daily minutes, language, current problem.
- **Collapsible:** Radix Collapsible (@radix-ui/react-collapsible) for expandable sections in modals. Collapsed when opened.
- **Input fields with suggestions:** `<input>` + `<datalist>` for free text with dropdown suggestions. No hard select when custom values should be possible.
- **Conditional fields:** checkbox toggle for optional groups. Values are reset when deactivated.
- **No dedicated page** for simple creation workflows. A modal is enough up to ~8 fields.

### State management

- Current: React state + props + a few cross-cutting contexts (`I18nProvider`, theme, auto-backup signal). No global state management library.
- If global state becomes necessary: introduce Zustand, NOT Redux.
- Stores communicate through events or callbacks, not through direct imports.

## Internal storage format

- TipTap JSON is the rich-text storage format. NOT HTML, NOT Markdown.
- Markdown is only a display/input mode in the editor.
- Conversion (JSON -> Markdown, JSON -> HTML) lives in `frontend/src/lib/tiptap-to-markdown.ts` and is consumed by the export plugins (Anki, NotebookLM, Learning Repository renderer).
- TipTap JSON is stored in: `SessionNote.body`, `Curriculum.description`, `Lesson.content`.

## Persistence — dual storage abstraction

Adaptive Learner ships with TWO independent storage backings,
selected by the user in Settings (reload required to switch).
Every page + component reads via `getStorage()` → `IStorageService`
so the same code runs against either backing.

### ApiStorage (default)

- Backend: FastAPI + SQLAlchemy 2.0 + SQLite (single-writer
  semantics; minimize writes + batch where possible).
- Frontend: `api.*` HTTP calls under `/api/`.
- Assets: local on the filesystem under `~/.local/share/adaptive_learner/`.
- Backup: round-trip via `/api/backup/export` + `/api/backup/import` — a single JSON dump.

### DexieStorage (GitHub-Pages-shape build)

- Frontend: Dexie 4 (IndexedDB) for every storage namespace.
- No backend roundtrip — Dexie holds the canonical data; AI calls
  go browser-direct to the provider.
- Build flag: `VITE_STORAGE_MODE=dexie`. Static build deployed to
  `https://astrapi69.github.io/adaptive-learner/`.
- Some features stay server-only (Learning Repository `git
  persist` needs filesystem + git binary; the button is disabled
  with a friendly tooltip in Dexie mode).

### Rule: every new feature MUST work in both modes

A feature that ships in API mode without a Dexie path
(or without a graceful "not available in browser mode"
message) is a release blocker — see lessons-learned.md
"Dexie-mode is part of the contract: same-commit or not at all".

### SYNC-UI-GATE: render sync UI only for the role that can use it

The sync feature is seen from three device roles, each needing a
different slice of the UI (or none):

| Role | Storage mode | Sync UI |
|------|--------------|---------|
| Desktop (server) | API | generate QR, sync status, "Sync Now" |
| Mobile (client) | Dexie | scan QR / paste link, sync status after pairing |
| PWA-only | Dexie | none |

- **Current (Phase 1 LAN Mode not implemented):** the Sync controls are
  gated via the feature registry — `<Feature id={FEATURES.SYNC}>` in
  `Settings.tsx` resolves to `disabled` (reason `desktop_only`) in Dexie
  mode, and the `whenDisabled` fallback renders the section header plus
  a notice card ("Only available with the desktop app"). Correct,
  because without a working pairing flow the Mobile-client UI would run
  into nothing — but the user still learns the feature exists.
- **Later (when Phase 1 LAN Mode lands):** rebuild the binary gate
  (API vs Dexie) into the three-way gate above. The current context
  (`{mode, hasAiKey}`) cannot distinguish Mobile-client from PWA-only —
  that distinction (device detection vs an explicit "I am a mobile
  client" flow) is an open architecture decision; do NOT reintroduce
  the pairing UI in Dexie mode until it is made, or it becomes a dead
  control on the PWA-only deployment.
- **General rule (feature-state policy, #335 — supersedes the #51
  "UI does not exist" rule):** a product feature is never `hidden`.
  Everything the user owns is visible — either `active`, or `disabled`
  with a localized reason (`feature.api_key_required` /
  `feature.desktop_only`). A disabled SECTION is not a greyed-out dead
  panel: the header stays, the controls are replaced by a notice card
  explaining the reason. A disabled BUTTON carries the reason as its
  tooltip. `hidden` is reserved for dev-only feature flags and the
  registry's fail-closed handling of unknown ids.

Full reference: [docs/SYNC-ARCHITECTURE.md](../../docs/SYNC-ARCHITECTURE.md).
Origin: issue #51; state policy revised in #335.

## Data flow

```
API mode:    UI (React) -> getStorage() (ApiStorage) -> api.* -> FastAPI router -> service -> repository -> SQLAlchemy -> SQLite
Dexie mode:  UI (React) -> getStorage() (DexieStorage) -> Dexie -> IndexedDB
```

Unidirectional. No direct DB access from routers. Core request
services reach the DB only through a repository interface (EXP-024;
plugins still use SQLAlchemy directly pending Phase 2). No frontend
code in the backend. No `fetch()` or `api.*` calls outside the
storage abstraction.

## Error handling

```
Frontend       ApiError (status + detail) -> toast for the user, mapped via ui.errors.* i18n keys
API client     HTTP error -> converted to ApiError; debug mode adds traceback for "Report Issue"
Router         Thin, catches nothing. Global exception handler maps.
Service        Throws AdaptiveLearnerError subclasses (NotFoundError, ValidationError, ...)
Plugin         Throws PluginError(plugin_name, message)
External       ExternalServiceError(service, message) for AI providers, edge-TTS, etc.
```

Services NEVER throw HTTPException, routers catch NOTHING. The
global exception handler in main.py maps AdaptiveLearnerError
subclasses to HTTP status codes. See code-hygiene.md "Error
handling architecture" for details.

User-facing errors never expose raw HTTP detail or stack traces
in production (Dev Mode is a Settings toggle; off by default,
maps every ApiError to a friendly `ui.errors.*` string).

## Plugin package versions

Plugin versions are independent of the app version. A plugin is
bumped only when the plugin itself changed, not on every app release.

- No forced bump of every `plugins/adaptive-learner-plugin-*/pyproject.toml` on an app release.
- Plugin versions stay at `1.0.0` until there is a real reason to raise them (new hook version, breaking change in the plugin API, ...).
- The app version bump touches `backend/pyproject.toml` (canonical) + every Tier-2 file via `make sync-versions`.
- Plugin changes are recorded in the per-release changelog at `changelog/releases/vX.Y.Z.md`, but the plugin version string stays unchanged.

Reason: plugins have their own lifecycles, and trial keys / license keys are bound to the plugin name, not to the version. A bump without a change would only create noise.

## Plugin settings visibility

Every plugin setting in `config/plugins/*.yaml` MUST either:

1. Be editable in the plugin UI (Settings > Plugins > {plugin name}), OR
2. Be marked with a `# INTERNAL` comment to signal that it can only be edited via YAML.

Hidden settings that influence user behavior without a UI are
forbidden. A setting that has a default value and changes how
the app behaves MUST be visible and editable by the user.

Exceptions are allowed only for:
- Debug and development settings (marked `# INTERNAL`)
- Performance-tuning parameters that only power users should touch (marked `# INTERNAL` + comment)

Dead settings (fields in the YAML that the code never reads)
are forbidden. When adding a new setting, ALWAYS verify that
the code reads it; when removing a feature, ALWAYS remove the
corresponding YAML field with it.

Per-user vs per-project: settings that should vary between
projects do NOT belong in `config/plugins/*.yaml` but as a
column on the relevant model (e.g. `LearningProject.daily_minutes`,
`LearningProject.current_problem`). Plugin-global YAML settings
are only for values that must be the same for ALL projects.

## Offline/local-first

- SQLite as the default (no external DB required).
- Assets local on the filesystem under `~/.local/share/adaptive_learner/`.
- Frontend deliverable as static files (GitHub Pages-shape build runs Dexie-mode with no backend).
- License validation offline (signed keys, no license server).
- Exception: plugins with external AI providers (Anthropic, OpenAI, Gemini) need network access; the three-layer key resolution chain (env > `~/.config/adaptive_learner/secrets.yaml` > Fernet-encrypted DB) means the user controls where the key lives.

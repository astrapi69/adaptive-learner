# Adaptive Learner

Adaptive learning system based on the six-method learning model
(Asterios Raptis, *Von Theorie zur Praxis*, Medium series). The
plugin-loader infrastructure, layered architecture, test discipline,
and Python + React tech stack were extracted from the Bibliogon
project; the Bibliogon EXAMPLE-DOMAIN models (Book, Chapter, Article,
Author, ...) and every router, service, page and component that
depended on them are gone.

- **Repository:** https://github.com/astrapi69/adaptive-learner
- **Project plan:** [docs/adaptive-learner-project-reference.md](docs/adaptive-learner-project-reference.md) — domain models, hooks, plugins, API, roadmap
- **Concept:** [docs/CONCEPT.md](docs/CONCEPT.md) — short overview, points at the project plan
- **API reference:** FastAPI OpenAPI under `/api/docs` and `/openapi.json`
- **Current state (v0.9.0):** v0.8.x plus Phase 12 —
  **Chat-history import + AI analysis.** Users paste or
  upload a conversation from ChatGPT, Claude, Gemini or any
  generic JSON / markdown source. A new
  ``frontend/src/chat_import/`` module ships four parser
  paths plus auto-detection; the analysis engine
  (``chat_import/analysis.ts``) chunks long transcripts with
  2-message overlap and emits a structured
  ``ConversationAnalysisResult`` (topic, strengths,
  weaknesses, error patterns, recommended method, suggested
  curriculum). Two new SQLAlchemy models
  (``ImportedConversation``, ``ImportedMessage``), Alembic
  migration ``0004_imported_conversations``, mirrored Dexie
  schema v2, and a new ``IImportsNamespace`` on the storage
  layer. New pages ``/import`` (Quick Analysis paste box +
  file upload + list) and ``/import/:id`` (transcript +
  structured analysis cards + "Create curriculum" action).
  Backend 462 tests + frontend 503 vitest at release time.
  All eight i18n catalogs carry the new ``import.*`` block.
  v0.8.x baseline (MkDocs docs site, Dexie storage,
  browser-direct AI, GH Pages deploy) carried forward
  unchanged.

## Development guidelines

Detailed rules live in `.claude/rules/` (inherited from Bibliogon; apply
to any well-engineered project of this shape).

**Always relevant:**
- `architecture.md` — layered architecture, plugin structure, UI strategy, data flow
- `coding-standards.md` — naming, function design, tests, dependencies

**On demand:**
- `code-hygiene.md` — linting, pre-commit, error handling, API conventions
- `lessons-learned.md` — known pitfalls (carries over Bibliogon-era learnings; prune as they prove irrelevant)
- `quality-checks.md` — test strategy, pre-commit checklists
- `ai-workflow.md` — order for features/plugins, docs protocol
- `release-workflow.md` — release process (triggered by "release new version")

On a conflict between CLAUDE.md and the rules, the rules win.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry
- **Frontend:** React 19, TypeScript 6 (strict), Vite 8, react-router-dom 7, react-toastify, Recharts 3, tree-model 1
- **PWA (v0.6.0):** vite-plugin-pwa, Workbox-generated service worker, manifest with SVG + maskable-PNG icons at 192/512
- **Storage (v0.7.0):** dexie ^4.4.2 (IndexedDB) + fake-indexeddb for tests; storage layer abstracts ApiStorage / DexieStorage behind one interface
- **Plugins:** pluginforge ^0.7.0 (PyPI, identity-gated via `target_application = "adaptive_learner"`), entry points under group `adaptive_learner.plugins`
- **Launcher:** PyInstaller-based cross-OS desktop launcher (`launcher/`)
- **Testing:** pytest, Vitest, Playwright
- **Tooling:** Poetry, npm, Docker, Make, ruff, pre-commit

## Architecture (short)

4 layers: Frontend → Backend → PluginForge → Plugins. Details in
`.claude/rules/architecture.md`. Backend exposes core (users /
projects / settings / curricula / topics) + plugin routes
(assessment / session / tracking / tools). The frontend renders
eight routes via React Router: Landing, Onboarding, Assessment,
Dashboard, Session, Curriculum, Progress, Settings.

## Commands

```bash
make install              # Poetry + npm + plugins
make dev                  # backend (18001) + frontend (15174) in parallel
make dev-bg / dev-down    # background mode
make test                 # backend + frontend, no coverage
make test-coverage        # opt-in coverage run
make test-backend         # backend only
make test-frontend        # Vitest
make prod                 # Docker Compose
make prod-down            # stop Docker
make clean                # remove build artifacts
make help                 # all targets
```

E2E tests: `cd e2e && npx playwright test` (no specs yet; smoke spec
for the placeholder Landing lands in Phase 4A).

## Session start (Claude Code)

1. `git log --oneline -10` — recent changes
2. `make test` — green baseline
3. Read this file + `docs/adaptive-learner-project-reference.md` + relevant rules per the task

## Data model

15 SQLAlchemy models in `backend/app/models/`: User,
UserSettings, LearningProject, LearningProfile, Curriculum,
LearningTopic, Lesson, LearningSession, SessionMessage,
SessionRating, SessionNote, ProgressCommit, MethodSwitch,
ImportedConversation, ImportedMessage. Mirrored Pydantic v2
schemas in `backend/app/schemas/`. Spec in
`docs/adaptive-learner-project-reference.md` §5.1.

## Plugins

Seven plugins shipped in v0.2.0, all under `plugins/`:

| Plugin | Routes | Hook coverage |
|--------|--------|---------------|
| assessment | /questions, /evaluate, /profile/{id} | get_assessment_questions, calculate_profile |
| ai-anthropic | (hook-only) | ai_complete (firstresult, model `claude-*`) |
| ai-openai | (hook-only) | ai_complete (firstresult, model `gpt-*`) |
| ai-gemini | (hook-only) | ai_complete (firstresult, model `gemini-*`) |
| session | /start, /{id}/message, /{id}/rate, /{id}/end, /switch-recommendation/{id}, /{id}/switch | create_session_prompt (firstresult), recommend_method_switch |
| tracking | /progress/{id}, /commits/{id} | on_session_complete, get_progress_summary |
| tools | /recommendations/{id} | get_tool_recommendations |

All eight hooks live in `backend/app/hookspecs.py`. PluginForge
bootstraps the registry in `backend/app/main.py`. v0.2.0:
POST /api/plugins/session/{id}/message orchestrates the AI
roundtrip server-side (fires `ai_complete` against the active
provider, persists user + assistant messages, returns a
composite); the v0.1.0 client-side orchestration is gone.

## Launcher

Cross-OS desktop launcher under `launcher/`, packaged with PyInstaller.
Produces a single-file installer-launcher binary per OS that bootstraps
the backend, opens the frontend in the user's browser, and manages
auto-update + uninstall. Carries over from Bibliogon unchanged in
shape; only branding renames in earlier cleanup passes.

## PWA (v0.6.0)

The frontend is an installable Progressive Web App. Wiring lives
in `frontend/vite.config.ts` under the `VitePWA` plugin block.

**Manifest** — `frontend/dist/manifest.webmanifest` (generated):

- `name: "Adaptive Learner"`, `short_name: "Adaptive"` (≤12 chars
  per Android home-screen recommendation)
- `display: "standalone"`, `theme_color: "#6366f1"` (matches
  the `--accent` CSS variable)
- Icons at 192 + 512 in both SVG (modern browsers) and PNG
  (`purpose: "any maskable"` for Android cropping). Sources in
  `frontend/public/icon-*.{svg,png}`; PNGs generated via
  ImageMagick from the SVGs (see `make pwa-icons` if you need
  to regenerate).
- `categories: ["education", "productivity"]` + `lang: "en"` for
  store-listing surfaces.

**Service worker strategy** — Workbox `generateSW` mode:

- Static assets (JS, CSS, fonts, icons, HTML) precached via
  `globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"]`.
- GET `/api/` → `NetworkFirst` with 4s timeout, 24h LRU,
  60-entry cap. Returning users see cached Dashboard / Progress
  / commits when offline.
- Mutating `/api/` (POST/PATCH/DELETE) → `NetworkOnly`. Never
  cache write responses.
- `navigateFallback: "/index.html"` for SPA routing.
- `navigateFallbackDenylist: [/^\/api\//]` keeps the SPA shell
  out of backend paths so real 4xx/5xx aren't masked.
- `offline.html` precached as the deep static fallback when
  even the SPA shell isn't reachable from cache.

**Install prompt** — `frontend/src/components/InstallPrompt.tsx`
captures the browser's `beforeinstallprompt` event, renders our
own dismissable banner (bottom-anchored), and persists dismissal
to `localStorage[adaptive-learner.install_dismissed]`. Auto-hides
on `appinstalled`.

**Online status** — `frontend/src/hooks/useOnlineStatus.ts`
subscribes to `online`/`offline` window events. Navigation
renders a `role="status"` indicator (dot-only on mobile, dot +
label on desktop). Session route's offline guard blocks new
session creation when offline and shows a localised inline
message.

**Mobile breakpoints** (responsive polish, not a mobile-first
rewrite):

- `@media (max-width: 768px)` is the canonical mobile cut-over.
  Hamburger drawer, 44×44 touch targets, layouts that stack
  vertically.
- `@media (max-width: 360px)` is the extreme-narrow safety net
  (smaller page padding).
- Desktop styles at ≥769px stay unchanged from v0.5.0.

**Testing** — `e2e/smoke/mobile-viewports.spec.ts` parametrises
4 device sizes (iPhone SE 375, iPhone 14 390, Pixel 7 412,
iPad 768) and pins no-horizontal-overflow + hamburger
visibility + online indicator on each. Lighthouse audits stay
manual (smoke-tester's side).

## Storage layer (v0.7.0)

Frontend has a single seam where the backing store is chosen.
Everything routes through `getStorage(): IStorageService`. Two
implementations satisfy the same contract:

- **`apiStorage`** (default): thin wrapper around
  `api/client.ts`. Same v0.6.0 behaviour, same backend roundtrips.
- **`dexieStorage`**: full local-first stack. Schema in
  `storage/db.ts` mirrors all 14 SQLAlchemy models;
  `storage/dexie-storage.ts` provides users / projects /
  settings / curricula CRUD; `storage/assessment.ts` ports the
  12-question pack + profile calculator; `storage/prompts.ts`
  carries the 42-cell system-prompt matrix loaded from
  `data/session-prompts.json`; `storage/step-evaluator.ts` is
  the dual-prompt Phase 8B port; `storage/session-flow.ts`
  orchestrates start + message; `storage/tracking.ts` and
  `storage/tools.ts` port the aggregators. AI calls fire direct
  from the browser via `storage/ai-providers.ts` (Anthropic +
  OpenAI + Gemini).

The factory reads `localStorage["adaptive-learner.storage_mode"]`
(set by Settings) then `VITE_STORAGE_MODE` (set by GH Pages
build) then defaults to `api`. Switching modes is intentionally
not a live-swap: Settings persists the choice and toasts a
reload-required notice.

API keys in Dexie mode live cleartext in IndexedDB
(`UserSettings.api_key_{provider}`). Acceptable per design:
data sits on the user's own device, no server roundtrip, AI
calls fire direct. ApiStorage never sees these.

## GitHub Pages deployment (v0.7.0 + v0.8.0)

`.github/workflows/deploy-gh-pages.yml` is the single
unified workflow. It builds:

- The frontend with `VITE_BASE=/adaptive-learner/`,
  `VITE_STORAGE_MODE=dexie`, `VITE_API_BASE=""` →
  `frontend/dist/` (self-contained PWA, browser-direct AI).
- The MkDocs site → `frontend/dist/docs/` (mkdocs-material +
  mkdocs-static-i18n DE/EN).

Both deploy together to GitHub Pages on every push to main.
Frontend at `https://astrapi69.github.io/adaptive-learner/`,
docs at `https://astrapi69.github.io/adaptive-learner/docs/`.
SPA-router 404 fallback handled by copying `index.html` to
`404.html`.

The legacy `docs.yml` workflow was removed in 11G to
prevent the dual-deploy-to-Pages conflict.

## Documentation site (v0.8.0)

`docs/help/` holds the public MkDocs source. Structure:

```
docs/help/
├── _meta.yaml          single source of truth for nav tree
├── de/                 German content (28 pages + landing)
│   ├── index.md
│   ├── user-guide/     getting-started, onboarding, assessment, ...
│   ├── concept/        philosophy, six-methods, seven-steps, ...
│   ├── developer/      architecture, setup, plugin-guide, ...
│   └── api/            overview, core-endpoints, ..., hooks
└── en/                 English mirror, same shape
```

Navigation is auto-generated:
- `_meta.yaml` declares title (DE + EN) + slug per page.
- `scripts/generate_mkdocs_nav.py` regenerates the
  `mkdocs.yml` nav block + the nav_translations under the
  EN locale.
- `make sync-mkdocs-nav` runs the generator; `make
  verify-mkdocs-nav` is the CI-friendly drift check.

In-app help reads `_meta.yaml` directly (the Settings >
Help panel in a future phase will list its tree). The
public docs site is built from the same Markdown via
`make docs-build`.

Local preview: `make docs-serve` (port 8000, hot-reload).

## Directory structure (short)

```
adaptive-learner/
├── backend/app/           # FastAPI shell + database + paths + hookspecs + plugin manager
├── backend/config/        # app.yaml + i18n/ (8 languages, skeleton catalogs)
├── backend/tests/         # 9 infrastructure tests
├── plugins/               # empty placeholder + README
├── frontend/public/       # static assets: favicon, icon-{192,512}.{svg,png},
│                          # offline.html (PWA fallback)
├── frontend/src/
│   ├── api/client.ts      # typed namespaces for every backend route
│   ├── components/        # ProfileRadar, ProgressTimeline, MethodDistribution,
│   │                      # SessionChat, CycleProgress, RatingDialog,
│   │                      # MethodBadge, MethodSwitchBanner, Navigation,
│   │                      # ErrorBoundary, ToolRecommendations,
│   │                      # SpacedRecommendations, RecentSessions,
│   │                      # SessionCounter, StepEvaluationInsights (v0.5.0),
│   │                      # InstallPrompt (v0.6.0), TopicTree, ...
│   ├── hooks/             # useI18n (fallbacks), useTheme (light/dark),
│   │                      # useOnlineStatus (v0.6.0)
│   ├── i18n/fallbacks.ts  # inline DE/EN/ES/FR/EL strings for first-paint resilience
│   ├── lib/
│   │   ├── constants.ts   # LearningMethod / CycleStep / METHOD_COLORS / AI_PROVIDERS
│   │   ├── learnerState.ts # typed localStorage wrapper (user_id / project_id / lang)
│   │   └── tree/          # TypedTreeNode<V, K> adapter on tree-model + buildTreeFromFlat
│   ├── pages/             # Landing, Onboarding, Assessment, Dashboard, Session,
│   │                      # Curriculum, Progress, Settings, NotFound
│   ├── storage/           # v0.7.0 — IStorageService + ApiStorage (delegates
│   │                      # to api/client) + DexieStorage (IndexedDB-backed).
│   │                      # ai-providers, prompts, step-evaluator,
│   │                      # session-flow, assessment, tracking, tools.
│   ├── data/              # v0.7.0 — bundled JSON for Dexie mode:
│   │                      # assessment-questions.json, session-prompts.json
│   ├── types/             # TypeScript interfaces matching Pydantic Out-schemas
│   ├── utils/notify.ts    # toast wrapper
│   └── styles/global.css  # full token set + mobile breakpoint rules (v0.6.0)
├── e2e/                   # Playwright smoke specs (landing, onboarding,
│                          # session, settings, curriculum, mobile-viewports)
├── launcher/              # cross-OS PyInstaller launcher
├── docs/
│   ├── adaptive-learner-project-reference.md  # the plan
│   ├── CONCEPT.md         # short overview
│   ├── ROADMAP.md         # open work items
│   ├── backlog.md         # daily planning view of ROADMAP
│   └── configuration.md   # config-chain docs
├── scripts/               # ROADMAP archival, version sync
├── .github/workflows/     # CI/CD pipelines
└── Makefile, docker-compose.yml, docker-compose.prod.yml, install scripts
```

## Core conventions

- i18n: catalogs in `backend/config/i18n/{lang}.yaml`. Reference language EN; mirror structure in DE, ES, FR, EL, PT, TR, JA.
- Python: type hints, snake_case, Pydantic v2, SQLAlchemy 2.0 mapped columns.
- TypeScript: strict mode, no `any`.
- CSS: custom properties, dark mode via `[data-theme="dark"]`.
- Commits: English, conventional (feat/fix/refactor/docs).
- E2E: `data-testid` selectors only.
- Secrets NEVER in committed config files. Three-layer chain: project `backend/config/app.yaml` < `~/.config/adaptive_learner/secrets.yaml` < env-vars (`ADAPTIVE_LEARNER_*`).

## Tests

- `make test` must stay green after every change.
- v0.8.0 baseline: backend 447, plugins 478 (across 7), frontend 387 (Vitest). Total 1312. Docs site: 28 content pages + landing, DE + EN parallel.
- E2E tests under `e2e/` are NOT on the `make test` default path.
  v0.3.0 shipped 7 Playwright smoke specs under `e2e/smoke/`
  (landing, onboarding+assessment, session, curriculum, settings);
  v0.6.0 adds `mobile-viewports.spec.ts` parametrising
  iPhone SE / iPhone 14 / Pixel 7 / iPad — 16 cases pinning
  no-horizontal-overflow + hamburger visibility + online
  indicator at each viewport.

## Test isolation

Tests run in a temporary data directory, never against production data.
Two layers of protection in `backend/tests/conftest.py`:

1. `ADAPTIVE_LEARNER_TEST=1` + `TEST_DATABASE_URL=sqlite:///:memory:` set BEFORE any `app.*` import. `ADAPTIVE_LEARNER_DATA_DIR` set to a process-scoped tmp dir.
2. Production data directories carry a `.adaptive-learner-production` marker file. If any test ever sees this marker, the run aborts with `pytest.exit(returncode=2)`.

Path conventions:
- `Path("uploads")` is forbidden (CWD-relative). Use the `app.paths` helpers.
- Frozen module-level imports of paths are forbidden — use the helper functions.

In-memory caches (lru_cache, module-level state) need explicit teardown
hooks in fixtures — see `.claude/rules/lessons-learned.md`.

## Pre-commit hooks

```bash
cd backend && poetry run pre-commit install
```

Hooks: trailing-whitespace, end-of-file-fixer, check-yaml/json,
check-merge-conflict, ruff (with `--fix`), ruff-format. Backend-only.

## Related projects

- [pluginforge](https://github.com/astrapi69/pluginforge) — plugin framework (PyPI)
- [bibliogon](https://github.com/astrapi69/bibliogon) — upstream from which this skeleton was extracted

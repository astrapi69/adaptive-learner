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
- **Current state (v0.1.0):** end-to-end MVP. Full domain backend
  (Phase 1B/C), all 8 hooks (Phase 2), all five plugins (Phase 3),
  React frontend with seven pages (Phase 4). Live AI-provider auto-
  reply on the chat surface is deferred to Phase 5.

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
- **Plugins:** pluginforge ^0.5.0 (PyPI), entry points under group `adaptive_learner.plugins`
- **Launcher:** PyInstaller-based cross-OS desktop launcher (`launcher/`)
- **Testing:** pytest, Vitest, Playwright
- **Tooling:** Poetry, npm, Docker, Make, ruff, pre-commit
- **Docs site:** MkDocs (`mkdocs.yml`, `docs/pyproject.toml` carries the docs venv)

## Architecture (short)

4 layers: Frontend → Backend → PluginForge → Plugins. Details in
`.claude/rules/architecture.md`. Backend exposes the full v0.1.0
API surface: core (users / projects / settings) + plugin routes
(assessment / session / tracking / tools). The frontend renders
seven routes via React Router: Landing, Onboarding, Assessment,
Dashboard, Session, Progress, Settings.

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

13 SQLAlchemy models in `backend/app/models/`: User,
UserSettings, LearningProject, LearningProfile, Curriculum,
LearningTopic, Lesson, LearningSession, SessionMessage,
SessionRating, SessionNote, ProgressCommit, MethodSwitch.
Mirrored Pydantic v2 schemas in `backend/app/schemas/`. Spec in
`docs/adaptive-learner-project-reference.md` §5.1.

## Plugins

Five plugins shipped in v0.1.0, all under `plugins/`:

| Plugin | Routes | Hook coverage |
|--------|--------|---------------|
| assessment | /questions, /evaluate, /profile/{id} | get_assessment_questions, calculate_profile |
| ai-anthropic | (hook-only) | ai_complete (firstresult, model `claude-*`) |
| session | /start, /{id}/message, /{id}/rate, /{id}/end | create_session_prompt (firstresult), recommend_method_switch |
| tracking | /progress/{id}, /commits/{id} | on_session_complete, get_progress_summary |
| tools | /recommendations/{id} | get_tool_recommendations |

All eight hooks live in `backend/app/hookspecs.py`. PluginForge
bootstraps the registry in `backend/app/main.py`.

## Launcher

Cross-OS desktop launcher under `launcher/`, packaged with PyInstaller.
Produces a single-file installer-launcher binary per OS that bootstraps
the backend, opens the frontend in the user's browser, and manages
auto-update + uninstall. Carries over from Bibliogon unchanged in
shape; only branding renames in earlier cleanup passes.

## Directory structure (short)

```
adaptive-learner/
├── backend/app/           # FastAPI shell + database + paths + hookspecs + plugin manager
├── backend/config/        # app.yaml + i18n/ (8 languages, skeleton catalogs)
├── backend/tests/         # 9 infrastructure tests
├── plugins/               # empty placeholder + README
├── frontend/src/
│   ├── api/client.ts      # typed namespaces for every backend route
│   ├── components/        # ProfileRadar, ProgressTimeline, MethodDistribution,
│   │                      # SessionChat, CycleProgress, RatingDialog,
│   │                      # MethodBadge, MethodSwitchBanner, Navigation,
│   │                      # ErrorBoundary, ToolRecommendations, ...
│   ├── hooks/             # useI18n (with fallbacks), useTheme (light/dark)
│   ├── i18n/fallbacks.ts  # inline DE+EN strings for first-paint resilience
│   ├── lib/
│   │   ├── constants.ts   # LearningMethod / CycleStep / METHOD_COLORS / AI_PROVIDERS
│   │   ├── learnerState.ts # typed localStorage wrapper (user_id / project_id / lang)
│   │   └── tree/          # TypedTreeNode<V, K> adapter on tree-model + buildTreeFromFlat
│   ├── pages/             # Landing, Onboarding, Assessment, Dashboard, Session,
│   │                      # Progress, Settings, NotFound
│   ├── types/             # TypeScript interfaces matching Pydantic Out-schemas
│   ├── utils/notify.ts    # toast wrapper
│   └── styles/global.css  # full token set: method palette, layout, components
├── e2e/                   # Playwright (no specs yet)
├── launcher/              # cross-OS PyInstaller launcher
├── docs/
│   ├── adaptive-learner-project-reference.md  # the plan
│   ├── CONCEPT.md         # short overview
│   ├── ROADMAP.md         # open work items
│   ├── backlog.md         # daily planning view of ROADMAP
│   ├── configuration.md   # config-chain docs
│   ├── help/              # in-app help pages + _meta.yaml nav schema (skeleton)
│   └── pyproject.toml, poetry.lock  # MkDocs venv (separate from backend)
├── scripts/               # ROADMAP archival, mkdocs nav generator, version sync
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
- v0.1.0 baseline: backend 348, plugins 264, frontend 149 (Vitest).
- E2E tests under `e2e/` are NOT on the `make test` default path.

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

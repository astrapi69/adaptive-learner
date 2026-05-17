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
- **Current state:** Skeleton (Phase 1A complete). Empty-shell backend +
  minimal React shell + placeholder Landing page.

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
- **Frontend:** React 19, TypeScript 6 (strict), Vite 8, react-toastify
- **Plugins:** pluginforge ^0.5.0 (PyPI), entry points under group `adaptive_learner.plugins`
- **Launcher:** PyInstaller-based cross-OS desktop launcher (`launcher/`)
- **Testing:** pytest, Vitest, Playwright
- **Tooling:** Poetry, npm, Docker, Make, ruff, pre-commit
- **Docs site:** MkDocs (`mkdocs.yml`, `docs/pyproject.toml` carries the docs venv)

The frontend tech stack will grow as the new domain lands: TipTap is
NOT part of the skeleton, neither is Radix UI / @dnd-kit / Lucide. The
project reference doc names Recharts for the dashboard charts; that
joins package.json in Phase 4A.

## Architecture (short)

4 layers: Frontend → Backend → PluginForge → Plugins. Details in
`.claude/rules/architecture.md`. The skeleton's backend exposes only
infrastructure endpoints (`/api/health`, `/api/i18n/{lang}`,
`/api/plugins/*`); the frontend renders a single placeholder page.
Domain endpoints, pages and the first plugins land in Phases 1B / 1C /
3 / 4 per the project plan.

## Commands

```bash
make install              # Poetry + npm + plugins
make dev                  # backend (8000) + frontend (5173) in parallel
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

## Data model (skeleton — empty)

The skeleton has no models. The Bibliogon Book / Chapter / Article /
Author / Asset / Template / Publication models are gone with the
routers and services that consumed them.

The target adaptive-learning domain (User, LearningProject,
LearningProfile, LearningTopic, Curriculum, Lesson, SessionNote,
LearningSession, SessionMessage, SessionRating, ProgressCommit,
MethodSwitch, UserSettings) is documented in
`docs/adaptive-learner-project-reference.md` §5.1 and lands in
Phase 1B.

## Plugins

The skeleton ships with **zero plugins**. The loader infrastructure
(empty `backend/app/hookspecs.py`, PluginForge bootstrap in
`backend/app/main.py`) is in place. Hooks land in Phase 2; the first
five plugins (assessment, ai-anthropic, session, tracking, tools) land
in Phase 3. See `plugins/README.md` for the minimal plugin layout.

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
│   ├── api/client.ts      # minimal typed API client
│   ├── hooks/             # useI18n, useTheme (light/dark only)
│   ├── pages/Landing.tsx  # placeholder
│   ├── utils/notify.ts    # toast wrapper
│   └── styles/global.css  # minimal token set
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

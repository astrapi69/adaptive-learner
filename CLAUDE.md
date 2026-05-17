# Adaptive Learner

Project skeleton derived from the Bibliogon codebase (a book authoring platform). The plugin-loader infrastructure, layered architecture, test discipline, and Pythonic + React tech stack carry over; the domain (Articles, Books, Comments, Authors, Settings) ships as **EXAMPLE-DOMAIN** to be replaced by adaptive-learning concepts as the project develops.

- **Repository:** https://github.com/astrapi69/adaptive-learner
- **Concept:** [docs/CONCEPT.md](docs/CONCEPT.md) — inherited from Bibliogon, refine as adaptive-learner-specific concept solidifies
- **API reference:** FastAPI OpenAPI under `/docs` and `/openapi.json`
- **Origin:** scaffolded from Bibliogon v0.33.0 (2026-05-17), with all 11 plugins and their coupled backend code removed; foundation kept

## Development guidelines

Detailed rules live in `.claude/rules/` (inherited from Bibliogon; apply to any well-engineered project of this shape).

**Always relevant** (read on every feature/fix):
- `architecture.md` — layered architecture, plugin structure, UI strategy, data flow
- `coding-standards.md` — naming, function design, tests, dependencies

**On demand** (read for specific tasks):
- `code-hygiene.md` — linting, pre-commit, error handling architecture, API conventions
- `lessons-learned.md` — known pitfalls (carries over Bibliogon-era learnings; prune entries as they prove irrelevant to adaptive-learner)
- `quality-checks.md` — test strategy, mutmut/Stryker, pre-commit checklists
- `ai-workflow.md` — order for features/plugins, prohibitions, docs protocol
- `release-workflow.md` — release process (triggered by "release new version")

On a conflict between CLAUDE.md and the rules, the rules win.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry
- **Frontend:** React 18+, TypeScript (strict), TipTap (editor), Vite, Radix UI, @dnd-kit, Lucide, react-toastify
- **Plugins:** pluginforge ^0.5.0 (PyPI), entry points under group `adaptive_learner.plugins`
- **Launcher:** PyInstaller-based cross-OS desktop launcher (`launcher/`); see Launcher section below
- **Testing:** pytest, Vitest, Playwright, mutmut, Stryker
- **Tooling:** Poetry, npm, Docker, Make, ruff, ESLint, Prettier, pre-commit
- **Docs site:** MkDocs (`mkdocs.yml`, `docs/pyproject.toml` carries the docs venv)

## Architecture (short)

4 layers: Frontend → Backend → PluginForge → Plugins. Details in `.claude/rules/architecture.md`.

Lean core (UI, editor, CRUD, settings). Everything domain-specific should ship as a plugin once the adaptive-learner domain is defined. Licensing infrastructure exists but is dormant.

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

E2E tests: `npx playwright test --project=smoke` or `--project=full`.

## Session start (Claude Code)

1. `git log --oneline -10` — recent changes
2. `make test` — green baseline
3. Read this file + relevant rules per the task

## Data model (EXAMPLE-DOMAIN, replace with adaptive-learner concepts)

The inherited model covers a book-authoring workflow. Treat it as a working reference for how to wire backend + frontend + tests, then replace each concept with adaptive-learner equivalents (e.g. `LearningConcept`, `CurriculumItem`, `SkillAssessment`, `LearnerProgress`).

- **Book:** id, title, subtitle, author, language, description, marketing fields, design fields
- **Chapter:** id, book_id, title, content (TipTap JSON), position, chapter_type
- **Article:** id, title, content (TipTap JSON), tags, topic, status
- **ArticleComment:** id, article_id, body, deleted_at (soft-delete + trash lifecycle)
- **Author:** id, name, pen names
- **Asset:** id, book_id, filename, asset_type, path
- **Settings:** layered config (project YAML < user override < env-vars)

ChapterTypes, BookTemplates, Publications, and other inherited domain concepts are present in the code as further EXAMPLE-DOMAIN reference.

## Plugins

The skeleton ships with **zero plugins**. The loader infrastructure (`backend/app/hookspecs.py`, PluginForge bootstrap in `backend/app/main.py`, `backend/app/import_plugins/` registry) is in place; add plugins as the adaptive-learner domain matures.

See `plugins/README.md` for the minimal plugin layout.

## Launcher

Cross-OS desktop launcher under `launcher/`, packaged with PyInstaller. Produces a single-file installer-launcher binary per OS that bootstraps the backend, opens the frontend in the user's browser, and manages auto-update + uninstall.

- **Spec:** `launcher/adaptive-learner-launcher.spec` (PyInstaller; renamed in Phase 2d)
- **Python package:** `launcher/adaptive_learner_launcher/` (renamed in Phase 2d)
- **Per-OS build pipelines:** `.github/workflows/launcher-{linux,macos,windows}.yml` build artifacts on release tags
- **Embedded version:** injected at PyInstaller build time from `backend/pyproject.toml` via the spec (no hardcoded literal — see the "Single source of truth for version pins" pattern in `.claude/rules/lessons-learned.md`)
- **User-facing install scripts:** `install.sh` (Linux), `install.command` (macOS), `install.cmd` + `install.ps1` (Windows) — generated from `install.sh.template` + `install.ps1.template` at release time

The launcher is critical distribution infrastructure that carries over to adaptive-learner unchanged in shape; only branding renames in Phase 2c/2d.

## Directory structure (short)

```
adaptive-learner/
├── backend/app/           # FastAPI core (main, database, hookspecs, models, routers, services)
├── backend/config/        # app.yaml, i18n/ (multiple languages)
├── backend/tests/         # backend tests
├── plugins/               # empty placeholder + README (no plugins ship with the skeleton)
├── frontend/src/
│   ├── api/client.ts      # typed API client
│   ├── components/        # Editor, Toolbar, Sidebars, dialogs
│   ├── pages/             # Dashboard, Editor, Settings
│   └── styles/global.css  # CSS variables, themes
├── e2e/                   # Playwright specs (smoke + full)
├── launcher/              # cross-OS PyInstaller launcher (see Launcher section)
├── docs/
│   ├── CONCEPT.md         # project concept
│   ├── ROADMAP.md         # open work items
│   ├── API.md             # high-level API overview (OpenAPI is the source of truth)
│   ├── backlog.md         # daily planning view of ROADMAP
│   ├── configuration.md   # config-chain docs (project YAML < user override < env-vars)
│   ├── architecture/      # architecture deep-dives
│   ├── explorations/      # architectural decision records / explorations
│   ├── help/              # in-app help pages + _meta.yaml nav schema
│   ├── testing/           # test plans, tester onboarding
│   ├── smoke-tests-catalog.md, ux-conventions.md, test-infrastructure-audit.md
│   └── pyproject.toml, poetry.lock  # MkDocs venv (separate from backend)
├── scripts/               # ROADMAP archival, mkdocs nav generator, audits, version sync
├── .github/workflows/     # CI/CD: ci, coverage, docs, launcher-{linux,macos,windows}, release-gate, mutation-import
└── Makefile, docker-compose.yml, docker-compose.prod.yml,
    install.{sh,cmd,ps1,command}, start.sh, stop.sh, .env.example
```

## Core conventions

- TipTap JSON as the internal storage format (NOT HTML, NOT Markdown)
- i18n: multiple languages, all UI strings in `backend/config/i18n/{lang}.yaml`
- Python: type hints, snake_case, Pydantic v2, SQLAlchemy 2.0 mapped columns
- TypeScript: strict mode, no `any`, Radix UI for primitives
- CSS: custom properties, dark mode via `[data-theme="dark"]`
- Commits: English, conventional (feat/fix/refactor/docs)
- E2E: `data-testid` selectors only
- Secrets NEVER in committed config files. Three-layer chain: project `backend/config/app.yaml` (defaults) < `~/.config/adaptive-learner/secrets.yaml` (user override, gitignored) < env-vars (`ADAPTIVE_LEARNER_*`).

## Tests

- `make test` must stay green after every change
- E2E tests under `e2e/`, not on the `make test` default path

## Test isolation

Tests run in a temporary data directory, never against production data. Two layers of protection in `backend/tests/conftest.py`:

1. `ADAPTIVE_LEARNER_TEST=1` + `TEST_DATABASE_URL=sqlite:///:memory:` set BEFORE any `app.*` import. `ADAPTIVE_LEARNER_DATA_DIR` set to a process-scoped tmp dir.
2. Production data directories carry a `.adaptive-learner-production` marker file. If any test ever sees this marker, the run aborts with `pytest.exit(returncode=2)`.

Path conventions:
- `Path("uploads")` is forbidden (CWD-relative). Use `app.paths.get_upload_dir()`.
- Frozen module-level imports of paths are forbidden — use the helper functions.

In-memory caches (lru_cache, module-level state) need explicit teardown hooks in fixtures — see `.claude/rules/lessons-learned.md`.

## Pre-commit hooks

```bash
cd backend && poetry run pre-commit install
```

Hooks: trailing-whitespace, end-of-file-fixer, check-yaml/json, check-merge-conflict, ruff (with `--fix`), ruff-format. Backend-only.

## Related projects

- [pluginforge](https://github.com/astrapi69/pluginforge) — plugin framework (PyPI)

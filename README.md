# Adaptive Learner

Project skeleton template derived from [Bibliogon](https://github.com/astrapi69/bibliogon) (a book authoring platform). Lean foundation for adaptive-learning applications built on the same architectural pattern: FastAPI + SQLAlchemy + React + TypeScript + a plugin loader on top of [PluginForge](https://github.com/astrapi69/pluginforge).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What this is

A working full-stack starting point. The plugin-loader infrastructure, layered architecture, test discipline, build/deploy/release tooling, and Pythonic+React tech stack carry over from Bibliogon unchanged. **The DOMAIN ships as EXAMPLE-DOMAIN**: Book, Chapter, Article, ArticleComment, Author, Asset, ... are present in the code as a working reference for how to wire SQLAlchemy models + Pydantic schemas + FastAPI routers + React pages + tests end-to-end. Replace each concept with adaptive-learner equivalents (LearningConcept, CurriculumItem, SkillAssessment, LearnerProgress, ...) as the project's actual domain solidifies.

Files carrying an explicit `EXAMPLE-DOMAIN:` or `TEMPLATE:` header are flagged at the top so you can find them by grep:

```bash
grep -rn "EXAMPLE-DOMAIN\|TEMPLATE:" --include='*.py' --include='*.ts' --include='*.tsx'
```

## What's included

- **Backend** (`backend/`) — FastAPI app, SQLAlchemy 2.0 models, Pydantic v2 schemas, Alembic migrations, soft-delete + trash lifecycle, layered config (project YAML < user override < env-vars), test-isolation tripwires, i18n for 8 languages
- **Frontend** (`frontend/`) — React 18 + TypeScript (strict) + Vite + TipTap editor + Radix UI + react-toastify + Playwright E2E
- **Plugin system** (`plugins/`) — empty placeholder + `plugins/README.md` documenting the minimal plugin layout. The skeleton ships zero plugins; the loader is wired and ready.
- **Launcher** (`launcher/`) — cross-OS PyInstaller-based desktop launcher (Linux + macOS + Windows) with auto-update and uninstall flows. Per-OS build pipelines in `.github/workflows/launcher-{linux,macos,windows}.yml`.
- **CI/CD** — GitHub Actions for tests, coverage, docs site, release gates, mutation testing
- **Docs** (`docs/`) — architecture overview, configuration chain, ROADMAP shape, in-app help structure (`docs/help/_meta.yaml`), MkDocs site config
- **Tooling** — Makefile, Docker Compose (dev + prod), install scripts for all three OSes, pre-commit hooks (ruff + ruff-format + check-yaml/json), version-pin sync script

## Adapting to your project

1. **Rename** — search for `adaptive_learner` / `AdaptiveLearner` / `ADAPTIVE_LEARNER` / `adaptive-learner-` across the codebase and replace with your project's name in the same four casings.
2. **Replace domain** — start with `backend/app/models/__init__.py` (the EXAMPLE-DOMAIN docstring at the top explains the pattern), then cascade through the matching `backend/app/routers/*.py`, `frontend/src/api/client.ts` `api.<model>` namespaces, and `frontend/src/pages/*` page components.
3. **Refresh `docs/`** — `CONCEPT.md`, `ROADMAP.md`, `API.md`, `docs/help/` all carry inherited shape from Bibliogon. Adapt them to your domain.
4. **Plugin scaffolding** — when adding your first plugin, follow `plugins/README.md`. Hookspecs live in `backend/app/hookspecs.py`.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry, Alembic |
| Frontend | React 18+, TypeScript (strict), TipTap, Vite, Radix UI, @dnd-kit, Lucide, react-toastify |
| Plugins | pluginforge ^0.5.0 (PyPI), pluggy entry points |
| Launcher | PyInstaller, cross-OS (Linux + macOS + Windows) |
| Testing | pytest, Vitest, Playwright, mutmut, Stryker |
| Tooling | Poetry, npm, Docker, Make, ruff, ESLint, Prettier, pre-commit |
| Docs site | MkDocs |

See [CLAUDE.md](CLAUDE.md) for the full development guide aimed at Claude Code (and useful as human reading too). Rules live in [.claude/rules/](.claude/rules/).

## Quickstart

```bash
# One-time
make install              # Poetry + npm + plugins

# Daily
make dev                  # backend (8000) + frontend (5173) in parallel
make test                 # backend + frontend, no coverage
make test-coverage        # opt-in coverage run

# Docker
make prod                 # Docker Compose
make prod-down            # stop
```

E2E: `npx playwright test --project=smoke` or `--project=full`.

## Provenance

Scaffolded from Bibliogon v0.33.0 on 2026-05-17. All 11 plugins (`audiobook`, `export`, `getstarted`, `git-sync`, `grammar`, `help`, `kdp`, `kinderbuch`, `medium-import`, `ms-tools`, `translation`) and their coupled backend routers/services were removed in Phase 1 of the skeleton extraction. The plugin-loader infrastructure was retained intact. See `CLAUDE.md` "Origin" + `git log --oneline` for the full extraction trail.

## License

MIT — see [LICENSE](LICENSE).

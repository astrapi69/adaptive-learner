# Adaptive Learner

Projekt-Skeleton-Template, abgeleitet aus [Bibliogon](https://github.com/astrapi69/bibliogon) (einer Buch-Autorenplattform). Schlanke Grundlage für Anwendungen zum adaptiven Lernen, auf demselben Architekturmuster aufgebaut: FastAPI + SQLAlchemy + React + TypeScript + Plugin-Loader auf Basis von [PluginForge](https://github.com/astrapi69/pluginforge).

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow.svg)](LICENSE)

## Was das ist

Ein lauffähiger Full-Stack-Startpunkt. Die Plugin-Loader-Infrastruktur, die Schichten-Architektur, die Test-Disziplin, das Build/Deploy/Release-Tooling und der Python+React-Tech-Stack werden 1:1 von Bibliogon übernommen. **Die DOMÄNE liegt als EXAMPLE-DOMAIN bei**: Book, Chapter, Article, ArticleComment, Author, Asset, ... sind im Code als Arbeitsreferenz vorhanden, wie man SQLAlchemy-Modelle + Pydantic-Schemas + FastAPI-Router + React-Seiten + Tests end-to-end verdrahtet. Ersetze jede Konzeption durch deine Adaptive-Learner-Äquivalente (LearningConcept, CurriculumItem, SkillAssessment, LearnerProgress, ...), sobald die tatsächliche Projekt-Domäne feststeht.

Dateien mit einem expliziten `EXAMPLE-DOMAIN:`- oder `TEMPLATE:`-Header sind oben markiert, sodass sie per grep auffindbar sind:

```bash
grep -rn "EXAMPLE-DOMAIN\|TEMPLATE:" --include='*.py' --include='*.ts' --include='*.tsx'
```

## Was enthalten ist

- **Backend** (`backend/`) — FastAPI-App, SQLAlchemy 2.0-Modelle, Pydantic v2-Schemas, Alembic-Migrationen, Soft-Delete + Papierkorb-Lebenszyklus, schichtweise Konfig (Projekt-YAML < User-Override < Env-Vars), Test-Isolations-Tripwires, i18n für 8 Sprachen
- **Frontend** (`frontend/`) — React 18 + TypeScript (strict) + Vite + TipTap-Editor + Radix UI + react-toastify + Playwright-E2E
- **Plugin-System** (`plugins/`) — leerer Platzhalter + `plugins/README.md` mit der minimalen Plugin-Struktur. Das Skeleton liefert keine Plugins; der Loader ist verdrahtet und bereit.
- **Launcher** (`launcher/`) — plattformübergreifender PyInstaller-Desktop-Launcher (Linux + macOS + Windows) mit Auto-Update- und Uninstall-Flows. Per-OS-Build-Pipelines unter `.github/workflows/launcher-{linux,macos,windows}.yml`.
- **CI/CD** — GitHub-Actions für Tests, Coverage, Docs-Site, Release-Gates, Mutation-Testing
- **Docs** (`docs/`) — Architekturübersicht, Config-Chain, ROADMAP-Form, In-App-Help-Struktur (`docs/help/_meta.yaml`), MkDocs-Site-Config
- **Tooling** — Makefile, Docker Compose (Dev + Prod), Install-Skripte für alle drei OS, Pre-Commit-Hooks (ruff + ruff-format + check-yaml/json), Versions-Pin-Sync-Skript

## Anpassen an dein Projekt

1. **Umbenennen** — Suche im Codebase nach `adaptive_learner` / `AdaptiveLearner` / `ADAPTIVE_LEARNER` / `adaptive-learner-` und ersetze in derselben Vier-Casings mit deinem Projektnamen.
2. **Domäne ersetzen** — Beginne mit `backend/app/models/__init__.py` (das EXAMPLE-DOMAIN-Docstring oben erklärt das Muster), dann kaskadiert durch die passenden `backend/app/routers/*.py`, die `api.<model>`-Namespaces in `frontend/src/api/client.ts` und die Page-Komponenten unter `frontend/src/pages/*`.
3. **`docs/` auffrischen** — `CONCEPT.md`, `ROADMAP.md`, `API.md`, `docs/help/` tragen die aus Bibliogon übernommene Form. Adaptiere sie an deine Domäne.
4. **Plugin-Scaffolding** — beim ersten Plugin folge `plugins/README.md`. Hookspecs liegen in `backend/app/hookspecs.py`.

## Tech-Stack

| Schicht | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry, Alembic |
| Frontend | React 18+, TypeScript (strict), TipTap, Vite, Radix UI, @dnd-kit, Lucide, react-toastify |
| Plugins | pluginforge ^0.5.0 (PyPI), pluggy-Entry-Points |
| Launcher | PyInstaller, plattformübergreifend (Linux + macOS + Windows) |
| Tests | pytest, Vitest, Playwright, mutmut, Stryker |
| Tooling | Poetry, npm, Docker, Make, ruff, ESLint, Prettier, pre-commit |
| Docs-Site | MkDocs |

Siehe [CLAUDE.md](CLAUDE.md) für den vollständigen Entwicklungs-Guide für Claude Code (und als Lektüre für Menschen nützlich). Regeln liegen unter [.claude/rules/](.claude/rules/).

## Schnellstart

```bash
# Einmalig
make install              # Poetry + npm + Plugins

# Täglich
make dev                  # Backend (8000) + Frontend (5173) parallel
make test                 # Backend + Frontend, ohne Coverage
make test-coverage        # Opt-in-Coverage-Lauf

# Docker
make prod                 # Docker Compose
make prod-down            # stoppen
```

E2E: `npx playwright test --project=smoke` oder `--project=full`.

## Herkunft

Aus Bibliogon v0.33.0 gescaffolded am 2026-05-17. Alle 11 Plugins (`audiobook`, `export`, `getstarted`, `git-sync`, `grammar`, `help`, `kdp`, `kinderbuch`, `medium-import`, `ms-tools`, `translation`) und ihr daran gekoppelter Backend-Code wurden in Phase 1 der Skeleton-Extraktion entfernt. Die Plugin-Loader-Infrastruktur ist unangetastet. Siehe Abschnitt "Origin" in `CLAUDE.md` und `git log --oneline` für den vollständigen Extraktionsverlauf.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

# Adaptive Learner

Adaptive learning platform implementing the six-method learning model.
Repository: https://github.com/astrapi69/adaptive-learner
Version: see backend/pyproject.toml (canonical source)
Changelog: changelog/releases/vX.Y.Z.md per release

## Tech Stack
Backend: Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2, Poetry
Frontend: React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS 4, shadcn/ui, Bun
Testing: pytest, Vitest, Playwright
Tooling: Docker, Make, ruff, ESLint, pre-commit
Plugin framework: pluginforge ^0.10.0 (external PyPI package)

## Architecture (4 layers)
Frontend -> Backend -> PluginForge -> Plugins
Dual storage: ApiStorage (default, SQLite) + DexieStorage (IndexedDB, GitHub Pages)
Key resolution: env > ~/.config/adaptive_learner/secrets.yaml > Fernet-encrypted DB
Plugin structure: plugins/adaptive-learner-plugin-{name}/ with plugin.py, routes.py, service modules
Full reference: .claude/rules/architecture.md

## Rules (.claude/rules/)
| File | Scope | Content |
|---|---|---|
| ai-workflow/github-issue-policy.md | always | GITHUB-ISSUE-PFLICHT, issue lifecycle, sub-issue closing, issue queue |
| ai-workflow/pr-policy.md | always | PR-PFLICHT: every pushed change opens a PR |
| ai-workflow/testplan-policy.md | always | TESTPLAN-PFLICHT: user-visible changes update the manual test plan |
| ai-workflow/implementation-workflow.md | always | Session start, order for features/plugins/changes, not-allowed list |
| ai-workflow/documentation-protocol.md | always | Journal, doc updates, archival, numeric-claims verification |
| ai-workflow/test-coverage-audits.md | tests | When/how to run coverage audits, where coverage runs |
| architecture.md | backend/plugins/frontend/docs | 4-layer architecture, plugin structure, UI strategy, dual storage |
| coding-standards.md | backend/plugins/frontend | Naming, formatting, Git, function design, tests, security |
| code-hygiene.md | backend/plugins/frontend | Linting, error handling architecture, API conventions, logging |
| design-tokens.md | frontend CSS/TSX | CSS variables, no hardcoded colors, theme enforcement |
| lessons-learned.md + lessons/*.md | always | Pitfall catalogue: index + 7 themed files (core, backend, frontend, content-storage, ci-gates, release-packaging, docs-i18n) |
| quality-checks.md | tests | Test strategy, coverage targets, mutation testing |
| release-workflow.md | on release | 11-step release process |
| reusability.md | backend/plugins/frontend | Props-driven, barrel exports, implementation hierarchy |
| tdd.md | tests | Red-Green-Refactor workflow, four-test guideline |
| vibe-coding.md | always | Release freeze, no-amend-on-open-PR, priority order |

## Makefile Targets
- make test: fast smoke test (backend + plugins + Vitest)
- make test-coverage: full coverage (opt-in, heavy)
- make sync-versions: propagate backend/pyproject.toml to 19 version-bearing files
- make sync-i18n: regenerate frontend i18n JSON from backend YAML
- make archive-task: archive completed ROADMAP tasks to docs/roadmap-archive/
- make release-test: full release gate (includes dexie-smoke)
- make verify-docs-discipline: docs drift verifier

## Session Start
1. git log --oneline -10
2. make test (establish green baseline)
3. Read this file + relevant .claude/rules/ per task

## Data Model
30 SQLAlchemy models in backend/app/models/__init__.py:
User, UserSettings, ApiKeyBackup, LearningProject, LearningProfile,
Curriculum, LearningTopic, Lesson, LearningSession, SessionMessage,
SessionRating, SessionNote, ProgressCommit, StepEvaluation, MethodSwitch,
ImportedConversation, ImportedMessage, Subject, Tag, ProjectSubject,
ProjectTag, UserXP, Badge, UserBadge, UserStreak, AnkiCardSuggestion,
StudyQuestion, LessonProgress, ElementError, UserMission
Full spec: docs/adaptive-learner-project-reference.md

## Plugins (13 shipped)
| Plugin | Tier | Purpose |
|---|---|---|
| assessment | 1 | 12 questions, 6-method weights |
| session | 1 | 7-step cycles, streaming, auto-loop |
| tracking | 1 | ProgressCommit writer |
| tools | 1 | Method recommendations |
| gamification | 2 | XP/badges/streak |
| content-loader | 2 | Download lesson sets from GitHub repos |
| anki | 2 | AI-extracted flashcards + .apkg export |
| notebooklm | 2 | Study guide generation |
| learning-repo | 2 | Git-backed Markdown artifacts |
| missions | 2 | Daily adaptive missions |
| ai-anthropic | 3 | Claude provider |
| ai-openai | 3 | GPT provider |
| ai-gemini | 3 | Gemini provider |

## Directory Structure (top level)
adaptive-learner/
backend/app/           FastAPI app, routers, services, models
backend/config/        app.yaml + i18n/ (11 catalogs)
plugins/               13 plugin packages
frontend/src/          React app, storage, components, styles
e2e/smoke/             Playwright smoke specs
launcher/              PyInstaller cross-OS launcher
docs/                  audits, help, configuration
changelog/releases/    per-release notes vX.Y.Z.md
scripts/               sync_versions, sync_i18n, verify_docs, ...

## Core Conventions
- Conventional Commits: feat:, fix:, refactor:, docs:, test:, chore:
- Gitflow: develop is active branch, main holds releases only
- PR-PFLICHT: every pushed code change opens a PR (always, not on request)
- GITHUB-ISSUE-PFLICHT: every bug/fix needs an issue first
- TESTPLAN-PFLICHT: user-visible changes update manual test plan (DE + EN)
- Services throw AdaptiveLearnerError, NEVER HTTPException
- No hardcoded colors, use design tokens (var(--token))
- Type hints ALWAYS (Python), strict mode (TypeScript)
- make test must stay green after every change
- No --amend + force-push on open PRs

## Tests
v2.6.1 baseline: backend 1475 + plugins 1096 + Vitest 7722 = 10293 tests
E2E: cd e2e && npx playwright test (separate from make test)
Dexie-mode gate: make test-dexie-smoke (aggregated in make release-test)
Current counts: docs/audits/current-coverage.md (canonical, do not duplicate)

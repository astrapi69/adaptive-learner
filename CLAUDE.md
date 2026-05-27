# Adaptive Learner

Adaptive learning platform implementing the six-method learning
model (Asterios Raptis, *Von Theorie zur Praxis*, Medium series).
A complete, plugin-driven application: assessment, 7-step learning
sessions across 6 methods, streaming AI replies via 3 providers,
chat-history import + analysis, multi-cycle auto-loop, dual storage
(SQLite + browser IndexedDB), local-network sync, file-based key
configuration, gamification, voice, Anki + NotebookLM exports, PWA.

- **Repository:** https://github.com/astrapi69/adaptive-learner
- **Current state:** **v1.31.0** (Phase 46 sub-phases E-F-G
  — Gamification Integration + LessonProgress↔LearningSession
  Unification + Docs, EXP-007 / P-129). Closes Phase 46.
  Content lesson completions now feed the existing XP / streak /
  badge / ProgressCommit machinery **transparently**: a per-user
  "Content Lessons" pseudo-project (``LearningProject.kind=
  "content"``, lazy-created on first completion, Alembic 0020)
  owns a ``LearningSession`` row with the new
  ``method="content"`` 7th-value for every lesson completed.
  The existing ``on_session_complete`` pluggy hook fires —
  zero new hookspec. Gamification plugin dispatches on method:
  ``"content"`` routes to the new lesson-XP formula (30 base
  + 10/star + 20 first-attempt 3-star, same +25%/day streak
  multiplier capped at 7); other methods stay on the chat
  formula. Four new badges seed under the existing catalog
  (``first_lesson``, ``lessons_10``, ``three_star_streak``,
  ``review_master``); catalog count 24 → 28. Frontend hides
  the pseudo-project from every project picker
  (``DashboardFilterBar`` + ``ExportSection`` + ``Anki`` via
  the new ``filterStandardProjects`` helper). New user-guide
  page ``lessons.md`` + developer page ``lessons-and-srs.md``,
  both EN+DE, native umlauts. Dexie-mode lessons still work
  end-to-end for the review loop; the XP / badge side effects
  are API-mode-only by deliberate scope (deferred to a future
  release that ports the rule to the storage abstraction).
  v1.30.0 = Phase 46 A-D — Element-Level Error Tracking +
  SRS Review Sessions, EXP-007 / P-129 (every wrong answer
  writes a per-element ``ElementError`` row keyed by the
  specific word / pair / phrase missed; mastery flips at 3
  consecutive correct, demotes on wrong; new SRS scheduler
  with 1d/3d/7d bands; new ``/review/:setId`` route +
  Dashboard ``<ReviewQueueCard>`` widget; Alembic 0019 +
  Dexie schema v18 + ``IStorageService.elementErrors``
  namespace; expanded LessonSummary with 0-3 star rating).
  v1.29.0 = Phase 45 — Free-Text + Word-Tiles Exercises,
  EXP-002 Sprint 3 parts E-F (the v1.28.0 viewer now ships
  every exercise type the v1.0 lesson schema knows about;
  no backend / schema changes).
  v1.28.0 = Phase 44 — Lesson Viewer + Matching +
  Picture-Choice exercises, EXP-002 Sprint 3 parts A-D
  (new route ``/lesson/:setSlug/:setId/:filename``, the
  first two exercise renderers, new ``LessonProgress``
  model + Alembic 0018 + Dexie schema v17 + the
  ``IStorageService.lessonProgress`` namespace).
  v1.27.0 = Phase 43 — Content-Loader Plugin, EXP-002 +
  EXP-005 foundations). The app stops
  requiring an API key for the headline use case: the new
  ``/content`` page downloads pre-built lesson sets from
  public GitHub repos and caches them locally
  (filesystem in API mode, IndexedDB in Dexie/GH-Pages
  mode). The new ``adaptive-learner-plugin-content-loader``
  ships with a typed Pydantic v2 lesson schema v1.0
  (Lesson / LessonStep / Exercise / Card / ExerciseType
  enum), a manifest parser with forward-compat
  schema-version gating, a tokenless GitHub raw-URL
  adapter (optional token via three-layer secrets chain),
  an atomic version-reconciled cache, and FastAPI routes
  under ``/api/plugins/content-loader/*``. Frontend ships
  a new ``contentLoader`` namespace on ``IStorageService``,
  Dexie schema v16 with two new tables (``contentSets`` +
  ``contentSetFiles``), and the Set Browser page at
  ``/content``. App-mode badge in the nav (driven by
  ``useApiKeyStatus``) renders "AI+Content" vs "Content"
  so the user always knows which features are available.
  Pilot French A1 set (2 lessons / 14 cards / 9 exercises
  across all four ExerciseType variants) lives at
  ``docs/explorations/sample-content/fr-a1/``, ready to
  copy into the future
  ``astrapi69/adaptive-learner-content`` repo. v1.26.1
  (patch): closes the Phase 42 Dexie-mode crash (the
  ``LearningRepoSettings`` / ``LearningRepo`` page /
  Dashboard widget called ``api.*`` unconditionally and
  blew up on the GitHub Pages deployment with HTTP 404
  for every visitor). Three protection layers ship
  alongside the immediate fix: (1) **Developer Mode**
  toggle in Settings > Interface — off by default, when
  on shows full HTTP status / endpoint / stack in error
  toasts and a red DEV badge in the nav; (2) **friendly
  error mapping** so production users never see "HTTP
  404" / endpoint paths / stack traces — every
  ``ApiError`` now maps to a ``ui.errors.*`` i18n string,
  with eventRecorder still capturing full technical
  detail for the "Report Issue" GitHub-issue body; (3)
  **Dexie-mode release gate** (``make test-dexie-smoke``)
  — Playwright walks every nav-reachable route against a
  ``VITE_STORAGE_MODE=dexie`` build with no backend, any
  error toast or page crash blocks the tag. Aggregated
  into ``make release-test`` as MANDATORY. Bundle-size
  win as a side effect: route-level ``React.lazy()``
  drops the main chunk 2,137 kB → 838 kB and clears the
  Workbox 2 MB precache cap workaround. v1.26.0 = Phase
  42 (Git-Backed Learning Repository, BL-30): new
  ``learning-repo`` plugin emits per-project Markdown
  artefacts (README, LEARNING_STATS, CHEATSHEET, ROADMAP
  + numbered topic folders) from existing DB state via
  three endpoints — ``GET /api/plugins/learning-repo/render/{project_id}``
  (JSON), ``POST .../export-zip/{project_id}`` (ZIP), and
  opt-in ``POST .../persist/{project_id}`` which writes
  the tree to
  ``~/.local/share/adaptive_learner/repos/{project_id}/``
  and runs ``git commit`` with a semantic subject
  ("Cycle N — U X/10, T Y/10"). Tags
  ``cycle-{N}-mastered`` when the Article-1 § 8 exit
  threshold is met. Core endpoint
  ``/api/plugin-settings/{plugin_name}`` (GET + PATCH)
  backstops the architecture-rule "every non-INTERNAL
  setting MUST be UI-editable". v1.25.0 = Phase 41
  identity persistence + Danger Zone. See
  [changelog/releases/v1.31.0.md](changelog/releases/v1.31.0.md)
  for the per-release detail and `git log --oneline` for
  the feature history across Phases 1–42.
- **API reference:** FastAPI OpenAPI at `/api/docs` + `/openapi.json`
- **Configuration:** [docs/configuration.md](docs/configuration.md)
  (three-layer chain: env > `~/.config/adaptive_learner/secrets.yaml`
  > Fernet-encrypted DB column).
- **User + developer docs:** MkDocs site under `docs/help/{en,de}/`.

## Development guidelines

Detailed rules in `.claude/rules/`:

**Always relevant:**
- `architecture.md` — layered architecture, plugin structure, UI
- `coding-standards.md` — naming, function design, tests, deps

**On demand:**
- `code-hygiene.md` — linting, error handling, API conventions
- `lessons-learned.md` — known pitfalls
- `quality-checks.md` — test strategy, pre-commit checklists
- `ai-workflow.md` — feature/plugin order, docs protocol
- `release-workflow.md` — `make sync-versions` chain, tag pattern

On a conflict between this file and the rules, **the rules win**.

## Tech stack

- **Backend:** Python 3.11+, FastAPI ^0.136, SQLAlchemy ^2.0,
  Pydantic v2, Alembic, aiosqlite, cryptography (Fernet),
  platformdirs, pluginforge ^0.10.0, Poetry
- **Frontend:** React 19, TypeScript 6 (strict), Vite 8,
  Vitest 4, react-router-dom 7, react-toastify, Recharts 3,
  TipTap 2 (StarterKit + 15 extensions), Dexie 4 (IndexedDB),
  html5-qrcode, sql.js + jszip (Anki .apkg)
- **PWA:** vite-plugin-pwa, Workbox SW (NetworkFirst on GET
  `/api/`), SVG + maskable PNG icons
- **Testing:** pytest ^9, Vitest 4 (happy-dom), Playwright (E2E)
- **Tooling:** Poetry, npm, Docker, Make, ruff, pre-commit
- **Node engine:** ≥24.0.0

## Architecture (short)

4 layers: Frontend → Backend → PluginForge → Plugins. Backend
exposes core (users / projects / settings with `key_source_*` /
backup / export / sync / system) + plugin routes (assessment /
session with streaming + pronunciation / tracking / tools /
imports / curriculum / lessons / anki / gamification /
notebooklm). Frontend renders 13 routes via React Router:
Landing, Onboarding, Assessment, Dashboard, Session, Curriculum,
Progress, Settings, Import, ImportDetail, Anki, Pronunciation,
NotFound.

**Dual storage** (since v0.7.0): `IStorageService` interface with
two implementations. `ApiStorage` talks to the FastAPI backend
(default); `DexieStorage` keeps everything in browser IndexedDB
with browser-direct AI provider calls. Settings toggle picks the
mode at startup (reload required to switch).

**Key resolution** (since v1.20.0 / Phase 34): every AI call
walks env > `~/.config/adaptive_learner/secrets.yaml` >
Fernet-encrypted DB column > none. Settings UI shows the per-
provider source ("Key from: secrets.yaml" / "environment" /
"Settings") and disables the input when externally managed.

## Commands

```bash
make install          # Poetry + npm + plugins
make dev              # backend (18001) + frontend (15174)
make dev-bg / dev-down
make test             # backend + plugins + Vitest (no coverage)
make test-backend     # pytest backend only
make test-plugins     # all 11 plugin test suites
make test-frontend    # Vitest only
make test-coverage    # opt-in coverage (CI runs the equivalent)
make prod / prod-down # Docker Compose
make clean / help
make sync-versions    # propagate backend/pyproject.toml to all 18 version-bearing files
make sync-i18n        # regenerate frontend/src/data/i18n/*.json from backend YAML
make docs-serve / docs-build  # MkDocs site (port 8000)
make archive-task     # interactive: move closed backlog items to roadmap-archive/YYYY-MM.md
```

E2E tests: `cd e2e && npx playwright test` (NOT on the `make test`
default path).

## Session start (Claude Code)

1. `git log --oneline -10` — recent changes
2. `make test` — green baseline
3. Read this file + relevant `.claude/rules/` per the task

## Data model

**28 SQLAlchemy models** in `backend/app/models/__init__.py`:

User, UserSettings, LearningProject, LearningProfile,
Curriculum, LearningTopic, Lesson, LearningSession,
SessionMessage, SessionRating, SessionNote, ProgressCommit,
StepEvaluation, MethodSwitch, ImportedConversation,
ImportedMessage, Subject, Tag, ProjectSubject, ProjectTag,
UserXP, Badge, UserBadge, UserStreak, AnkiCardSuggestion,
StudyQuestion, LessonProgress, ElementError.

Mirrored Pydantic v2 schemas in `backend/app/schemas/`. Sync
surface: 30 tables. Full spec in
[docs/adaptive-learner-project-reference.md](docs/adaptive-learner-project-reference.md).

## Plugins (12 shipped)

All under `plugins/`. Routes mounted at `/api/plugins/<name>/*`.

| Plugin | Routes | Purpose |
|---|---|---|
| ai-anthropic | hook-only | `ai_complete*` provider for `claude-*` |
| ai-openai | hook-only | `ai_complete*` provider for `gpt-*` |
| ai-gemini | hook-only | `ai_complete*` provider for `gemini-*` |
| assessment | /questions, /evaluate, /profile/{id} | 12 questions, 6-method weights |
| session | /start, /{id}/message, /message/stream, /rate, /end, switch, /pronunciation/* | 7-step cycles, dual-prompt eval, streaming, auto-loop |
| tracking | /progress/{id}, /commits/{id} | ProgressCommit writer + dashboard aggregator |
| tools | /recommendations/{id}, /spaced/{id} | Method-tailored tool list + spaced practice |
| gamification | /xp/*, /badges/*, /streak/*, /reset | XP/level, badge catalog, streak heatmap |
| anki | /cards CRUD, /extract/{session,conversation}, /mark-exported | AI-extracted flashcards + .apkg export |
| notebooklm | /questions CRUD, /generate/{session,project}, /study-guide/{id} | Active-recall questions + study guide + ZIP export |
| learning-repo | /render/{id}, /export-zip/{id}, /persist/{id} | Article-3 Git-backed Learning Repository (Markdown artefacts + opt-in `git commit` + `cycle-N-mastered` tags) |
| content-loader | /sets, /sets/{src}/{id}/download, /sets/{src}/{id}/lessons[/{filename}] | EXP-002 — downloads structured lesson sets from public GitHub repos, caches locally (FS + Dexie). Foundation of the v1.27.0 no-API-key path. |

All 10 hooks live in `backend/app/hookspecs.py`:
`get_assessment_questions`, `calculate_profile`,
`create_session_prompt`, `ai_complete` (sync, firstresult),
`ai_complete_async` (v1.5.0+), `ai_complete_stream` (v1.6.0+),
`recommend_method_switch`, `on_session_complete`,
`get_progress_summary`, `get_tool_recommendations`.

## Directory structure (top level)

```
adaptive-learner/
├── backend/app/           FastAPI app, routers, services, models, hookspecs
├── backend/config/        app.yaml + i18n/ (8 catalogs)
├── backend/tests/         pytest backend suite
├── plugins/               11 plugin packages
├── frontend/src/          api/, chat_import/, components/, hooks/, lib/,
│                          pages/ (13 routes), storage/ (IStorageService +
│                          ApiStorage + DexieStorage, 22 namespaces),
│                          data/ (Dexie bundles), types/, styles/
├── e2e/smoke/             Playwright smoke specs (16 spec files)
├── launcher/              PyInstaller cross-OS launcher
├── docs/                  audits/, manual-tests/, help/ (MkDocs DE+EN), configuration.md
├── changelog/releases/    per-release notes vX.Y.Z.md
├── scripts/               sync_versions, sync_i18n, anonymize_chat_export, ...
└── Makefile, docker-compose.yml, install.sh, install.ps1
```

## Core conventions

- i18n catalogs: `backend/config/i18n/{lang}.yaml` for 8 langs
  (DE, EN, ES, FR, EL, PT, TR, JA), all fully translated.
  `make sync-i18n` mirrors to `frontend/src/data/i18n/*.json`.
- German content uses **real umlauts** (ä, ö, ü, ß) in
  `de.yaml`, `docs/help/de/**`, plugin German content. ASCII
  in code identifiers + filenames. See lessons-learned.md.
- Python: type hints, snake_case, Pydantic v2, SQLAlchemy 2.0
  mapped columns.
- TypeScript: strict mode, no `any` without comment.
- CSS: custom properties, dark mode via `[data-theme="dark"]`,
  5 themes × light/dark.
- Commits: English, conventional (feat/fix/refactor/docs).
- E2E: `data-testid` selectors only.
- **Secrets**: never in committed config. Three-layer chain:
  env > `~/.config/adaptive_learner/secrets.yaml` > Fernet-
  encrypted DB. App fails hard if `ADAPTIVE_LEARNER_SECRET_KEY`
  is unset (no silent generated default).

## Tests

- `make test` must stay green after every change.
- **v1.31.0 baseline:** backend 1004 (+1 skipped) + plugins
  838 + Vitest 1755 = **3597 tests** (+1 skipped). E2E
  smoke (17 spec files) runs separately via
  `cd e2e && npx playwright test`. **Dexie-mode release
  gate** (18 specs incl. /content + /lesson + /review)
  runs via `make test-dexie-smoke`; aggregated into
  `make release-test` so a red gate blocks the tag.

## Test isolation

Two layers in `backend/tests/conftest.py`:

1. `ADAPTIVE_LEARNER_TEST=1` + tmp `ADAPTIVE_LEARNER_DATA_DIR` set
   BEFORE any `app.*` import; SQLite in-memory.
2. Production data dirs carry a `.adaptive-learner-production`
   marker. If a test sees it, the run aborts (`returncode=2`).

Use the `app.paths` helpers (`get_data_dir`, `get_config_dir`,
etc.); CWD-relative `Path("...")` and frozen module-level path
imports are forbidden.

## Pre-commit hooks

`cd backend && poetry run pre-commit install`. Hooks: standard
whitespace + YAML/JSON checks, ruff (`--fix` + format),
`roadmap-archive-reminder` (non-blocking), and
`plugin-lock-paired-with-pyproject` (blocks staged plugin
pyproject changes without a paired `poetry.lock`).

## Related projects

- [pluginforge](https://github.com/astrapi69/pluginforge) — plugin framework (PyPI)
- [bibliogon](https://github.com/astrapi69/bibliogon) — upstream book-authoring application; adaptive-learner inherited its plugin infrastructure + test discipline + launcher shape, then diverged on domain entirely

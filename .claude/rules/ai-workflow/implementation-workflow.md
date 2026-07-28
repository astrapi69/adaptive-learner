---
description: Implementation order for features, plugins, and changes
globs:
  - backend/**/*.py
  - plugins/**/*.py
  - frontend/src/**/*
alwaysApply: false
---

# Implementation Workflow

## Session start

On the first message of a session:

1. Read docs/ROADMAP.md (current state, open items).
2. Review recent changes: `git log --oneline -10`
3. Run `make test` (establish a green baseline).
4. Only then start on the task.

## Interpreting "continue" / "next item"

When the user says "continue", "next item", "go on" or similar:

1. Read docs/ROADMAP.md, section "Next steps".
2. Name the first open item (unchecked checkbox).
3. Wait for confirmation, do NOT start implementing immediately.

## Order for new features

1. Check whether the feature belongs in a plugin or in the core.
2. Look at existing patterns (e.g. how plugin-export is structured).
3. Schema/model first (Pydantic schema or TypeScript interface).
4. Backend logic (service module, then route).
5. Frontend (extend API client, then UI).
6. Write unit and integration tests (pytest, Vitest).
7. Playwright smoke tests for UI features: for every new UI feature write at least one spec under `e2e/smoke/`. Must cover: happy path, relevant viewport sizes (600/800/1080 for layout-critical features), data-testid selectors (no brittle CSS selectors). Claude Code WRITES the specs, Aster RUNS them. No feature counts as done without a smoke test.
8. Add i18n strings in all 8 languages (DE, EN, ES, FR, EL, PT, TR, JA).
9. Conventional commit.
10. Push the branch and open a PR against `develop` (PR-PFLICHT) — always, not only when asked.

## Order for new plugins

1. Create the plugin folder: `plugins/adaptive-learner-plugin-{name}/`
2. `pyproject.toml` with entry point: `[project.entry-points."adaptive_learner.plugins"]`
3. Plugin class: `{Name}Plugin(BasePlugin)` with name, version, depends_on.
4. YAML config: `backend/config/plugins/{name}.yaml`
5. Hook implementations (if needed, new hook specs in hookspecs.py).
6. `routes.py` for API endpoints.
7. Frontend manifest via `get_frontend_manifest()` (UI slots).
8. Tests in `plugins/{name}/tests/`.
9. Enable the plugin in `config/app.yaml` under `enabled`.

## Order for changes

1. Read and understand the existing tests.
2. Implement the change.
3. Adjust or extend the tests.
4. Make sure `make test` stays green.
5. Commit, push, and open a PR against `develop` (PR-PFLICHT) — always, not only when asked.

## Not allowed (AI-specific)

For code-level prohibitions (fetch, console.log, Tailwind, etc.) see coding-standards.md and architecture.md.

Additionally for the AI:

- Introduce new dependencies without asking first.
- Change architectural decisions (e.g. replace SQLAlchemy, replace TipTap).
- Change PluginForge code from inside AdaptiveLearner (separate repo!).
- Change the plugin structure (BasePlugin, hook specs) without asking.
- Generate code "for later". Only what is needed now.
- Delete, comment out or weaken existing tests to make `make test` green.
- Build custom TipTap extensions without first checking whether an official one exists.
- Throw HTTPException from service functions. Services use AdaptiveLearnerError subclasses (see code-hygiene.md).
- In autonomous mode, guess when something is unclear. Prefer to stop and document the uncertainty.

## Current state

See architecture.md for architectural details. Additionally note:

- Current version: see `backend/pyproject.toml` (canonical) — every other version-bearing file derives via `make sync-versions`.
- Tests: see `docs/audits/current-coverage.md` for current counts. `make test` covers backend+plugins+Vitest, E2E is separate.
- 30 SQLAlchemy models in `backend/app/models/__init__.py` (single-file domain model).
- 13 plugins shipped (assessment, session, tracking, tools, gamification, anki, notebooklm, learning-repo, content-loader, missions, ai-anthropic, ai-openai, ai-gemini).
- 15 official TipTap extensions + 1 community (@pentestpad/tiptap-extension-figure) — used for rich-text in session notes, curriculum descriptions, and lesson content.
- Deployment: Docker Compose, port 18001 (backend) + 15174 (frontend dev), install.sh one-liner. GitHub-Pages-shape build runs Dexie-mode at `https://astrapi69.github.io/adaptive-learner/`.
- IMPORTANT: Before writing custom code, ALWAYS check whether a TipTap extension or library already exists.
- IMPORTANT: See lessons-learned.md (index) and lessons/*.md for known pitfalls.

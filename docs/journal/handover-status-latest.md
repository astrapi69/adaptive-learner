# Handover / Status Report

_Last updated: 2026-06-14. Overwritten on each status pass — this file is always the latest snapshot._

## 1. HEAD + version

- **Release:** **v1.79.0 SHIPPED** (minor — canonical `backend/pyproject.toml` = `1.79.0`).
  Tag `v1.79.0` on `main`, GitHub Release published, merged back to `develop`.
- **Branch:** `develop` is the active branch (gitflow #334); `main` holds the
  v1.79.0 release tag. Release branch deleted.
- **Previous release:** v1.78.0 (maintenance / code-hygiene — complexity
  burn-down + governance + flaky-test fixes).
- **Async CI on the tag/push:** launcher builds (Linux/macOS/Windows) on the
  `v1.79.0` tag + GH-Pages deploy on develop were triggered at release time;
  these complete on their own and do not gate the release.

## 2. Test counts (re-collected 2026-06-14)

| Suite | Count | How collected |
|---|---|---|
| Backend (pytest) | **1215** | `cd backend && poetry run pytest --collect-only -q` |
| Plugins (13 suites, pytest) | **1018** | per-plugin `pytest --collect-only` from the backend env |
| Frontend (Vitest) | **4080 passed** | `cd frontend && npx vitest run` (353 files, all green) |
| **Total** | **6313** | — |

Per-plugin: ai-anthropic 35, ai-gemini 34, ai-openai 32, anki 20, assessment 110,
content-loader 270, gamification 55, learning-repo 53, missions 41, notebooklm 27,
session 219, tools 58, tracking 64.

TypeScript `tsc --noEmit` clean; ESLint clean; Dexie-mode Playwright gate 88 passed.
Full Playwright smoke runs separately (Aster runs E2E).

## 3. v1.79.0 contents (commits since v1.78.0, 31 total)

- **Features:**
  - **XP visibility (#505 / PR #510)** — persistent header badge (`NavXpBadge`,
    both storage modes, live on route/focus/celebration) + `+N XP`
    lesson-summary reward pill (same parity-tested formula as the award path) +
    a new generic props-driven `shared/XpBadge`. i18n in 8 languages.
  - **Bidirectional matching selection (#507 / PR #509)** — a pair can be
    started from the B (right) column, not only A → B.
- **Fixed:** **P1** — matching scored by tile index, not value, breaking
  duplicate-pair exercises (#480 / PR #481).
- **Changed:**
  - **Complexity burn-down complete** — `validateGeneratedLesson` the final
    offender (#497); last baseline entries dropped (#498–#504);
    `.complexity-baseline` empty.
  - **Radon hard gate Phase 2** — blocks cc > 20, warns > 15 (#494 / PR #495).
  - **Plugin-tests CI job** — runs `make test-plugins` (the 1018-test suite),
    Goal A of #434 (#471).
  - **Reusability policy + shared primitives** — `.claude/rules/reusability.md`
    (#474 / PR #477); extracted `ListRow` (#460), `ProgressBar` (#462),
    `LessonStepNav` (#476), `XpBadge` (#510).

No schema / API / data-model change.

## 4. Reusable `shared/` primitives (reusability policy, #477)

`frontend/src/shared/` now holds app-agnostic, props-driven, no-app-import
components: `XpBadge`, `ListRow`, `ProgressBar`, `LessonStepNav`,
`MenuToggleButton`. New shared candidates follow `.claude/rules/reusability.md`.

## 5. Open follow-ups / known state

- **#434 (P3):** re-enable the per-plugin CI test matrix (13 plugins) — the
  `ci.yml` / `coverage.yml` matrices are skeleton (`if: false`); plugin tests run
  via the new dedicated job (#471) and locally through `make test-plugins`.
- **Dashboard XPWidget** left intact (already shows total + level + progress);
  no level/trend extension was needed for #505.
- **EXP-025 / EXP-026** design explorations shipped in v1.78.0 (author-provided
  lesson sets / user lessons in the content tree) remain design-only.
- **Doc version refs** (README + README-de badges, ROADMAP + backlog headers)
  are NOT auto-synced by `make sync-versions` — update by hand each release (the
  `verify-docs-discipline` gate catches drift).

## 6. Process notes carried forward

- **`prettier-frontend` pre-commit hook** is misconfigured (reformats whole
  files to a 2-space style nothing uses; CI skips it). Commit `frontend/src`
  changes with `SKIP=prettier-frontend`.
- **`plugin-lock-paired-with-pyproject` hook** flags version-only plugin
  pyproject bumps; release-prep commits skip it
  (`SKIP=plugin-lock-paired-with-pyproject`) since a version line needs no
  lockfile change.
- **GitHub GraphQL quota** was exhausted during this session; `gh release create`
  uses GraphQL — fall back to the REST releases endpoint
  (`gh api repos/.../releases`) when it 403s; REST core quota was healthy.

# Handover / Status Report

_Last updated: 2026-06-17. Overwritten on each status pass — this file is always the latest snapshot._

## 1. HEAD + version

- **Release:** **v1.84.0 SHIPPED** (maintenance — a P1 content-repo import
  hardening, three P2 fixes, a user-repo E2E test, and the EXP-031 backup-format
  exploration; canonical `backend/pyproject.toml` = `1.84.0`). Tag `v1.84.0` on
  `main` (`8cd73eb8 Release v1.84.0`, annotated tag object `e3df3fce`), GitHub
  Release published, merged back to `develop` (`4b28765b`). Local release branch
  deleted (the remote one never existed — created local-only via
  `release-prepare`, so the final remote-delete step no-op'd; harmless — same
  pattern as v1.82.0 / v1.83.0).
- **Branch:** `develop` is the active branch (gitflow #334); `main` holds the
  v1.84.0 release tag.
- **Previous release:** v1.83.0 (maintenance + gap-hardening — a P1 review-session
  fix, two P2 theory-rendering fixes, and a six-item gap-hardening audit).
- **Schema:** **v1.84.0 has NO schema/API/data change** (no new Alembic, no Dexie
  bump). The last migrations are still **0030** + **0031** from v1.82.0
  (element_errors hint columns + attempt history); if you pull from before
  v1.82.0, delete `~/.local/share/adaptive_learner/adaptive_learner.db` before the
  next `make test` (see lessons-learned "Alembic migration + fresh test DB").
- **Release note (false-positive hook):** the version-only bump of the 13 plugin
  pyprojects trips `plugin-lock-paired-with-pyproject`, which is a false positive
  for release bumps (a version field change does not alter poetry's
  dependency-based lock hash, so per-plugin CI stays green; v1.83.0 likewise
  bumped plugin pyprojects with zero lock changes). The release commit skipped
  only that one hook (`SKIP=plugin-lock-paired-with-pyproject`).
- **Async CI on the tag/push:** launcher builds (Linux/macOS/Windows) on the
  `v1.84.0` tag + GH-Pages deploy on develop/main were triggered at release time;
  these complete on their own and do not gate the release. **Verify the GH-Pages
  deploy went live** (the v1.71.x cycle saw a silent `actions/deploy-pages` 401).

## 2. Test counts (v1.79.0 baseline — re-collect for v1.83.0)

| Suite | Count | How collected |
|---|---|---|
| Backend (pytest) | **~1237** (v1.82.0 CI) | `cd backend && poetry run pytest --collect-only -q` |
| Plugins (13 suites, pytest) | **1018+** | per-plugin `pytest --collect-only` from the backend env |
| Frontend (Vitest) | **4603 passed** (v1.84.0 gate, 427 files) | `cd frontend && npx vitest run` |
| E2E dexie-smoke | **88 passed** | `make test-dexie-smoke` |
| E2E manual-automation (#621) | **49 automated** (+15 skip = manual-only) | `make test-manual-automation` (nightly + release) |

The `make release-test` gate is green for v1.83.0 (Vitest 4538, docs 0 FAIL,
dexie-smoke 88, manual-automation 49). The backend/plugin counts are
last-precise at the v1.79.0 baseline; v1.81.0 added many
feature + component tests on top — the gamification dashboard-API tests
(`test_gamification_dashboard_api.py`), the statistics / SRS / hints / favorites /
review / offline / shortcuts / username feature tests, the avatar-crop tests, and
a large new `shared/` component suite. The full **`make release-test` gate is
green** (incl. **dexie-smoke 87 passed**, the gate that caught and verified the
mid-lesson-motivation-toast fix below). Re-collect exact counts via the commands
above. TypeScript `tsc --noEmit` clean; ESLint clean; full Playwright smoke runs
separately (Aster runs E2E).

## 3. v1.84.0 contents (commits since v1.83.0)

Full detail in `changelog/releases/v1.84.0.md`. 4 substantive PRs + an E2E test
+ a docs exploration, no schema/API/data change:

- **#645 (P1)** content-repo import — CORS-safe import + retry policy + progress
  indicator + dialog accessibility (Refs #646).
- **#647 (P2)** inline Markdown rendered in exercise prompts + labels (Refs #648).
- **#639 (P2)** clickable Settings profile picture with a preview/change dialog.
- **#643 / #641 (P2)** backup import declines a non-Adaptive-Learner JSON file
  gracefully with a friendly message (Refs #642, #640).
- **#637** user-repo import E2E test (against `adaptive-learner-content-test`).
- **#644** EXP-031 — ZIP-based backup format (`.alb`) design exploration.

### Earlier: v1.83.0 contents (commits since v1.82.0)

Full detail in `changelog/releases/v1.83.0.md`. 4 PRs, no schema/API/data change:

- **#631 (P1)** review session — Enter shortcut + element de-dup in the queue + live XP-badge recompute (Refs #629).
- **#633 (P2)** theory markdown-table styling (Refs #632).
- **#635 (P2)** theory back-link resolves by topic, not nearest step (Refs #634).
- **#630** gap-hardening audit — six gaps closed: cloze Tab nav (#623), hints honour the feature-not-available policy (#624), Dashboard favorites Top-5 cap (#625), review "repeat in 2 days" suggestion (#626), free-text "Fast! Achte auf:" typo hint (#627), Dashboard Quick-Review button (#628).

### Earlier: v1.82.0 contents (commits since v1.81.0)

Full detail in `changelog/releases/v1.82.0.md`. Six PRs + the cherry-picked #621:

- **#611** Hint economy — hints cost XP, feed the SRS, show in statistics (Alembic 0030).
- **#612** Smart review queue — weakness tiers + per-element attempt history + cross-lesson mix capped at 20 (Alembic 0031).
- **#614** PWA update prompt — polled `version.json` + service-worker prompt mode.
- **#617** Test Impact Analysis — PR CI runs only impacted tests (vitest `--changed`, `pytest --testmon`); full suite on push/nightly/release.
- **#620** Architecture-doc audit — Dexie data-integrity + namespace split + Settings-nav patterns added to `.claude/rules/architecture.md`.
- **#610** recommended-repos discovery E2E reactivated.
- **#621** Manual test plan automated — 7 Playwright session suites under `e2e/manual-automation/` (50 automated + 15 manual-only scenarios), `playwright.manual.config.ts`, a `test-manual-automation` Makefile target wired into `release-test`, and a nightly `manual-automation.yml` workflow. Cherry-picked onto the release branch pre-finish.

### Earlier: v1.81.0 contents (commits since v1.80.0, 31 + release commits)

The biggest feature release of the project. Full detail in
`changelog/releases/v1.81.0.md`.

- **Features:** Learning Statistics page + activity heatmap (#584); SRS
  due-reviews visualization (#592); staged auto-hint system (#595); lesson
  favorites (#598); richer error/review UX — answer diff + explanations +
  summary (#602); Dashboard gamification — XP/streaks/badges with reusable
  `ProgressRing`/`StreakCalendar`/`BadgeGrid` (#583); lesson-play UX —
  `AnimatedCounter`/`FeedbackPulse`/mid-lesson motivation (#589); offline UX —
  offline + sync-status badges, download progress, pending-sync, install (#605);
  global keyboard-shortcuts + help overlay (#587); **Hindi as the 9th UI
  language** + Devanagari font stack (#571); searchable LanguagePicker (#568);
  event-recording / error-report system EXP-028 (#566); interactive avatar crop
  dialog (#560); Settings sidebar/hamburger navigation (#549); editable display
  name in Settings>Profile (#579); gamification dashboard API `/api/gamification/*`
  (#573); recommended-repos.json live (#574); 20+ reusable `shared/` components.
- **Fixed:** P1 iPhone Settings menu blocked header navigation (#597); crop image
  collapsed below the circle — global `img{max-width}` vs layered `max-w-none`
  (#578); Settings content width + Data-card overflow (#556); develop unblockers
  (#591, #601); **mid-lesson motivation toast blocked the lesson footer buttons**
  — found by the release-gate's dexie-smoke (it had slipped past PR CI now that
  dexie-smoke is nightly), fixed with a `notify.info` pass-through option
  (pointer-events:none) on the release branch.
- **Changed / CI:** CI night-shift — security/coverage/content-stats/complexity-
  report moved off PRs to a daily/weekly schedule (#552/#576).
- **Security:** starlette → 1.3.1 (CVE-2026-54282/54283, #607).
- **Docs:** EXP-027 i18n strategy (reworked), EXP-028 event recording, EXP-029
  media reciprocity (#608), **EXP-030 multi-user strategy (#609)**.

No schema / API / data-model change beyond the additive gamification
read-endpoints.

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

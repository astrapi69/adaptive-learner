# Handover / Status Report

_Last updated: 2026-06-16. Overwritten on each status pass — this file is always the latest snapshot._

## 1. HEAD + version

- **Release:** **v1.81.0 SHIPPED** (minor — the biggest feature release of the
  project; canonical `backend/pyproject.toml` = `1.81.0`). Tag `v1.81.0` on
  `main` (`1a7816a7 Release v1.81.0`), GitHub Release published, merged back to
  `develop` (`804f7a85`). Release branch deleted (local + remote).
- **Branch:** `develop` is the active branch (gitflow #334); `main` holds the
  v1.81.0 release tag.
- **Previous release:** v1.80.0 (EXP-026 user-lesson folding into the content
  tree + EXP-025 book companion + user profile picture).
- **Async CI on the tag/push:** launcher builds (Linux/macOS/Windows) on the
  `v1.81.0` tag + GH-Pages deploy on develop were triggered at release time;
  these complete on their own and do not gate the release.

## 2. Test counts (v1.79.0 baseline — re-collect for v1.81.0)

| Suite | Count (v1.79.0 baseline) | How collected |
|---|---|---|
| Backend (pytest) | **1215+** | `cd backend && poetry run pytest --collect-only -q` |
| Plugins (13 suites, pytest) | **1018+** | per-plugin `pytest --collect-only` from the backend env |
| Frontend (Vitest) | **4285+ passed** | `cd frontend && npx vitest run` |

The table is the last precisely-collected baseline (v1.79.0). v1.81.0 added many
feature + component tests on top — the gamification dashboard-API tests
(`test_gamification_dashboard_api.py`), the statistics / SRS / hints / favorites /
review / offline / shortcuts / username feature tests, the avatar-crop tests, and
a large new `shared/` component suite. The full **`make release-test` gate is
green** (incl. **dexie-smoke 87 passed**, the gate that caught and verified the
mid-lesson-motivation-toast fix below). Re-collect exact counts via the commands
above. TypeScript `tsc --noEmit` clean; ESLint clean; full Playwright smoke runs
separately (Aster runs E2E).

## 3. v1.81.0 contents (commits since v1.80.0, 31 + release commits)

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

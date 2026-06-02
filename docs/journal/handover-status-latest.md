# Handover / Status Report

_Last updated: 2026-06-02. Overwritten on each status pass — this file is always the latest snapshot._

## 1. HEAD + version

- **Release:** **v1.53.1** (patch — bug fixes only; canonical `backend/pyproject.toml` = `1.53.1`).
- **Branch:** `main`. The four reported bugs (§3) are all resolved and ship in v1.53.1.
- Previous release: v1.53.0 (content schema v1.3 + Python course + domains).

## 2. Test counts (re-collected 2026-06-02)

| Suite | Count | How collected |
|---|---|---|
| Backend (pytest) | **1125** | `cd backend && poetry run pytest --collect-only -q` |
| Plugins (13 suites, pytest) | **1009** | per-plugin `pytest --collect-only` from the backend env |
| Frontend (Vitest) | **3045 passed** | `cd frontend && npx vitest run` (276 files, all green) |
| **Total** | **5179** | — |

Per-plugin: ai-anthropic 35, ai-gemini 34, ai-openai 32, anki 20, assessment 110, content-loader 261, gamification 55, learning-repo 53, missions 41, notebooklm 27, session 219, tools 58, tracking 64.

TypeScript: `npx tsc --noEmit` clean. E2E (Playwright smoke + Dexie-mode gate) runs separately (Aster runs E2E); the Dexie adaptive walker was updated to the controlled two-phase flow.

## 3. Bug status — ALL 4 RESOLVED

1. **P1 — Double-button (Prüfen + Weiter visible at once)** — **RESOLVED** (`5f9e950`).
   Not a stale build: `Lesson.tsx` was correct, but **AdaptiveLesson.tsx** and **Review.tsx** rendered the exercise uncontrolled (internal "Prüfen" submit) AND their own "Weiter" nav button. Both now use the controlled single two-phase button (Check→Weiter), per-step `key`, state reset on step change. Regression pins: `AdaptiveLesson.twophase.test.tsx`, `Review.twophase.test.tsx` (all 5 exercise types).
2. **P0 — Community PR file attachment** — **RESOLVED** (`0a5dbfd`).
   Realistic single lessons (>~8 KB JSON) made `communityPrUrl` return `null` → fell back to the upload page at a `sets/.../lessons` directory that doesn't exist for a new set, so the file couldn't be placed. Single lessons now always use the create-file `/new/` flow (creates new nested paths + auto-forks); `communityPrUrl` returns `{url, prefilled}` and never `null` (content prefilled when it fits, else the file downloads for pasting). Multi-lesson sets keep upload + download-all. New `paste_instructions` i18n in all 8 catalogs.
3. **P1 — "Sitzung fortsetzen" analysis context** — **RESOLVED / already implemented; regression pin added** (`d14e811`).
   Traced end-to-end: the analysis is injected into the system prompt at creation (both modes), persisted as a `role=system` message, and re-sent every turn (`anthropicComplete` extracts `system`); resume reloads it and each `message()` rebuilds history from the DB. The feature was already correct. Added the one missing pin: after resume, the next AI call's `body.system` contains the analysis (topic/weaknesses/vocab). No production change.
4. **UX — Nav-bar hamburger in lessons** — **RESOLVED / already implemented** (`b7de89c`).
   During `/lesson`, `/review`, `/adaptive-lesson` the nav collapses to a hamburger-only bar at any width (`.is-lesson-compact .nav-hamburger { display:inline-flex }`), links move behind the drawer, badges/brand hide, bar shrinks to 48 px. 23 tests pass (`Navigation.test.tsx`, `useIsLessonActive.test.ts`, `lesson-compact-nav.test.ts`). No change needed.

## 4. Content repo status (`astrapi69/adaptive-learner-content`)

- **7 sets, 100 lessons:** `de/en-a1` 15 · `de/es-a1` 15 · `de/fr-a1` 15 · `de/python-basics` 15 · `de/psych-intro` 10 · `en/es-a1` 15 · `en/fr-a1` 15.
- **Open PRs: 0.** No A2 sets present yet (CCW A2 work not landed/visible here — see §7).

## 5. v1.53.1 contents (commits since v1.53.0)

```
chore(release): bump version to v1.53.1
docs: refresh status report - all 4 bugs resolved
test(session): pin analysis context carries through session resume (P1)   d14e811
fix(share): reliable community PR file attachment for new sets (P0)        0a5dbfd
docs: comprehensive status report                                         (0fb39e1)
fix(lesson): single two-phase button in adaptive + review flows (BUG P1)   5f9e950
feat(share): wire Regenerate + i18n for the editable share wizard          a93414d
fix(share): editable, validated Step 1 in the share wizard (P0)           17a597f
feat(nav): compact navigation during lessons + landscape mobile           b7de89c
fix(session): friendly localized toast when no AI key is configured        ec4b79c
test(lesson): pin single two-phase button across all 5 exercise types      984c4d9
```

Headline fixes: share-wizard editable Step 1 (P0), community PR attachment (P0), double-button (P1), compact lesson nav, + resume-context regression pin.

## 6. Open feature branches

- App repo remote (besides `main`): `feature/help-translations`, `feature/learning-path`, `feature/lesson-creator`, `claude/probe-push-permission`, `claude/setup-backend-foundation-6E1lr`. `feature/learning-path` + `feature/lesson-creator` look superseded (both features shipped on main) — prune after confirming nothing unmerged.
- Content repo: `claude/epic-keller-0worq`, `claude/psych-intro-content` + `claude/python-basics-content` (latter two merged).

## 7. CCW status (FR A2 / ES A2 / EN A2)

Not yet landed or visible: no A2 sets, PRs, or branches in the content repo. CCW's A2 generation is in progress externally; treat as reported-by-user until it appears as `sets/{de,en}/{fr,es}-a2/`.

## 8. Backlog (open)

- **BACKUP-API-RESTORE-01** — listed open but CLAUDE.md records it fixed in v1.52.0; verify + archive.
- **DEP-MYPY-2-01** (mypy 2.0, held) · **DEP-ANTHROPIC-105-01** (held) · **PLUGINFORGE-LIFECYCLE-UI-01**.
- **BL-14** Postgres · **BL-15** JWT · **BL-16** multi-user · **BL-17** Stripe · **BL-19** social (P4/P5).
- P3 follow-ups filed in v1.53.0: **ANALYSIS-TARGET-DETECT-01**, **ANALYSIS-DOMAIN-SUGGEST-01**, **PLACEMENT-LANG-WARN-01**.

## 9. Next steps

1. Land CCW A2 content when it arrives (bundle snapshot bump on the app side).
2. Housekeeping: archive BACKUP-API-RESTORE-01 if confirmed done; prune superseded `feature/*` branches.
3. Optional polish: `buildAnalysisContext` only branches DE vs EN — other source languages get the English block (minor i18n gap).
4. Work the P3 analysis/placement follow-ups and the held dependency bumps in a dedicated session.

## 10. Lessons learned (this session)

- **Verify before fixing — twice it paid off.** Two of the four "bugs" (#3 resume context, #4 nav hamburger) were already implemented; the right deliverable was a regression pin (#3) and a verification (#4), not a fabricated change. Matches the user's own "don't implement blindly" directive.
- **Enumerate every consumer of a shared component.** The double-button's prior "stale build" diagnosis only checked `Lesson.tsx`; the defect lived in two other consumers. A pin covering one of three render paths gives false confidence.
- **GitHub web-flow limits are the real constraint for zero-auth PRs.** The create-file `/new/` flow creates new nested paths + auto-forks; the `/upload/` page can't target a not-yet-existing directory. For a "first contributor to a set" the upload fallback was structurally broken — `/new/` is the reliable path.
- **Re-collect counts every release** (5179 now); plugin totals need the per-plugin loop (a combined collect undercounts on per-plugin conftests).
- **vitest from `frontend/`**, never repo root (the `setup: 0ms` / DOM-undefined trap).

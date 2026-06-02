# Handover / Status Report

_Last updated: 2026-06-02. Overwritten on each status pass — this file is always the latest snapshot._

## 1. HEAD + version

- **HEAD commit:** `5f9e950` — `fix(lesson): single two-phase button in adaptive + review flows (BUG P1)`
- **Released version:** `v1.53.0` (canonical `backend/pyproject.toml` = `1.53.0`)
- **Branch:** `main` (7 commits ahead of the `v1.53.0` tag — all unreleased, see §5)
- The next release will be a **minor** bump (`v1.54.0`): it carries new features (compact lesson nav, editable share wizard) plus P0/P1 fixes.

## 2. Test counts (freshly re-collected this session, 2026-06-02)

| Suite | Count | How collected |
|---|---|---|
| Backend (pytest) | **1125** | `cd backend && poetry run pytest --collect-only -q` |
| Plugins (13 suites, pytest) | **1009** | per-plugin `pytest --collect-only` from the backend env |
| Frontend (Vitest) | **3043 passed** | `cd frontend && npx vitest run` (276 files, all green) |
| **Total** | **5177** | — |

Per-plugin breakdown: ai-anthropic 35, ai-gemini 34, ai-openai 32, anki 20, assessment 110, content-loader 261, gamification 55, learning-repo 53, missions 41, notebooklm 27, session 219, tools 58, tracking 64.

E2E (Playwright, not on the `make test` path): smoke specs + the Dexie-mode release gate (`make test-dexie-smoke`). The Dexie adaptive walker was updated this session to the controlled two-phase flow; **not re-run here** (Aster runs E2E).

TypeScript: `npx tsc --noEmit` clean.

## 3. Bug status

### Fixed this session
- **P0 — Share Wizard Step 1 (3 sub-bugs A/B/C)** — `17a597f`, `a93414d`.
  - A: Step 1 metadata (title / source / target / level) is now an editable, pre-filled form; corrected values drive placement, validation, the PR body, and are stamped onto the shipped lesson file.
  - B: empty lessons (0 exercises / 0 cards) block sharing + offer a Regenerate button (analysis sets → import page, else Lesson Creator).
  - C: non-CEFR levels (e.g. `imported`) can never advance; required CEFR dropdown.
  - i18n: 16 new strings in all 8 catalogs.
- **P1 — double-button (Prüfen + Weiter visible at once)** — `5f9e950`.
  - Root cause (NOT a stale build, contrary to the prior diagnosis in `984c4d9`): the main `Lesson.tsx` flow was already correct, but **AdaptiveLesson.tsx and Review.tsx** rendered the `ExerciseDispatcher` *uncontrolled* (internal "Antwort prüfen" submit visible) **and** their own always-on "Weiter" nav button → two buttons per exercise step.
  - Fix: both pages now use the same controlled two-phase pattern as `Lesson.tsx` (ref + `controlled` + `onInteraction`, per-step `key`, single Check→Weiter button). New regression pins: `AdaptiveLesson.twophase.test.tsx`, `Review.twophase.test.tsx` (all 5 exercise types).

### Open (priority order)
1. **P0 — Community PR file attachment bug** (core sharing broken). NOT yet investigated this session. Next up.
2. **UX — nav-bar hamburger in lessons.** Partially addressed by `b7de89c` (compact navigation during lessons + landscape mobile); confirm whether a hamburger is still wanted on top of the compact nav.
3. **P1 — "Sitzung fortsetzen" analysis context** (resumed session should carry the analysis context). Open.

## 4. Content repo status (`astrapi69/adaptive-learner-content`)

- Local sibling checkout: `/home/astrapi69/dev/git/hub/astrapi69/adaptive-learner-content`, on `main`.
- **7 sets, 100 lessons total:**
  - `de/en-a1` 15 · `de/es-a1` 15 · `de/fr-a1` 15 · `de/python-basics` 15 · `de/psych-intro` 10 · `en/es-a1` 15 · `en/fr-a1` 15
- **Open PRs: 0** (`gh pr list` on the content repo returns none).
- Recent merges: python-basics (PR #3), psych-intro, license change to Attribution-ShareAlike 4.0.
- Remote branches: `claude/epic-keller-0worq`, `claude/psych-intro-content`, `claude/python-basics-content` (the latter two already merged to main).

## 5. Unreleased commits since v1.53.0

```
5f9e950 fix(lesson): single two-phase button in adaptive + review flows (BUG P1)
a93414d feat(share): wire Regenerate + i18n for the editable share wizard
17a597f fix(share): editable, validated Step 1 in the share wizard (P0)
b7de89c feat(nav): compact navigation during lessons + landscape mobile
ec4b79c fix(session): friendly localized toast when no AI key is configured
0ce8139 Merge branch 'main' of http://127.0.0.1:44291/git/astrapi69/adaptive-learner
984c4d9 test(lesson): pin single two-phase button across all 5 exercise types (BUG P1)
```

(7 commits; `0ce8139` is a sync merge. These accumulate toward `v1.54.0`.)

## 6. Open feature branches

**App repo (`astrapi69/adaptive-learner`):**
- Local: `main` only.
- Remote (besides `main`): `feature/help-translations`, `feature/learning-path`, `feature/lesson-creator`, `claude/probe-push-permission`, `claude/setup-backend-foundation-6E1lr`.
- Note: `feature/learning-path` and `feature/lesson-creator` look superseded — Learning Path (Phase 66) and the Lesson Creator (Phase 65) already shipped on `main`. Candidates for deletion after confirming nothing unmerged remains.

**Content repo:** see §4 (3 `claude/*` branches; 2 already merged).

## 7. CCW status (parallel content work: FR A2 / ES A2 / EN A2)

- **Not yet landed or visible in this repo.** The content repo `main` has **no A2 sets** (only the A1 pairs + python-basics + psych-intro), **no open A2 PRs**, and **no A2 branches** as of content-repo HEAD `ed4c605`.
- Interpretation: CCW's A2 generation is in progress externally and has not been pushed/PR'd yet. When it lands it will appear as `sets/{de,en}/{fr,es}-a2/` plus an app-side bump of the bundled-content snapshot.
- _Not directly verifiable from these two repos beyond the above; treat the A2 progress detail as reported-by-user._

## 8. Backlog (filed + open)

From `docs/backlog.md` (open `- [ ]`):
- **BACKUP-API-RESTORE-01** — listed open, but CLAUDE.md records it as fixed in v1.52.0. **Likely already closed; needs archival verification** (see lessons-learned: verify backlog vs reality).
- **DEP-MYPY-2-01** — mypy 1.x → 2.0 (held).
- **DEP-ANTHROPIC-105-01** — ai-anthropic anthropic SDK 0.105 (held).
- **PLUGINFORGE-LIFECYCLE-UI-01** — consume PluginForge v0.9.0 lifecycle visibility in the UI.
- **BL-14** PostgreSQL migration · **BL-15** JWT auth · **BL-16** multi-user · **BL-17** Stripe · **BL-19** social features (all P4/P5 future).

P3 follow-ups filed in v1.53.0 (per CLAUDE.md): **ANALYSIS-TARGET-DETECT-01**, **ANALYSIS-DOMAIN-SUGGEST-01**, **PLACEMENT-LANG-WARN-01**.

## 9. Next steps (priority)

1. **P0 — Community PR file attachment bug.** Core sharing is reported broken; investigate the create-file URL / upload path end-to-end (verify the `value=` JSON actually lands, the URL-length fallback, and the download-then-upload ordering). The share action lives in `frontend/src/components/content/ShareWizard.tsx` (`doShare`) + `frontend/src/lib/content/lesson-export.ts`.
2. **P1 — "Sitzung fortsetzen" analysis context** — resumed session must carry the analysis context.
3. **UX — lessons hamburger** — decide if still needed after `b7de89c`'s compact nav.
4. Cut **v1.54.0** once the P0 attachment bug is fixed (run the full release gate incl. `make test-dexie-smoke`).
5. Housekeeping: archive BACKUP-API-RESTORE-01 if confirmed done; prune superseded `feature/*` branches.

## 10. Lessons learned this session

- **"Stale build" was the wrong root cause for the double-button.** The prior session (`984c4d9`) pinned `Lesson.tsx` (correct) and concluded PWA cache. The real defect was in two *other* consumers (AdaptiveLesson, Review) that the pin never covered. Lesson: when a UX bug is reported again after a "no defect found" diagnosis, **enumerate every consumer of the shared component**, not just the obvious one. A regression pin that covers one of three render paths gives false confidence.
- **The controlled-exercise contract had a documented "Review + AdaptiveLesson stay uncontrolled" intent** (`exercise-control.ts` header) that directly produced the bug — the self-contained internal button + the page's own nav button = two buttons. Aligning all three flows on the controlled pattern is the consistent fix.
- **Per-step `key` matters in controlled mode:** without `key={step.id}` the exercise instance persists `submitted` across steps, so a fresh step would render as already-graded. Added it to both pages (matching `Lesson.tsx`).
- **vitest cwd trap (again):** running `npx vitest run` from the repo root yields mass `setup: 0ms` / "document is not defined" failures. Always run from `frontend/`. (Hit and recovered earlier in the session.)
- **Re-collect test numbers; don't trust CLAUDE.md baselines.** The cited baseline (4702) was stale; the real total is 5177. Plugin counts require the per-plugin loop — a combined collect from the backend env errors on per-plugin conftests and undercounts.
- **Share-wizard editability over auto-magic:** old corrupted lessons can't be perfectly auto-repaired; the durable fix was making the fields editable + gated, with best-effort defaults, rather than guessing.

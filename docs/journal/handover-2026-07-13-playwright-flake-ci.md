# Handover — 2026-07-13 (Playwright upgrade, #1540 flake, CI trigger)

## TL;DR
Coordinated Playwright **upgrade** to 1.61.1 (Ubuntu 26.04 forces it — 1.59.1
can't install a browser there), the stubborn `lesson-matching@mobile` visual
flake (#1540) root-caused + fixed, and a CI path-gate so frontend-only PRs stop
running the backend suite. All merged to `develop`. Two loose ends: the #1618
5-run verify was still in flight at merge (very likely green), and the
`global.css` concern-split (Aster's idea) is the real fix for the recurring
collisions and is deferred pending coordination.

## What landed on develop (merged PRs)
| PR | What |
|----|------|
| #1596 | CI container tags `v1.59.1-noble` → `v1.61.1-noble` (5 jobs) |
| #1601/#1602 | Repaired the incoherent develop from the #1590 self-merge (pkg 1.59.1 vs container 1.61.1 → back to 1.61.1) |
| #1604 | Visual baseline refresh under 1.61.1 (content-browser + set-detail); **Closed #1577** |
| #1606 | FeatureShot refresh — 18 stale shots under 1.61.1 (partial #1567) |
| #1612 | Cohesion split: extracted CSS-selector primitives from `check-legacy-wrap-conflicts.py` (was 1016 → 843 lines) after CCW's #1598 pushed it over the God-File limit; **Closed #1611** |
| #1617 | CI path-gate: `changes` job + `needs: changes` on backend-tests/plugin-tests/lint-and-type-check → they skip poetry-install + work on frontend-only PRs |
| #1618 | #1540 flake fix: `.lesson-header h1 { line-height: 1.25 }` + per-shot `maxDiffPixelRatio: 0.08` on lesson-matching@mobile; **Closed #1540** |

Closed without merge: **#1609** (settle-anchor, disproven), **#1615** (line-height
fix on a stale pre-#1613 base — superseded by #1618).

## Playwright: 26.04 forces 1.61.1 (NEVER downgrade)
The prior handover said "pin 1.59.1". **That is wrong now.** The maintainer
machine runs **Ubuntu 26.04**, where `@playwright/test@1.59.1` can't install a
browser (`does not support chromium on ubuntu26.04-x64`); 1.61.1 works (build
1228). So the direction reversed to a coordinated **upgrade**: package stays
1.61.1, the 5 CI container tags moved to `v1.61.1-noble`, baselines re-rendered
under 1.61.1. `visual-regression.yml` uses `ubuntu-latest` + `npx playwright
install` (renders under the PACKAGE version), NOT the container. Dependabot
ignores `@playwright/test` (#1586). Memory: `playwright-2604-upgrade`.

## #1540 flake — root cause + fix (the hard one)
Three prior settle-timing fixes failed (#1554 data anchors, retries+250ms,
#1609 geometry anchor) because **it was never a settle race**. Pixel-analysing
failing CI captures pinned it to a **bistable ~5px title-height shift** at
`.lesson-header h1` (y=127): the title pinned no `line-height`, so with Tailwind
preflight off it used the font-metric `normal`, whose box height rode a
font-metric race `fonts.ready` doesn't fully cover → two ~5px-apart phases per
CI run → every lesson surface below shifted.

Fix: `line-height: 1.25` (1.1rem × 1.25 = 22px integer on mobile) → deterministic
title height. This took it from **5/5-fail** (the anchor) to **4/5-pass**; the
residual 1/5 is a smaller ~5px shift (observed ratio **0.05**). A per-shot
`maxDiffPixelRatio: 0.08` on lesson-matching@mobile absorbs that content-
identical remainder. The line-height pin is the real fix; the tolerance only
covers the residual on one shot.

**OPEN CAVEAT:** #1618 was merged (by Aster) BEFORE the 5-run verify completed.
The 5 runs (visual-regression on the branch) were still in flight. 0.08 > the
0.05 residual, so 5/5 green is very likely — but if a run shows a NEW failure,
a follow-up on develop is needed. Check the runs' result.

Residual of #1540/#1567: the 2 `@mobile` FeatureShot flappers (matching-pairing,
missionen) are the same bistable-layout class; the line-height fix may have
helped them too (they share `settleForScreenshot` + the lesson header) — worth
re-checking before more work.

## CI path-gate (#1617) — proven
On a frontend-only PR, backend-tests went **6m0s → 10s**, ruff+mypy 37s→7s,
plugin 8s (the `Detect changed areas` job gates them). `frontend-tests` /
`pre-commit` / `docs-verification` still run. Push to develop/main always runs
the full suite. Note: the 6min was worse than expected because a testmon
cache-miss ran the FULL backend suite on a CSS PR — exactly what the gate kills.

## The recurring collision pattern (important)
A parallel CCW session kept landing changes on the exact areas being worked:
**#1590** (downgrade — self-merged despite a blocking comment, caused the
incoherent-develop incident), **#1598** (grew the audit tool past the God-File
limit), **#1613** (restructured the lesson-header rules mid-flake-fix, forcing a
rebase of #1615→#1618). Root cause: everyone edits the one 7569-line
`global.css`. **Recommendation:** either concern-separate the sessions (CCW on
EXP-044 CSS, others off `global.css`), or land the split below.

## Next step Aster proposed: split `global.css` by concern (the real fix)
Aster: "you can `@import` CSS files (tables.css, section.css, common.css…)".
Correct + high-value — it kills the God-File AND the collision surface. Findings:
- **Precedent exists:** `main.tsx` already imports `tailwind.css` + 12
  `theme-*.css` + `toast-theme.css` + `fonts-*.css`; Vite bundles them at build
  (no runtime `@import` cost).
- **Synthesis:** `@import "x.css" layer(legacy)` (tailwind.css already does
  `layer(utilities)`) can REPLACE CCW's tranche-by-tranche `@layer legacy { }`
  wrapping — split by concern + layer-import each debt file in one move. This is
  a cleaner EXP-044 endgame than ~40 incremental tranches.
- **Grouping (from the section headers):** buttons / landing / onboarding /
  assessment / dashboard / session / settings / navigation / progress / lesson /
  curriculum / editor / gamification / anki / voice / pronunciation / exercises /
  celebration / … + base.css. ~25–35 files.
- **Constraints:** import ORDER must preserve the within-layer source-order
  cascade; verify against the full visual-regression suite. Must be coordinated
  (not concurrent with CCW's active tranches).
- **Decision still open:** do it now (freeze CCW's tranches) vs after the current
  work settles; and who owns EXP-044 CSS going forward. Aster did not answer.

## Housekeeping
- Many scratch worktrees were created this session (wt-audit, wt-2b, wt-baseline,
  wt-pw, wt-restore, wt-featureshots, wt-cohesion, wt-ci, wt-flake, wt-lh,
  wt-lh2, wt-dbot). `git worktree prune` + remove the leftover branches.
- Memory files updated/added: `playwright-2604-upgrade`, `exp044-tranche2-state`.

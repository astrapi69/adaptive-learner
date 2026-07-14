# Chat journal - session 2026-07-14

Continuation of the 2026-07-13 Playwright / #1540-flake / CI session, then a
full EXP-044 Tranche-2c push and the **v2.2.0 release**.

## 1. Verify the #1618 5-run + discover a red develop (~08:50)

- Original prompt: report the #1618 5-run verify result; follow up if a new fail.
- Goal: close the open caveat from the 2026-07-13 handover.
- Result: the 5-run verify on `fix/1540-lesson-header-line-height` was **5/5
  green** (line-height pin + 0.08 tolerance) - #1540 needs no follow-up. But
  the main **CI was red on develop since #1610**: the Frontend Tests job failed
  on `ios-zoom-guard.test.ts`. Root cause: #1610 deliberately added
  `maximum-scale=1.0, user-scalable=no` to the viewport (for the #1569
  caret-desync), updated the two e2e axe specs, but **missed the vitest guard**.
  It slipped the PR gate because the guard reads `index.html` via `readFileSync`
  (invisible to selective `vitest --changed`); only the full push-to-develop run
  caught it.
- Commit: n/a (diagnosis).

## 2. Fix the red develop - #1619 (Closes #1614) (~09:20)

- Goal: unblock develop without reverting the owner's deliberate #1569 decision.
- Result: applied #1614 path B (adapt the guard + document the WCAG trade-off,
  NOT a blind revert), which #1614's own decision tree prescribes since
  `user-scalable=no` was deliberate. Kept test 1 (16px floor); rewrote test 2 to
  enforce the responsive viewport base + require any zoom-suppression to cite
  #1569. Green, merged; develop back to all-7-jobs green. Filed **#1620** for the
  selective-testing blind spot (readFileSync guards invisible to
  `vitest --changed`).
- Commit: `ff70a63b` (PR #1619).

## 3. EXP-044 Tranche 2c - three single-block wraps (~09:40-11:50)

- Goal: continue EXP-044 (Aster: "machen wir mit exp-044 weiter"). Wrap the
  remaining audit-flagged single blocks.
- Result (each: pre-wrap audit -> resolve the one conflict -> wrap -> audit
  CLEAN -> css-size baseline -> visual-regression **0 new diffs** -> merge):
  - **#1583 MobilePolish-9A** (`8714ac91`, PR #1621): deleted the dead
    `.nav-hamburger { margin-left: auto }` (Navigation.tsx `ml-0!` always wins),
    wrapped. Baseline 7573 -> 7575.
  - **#1585 ChatAnalysisLoading** (`cb00aec0`, PR #1622): moved
    `.analysis-error-inline p { margin; color }` onto the bare consumer `<p>` as
    `m-0 text-[var(--error)]`, deleted the rule, wrapped. Baseline 7575 -> 7572.
  - **#1584 ReadAloudTTS** (`92638723`, PR #1624): moved
    `.exercise-prompt-row > p { flex; margin }` onto the 5 prompt `<p>` consumers
    as `flex-auto m-0` (all already had `m-0`), deleted the rule, wrapped.
    Baseline 7572 -> 7571.
- Also: audited **#1592 LessonMode-LandscapeNav** - still `ABHAENGIG(4)` after
  #1583; closing it needs a large, entangled mobile-`@media` co-wrap
  (nav + session-chat + chat + cycle-steps = the 14-diff zone), which argues for
  the deferred concern-split. Not wrapped. Filed **#1623** (pre-existing
  `--wrapped` drift on Onboarding/Dashboard blocks from later utility additions).

## 4. Release v2.2.0 - prep (Option B) (~11:50-12:10)

- Original prompt: "wir brauchen ein neuen release" -> "v2.2.0, Option B" ->
  "Commit + push release/2.2.0; hand off".
- Goal: prepare a fully-gated `release/2.2.0`; Aster finishes + publishes.
- Result: cut `release/2.2.0` from green develop; bumped
  `backend/pyproject.toml` 2.1.0 -> 2.2.0 + `make sync-versions` (20 files);
  wrote `changelog/releases/v2.2.0.md`; refreshed version refs in README.md,
  README-de.md, CLAUDE.md. Gates green - local (`make test` 6966 vitest +
  backend + plugins, build, ruff, mypy, verify-docs-discipline,
  sync-versions-check, verify-plugin-locks) + release-branch CI (Dexie smoke,
  Manual-plan automation, Security Scan). Plugin locks intentionally unchanged
  (version-only bump; verify-plugin-locks in sync; matches v2.1.0's bump).
- Commit: `634a8988` (release/2.2.0).

## 5. Verify Aster's merge + deploy (~12:20)

- Original prompt: "check mal ob ich das richtig gemerged und deployed habe".
- Result: **all correct.** Tag `v2.2.0` (annotated) -> `ed014302` = main HEAD
  "Release v2.2.0"; main + develop both at 2.2.0, both CI green; develop
  back-merge done; GitHub Release published (not draft, 4 assets); Launcher
  builds macOS/Linux/Windows green; Deploy GitHub Pages green. Release-freeze
  lifted. Noted a stale remote ref (`claude/lesson-header-collapsible-iwjpk3`)
  for a `git remote prune`.

## 6. Post-release documentation (~12:30)

- Refreshed the ROADMAP.md + backlog.md "Current state" headers to v2.2.0
  (they were stale at v1.99.0; added concise v2.1.0/v2.0.0 pointers) and wrote
  this journal entry.

## Summary

- **Merged:** 4 PRs to develop (#1619 red-develop fix, #1621/#1622/#1624 EXP-044
  Tranche 2c wraps).
- **Released:** v2.2.0 (feature release - extension-exercise tier, schema
  consumer, content-repo registry, mobile-nav, EXP-044; 87 commits since
  v2.1.0). Prepped by CC (Option B), finished + published + deployed by Aster.
- **Issues filed:** #1620 (selective-testing blind spot), #1623 (wrapped-block
  drift).
- **Deferred:** #1592 (LessonMode - needs the entangled mobile-`@media`
  co-wrap; candidate for the concern-split), #1584-family follow-ups.
- **Gates:** every merge verified by the audit tool (CLEAN) + a dispatched
  visual-regression run (0 new diffs); the release fully gated locally + on CI.

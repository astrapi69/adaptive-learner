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

---

# Session 2 (afternoon, ~12:40-14:20): accepted-conflicts allowlist

See the dedicated handover:
[handover-2026-07-14-exp044-reconciliation.md](handover-2026-07-14-exp044-reconciliation.md)
(#1630 allowlist feature, #1629/#1620 filed, #1631 handover PR).

---

# Session 3 (evening, ~16:00-18:30): #1597-Rest wrap, card_ids crash, baseline races, visual gate

## 7. #1597-Rest: wrap the lesson-header/summary section (~16:00)

- Original prompt: continue from the handover - the #1597-Rest activation
  cycle, per-conflict decisions + visual-regression with real diffs.
- Goal: wrap the intentionally-unlayered lesson-header/summary block into
  `@layer legacy` with an honest per-conflict decision (not a blanket 0-diff
  claim).
- Result: fresh audit confirmed 4 conflicts. Decisions (Aster chose "Mixed"):
  C1 `.content-set-meta h4` = tag-heuristic FALSE POSITIVE (the flagged h4 is
  FoldedUserLessons.tsx:56, a sibling of the ul, not a `.content-set-meta`
  descendant) -> allowlisted; C2 text-sm dropped as a "no-op" (later REVISED,
  see 10.); C3 timed-stats `m-0` = the one intended activation -> allowlisted;
  C4 mt-3 value-equal -> dropped. `--wrapped` CLEAN, css-size 7571 -> 7565
  (net -6). Issue #1632 filed first, PR #1634 opened.
- Commit: 5bfe31d8 (PR #1634).

## 8. Mid-turn P1: adaptive lesson crash on card_ids (~16:25)

- Original prompt: CC-Prompt "Crash bei Adaptive Lektion (card_ids
  undefined)" - verify-first, issue, TDD RED-first, no blanket try/catch.
- Goal: root-cause `undefined is not an object (evaluating 'a.card_ids.some')`.
- Result: `exercise-pool.ts:127` (+ generated-cloze path) assumed every
  exercise carries `card_ids`; the field is schema-optional
  (default_factory=list) and Dexie mode loads raw JSON, so card-less types
  (multiple_choice, ext:al-*) arrive with `card_ids === undefined`. Fix:
  `?? []` guards matching the existing review-lesson/theory-link pattern;
  `_estimateDifficulty` untouched (keeps #1599 clear). 4 RED tests failed with
  the exact production TypeError, GREEN after; 91/91 adaptive tests. Issue
  #1636, PR #1637.
- Commit: 96eb0eef (PR #1637).

## 9. Visual-regression red: stale baselines, not the wrap (~16:45)

- Goal: verify the wrap with a dispatched visual-regression run.
- Result: run 29340479250 failed BROADLY (cloze/matching/result/summary).
  Forensics: baselines (#1618) predate #1628 (options-panel rework, touched 0
  baselines) -> pre-existing drift; the nightly-only cadence (#552) hid it.
  Isolation argument: `lesson-matching` diffs across all 12 themes cannot come
  from a summary-section CSS wrap. Issue #1638 filed; develop regen
  (update_baselines=true, run 29343352978) produced 14 changed PNGs (91
  byte-identical - CI rendering is deterministic); eyeballed = exactly the
  #1628 options-panel change; baseline PR #1639.
- Commit: f4a122ec (PR #1639).

## 10. The C2 correction: a "no-op" utility with a live second declaration (~17:30)

- Goal: explain why the wrap branch diffed MORE than the develop drift
  (lesson-result x12, lesson-summary x3, 4 extra matching themes).
- Result: exhaustive cascade sweep (subagent) found NO competing rule in any
  stylesheet; the cause was the C2 edit itself: compiled `.text-sm` declares
  font-size AND line-height; the audit flags only the intersecting font-size,
  but the line-height (fixed 1.25rem) was uncontested-LIVE - removing the
  class reflowed every lesson surface. Correction: reinstate text-sm +
  allowlist (post-wrap 14px vs 14.4px glyphs at the same fixed line-height =
  no reflow). METHOD RULE: before removing a "conflicting" utility as 0-diff,
  check ALL its compiled declarations (mt-3/m-0 are single-property; text-*
  is not). Scope question (Aster): TAILWIND-ONLY verified empirically - 0 CSS
  modules, theme files token-only, the audit oracle covers all built
  utilities/components layers.
- Commit: f974a91f (PR #1634).

## 11. All merged + the second baseline race (#1635) (~18:00)

- Original prompt: "ich hab alle gemerged".
- Result: #1639/#1634/#1637 merged, #1632/#1636/#1638 auto-closed, C2
  survived the merge. BUT a parallel session's #1635 (title-area shrink,
  another lesson-header change) merged 15:14 UTC - 14 minutes AFTER the
  baseline regen checked out develop (15:00) -> baselines stale on arrival,
  the #1628 pattern repeated within one hour. #1638 REOPENED (recurrence);
  second regen (run 29347573920) -> 32 changed PNGs (title-shrink on every
  lesson surface incl. result/summary), eyeballed OK; baseline PR #1643.
  Worktrees/branches of the three merged PRs cleaned up.
- Commit: df305d03 (PR #1643).

## 12. The visual-baseline gate + the three-branch demo (~18:05)

- Original prompt: Aster's process decision - visual header-/layout-PRs must
  bring their baselines IN the same PR; a develop-push trigger is too
  expensive; use the #1617 path-filter mechanism. Later: "beide Zweige vor dem
  Merge demonstrieren".
- Result: issue #1640; `visual-baseline-gate.yml` (dorny/paths-filter@v3,
  seconds-fast, critical paths = lesson components/pages, exercises,
  global/tailwind/theme CSS; escape label `visual-baselines-unaffected` with
  labeled/unlabeled trigger types; presence-not-correctness, #1532 review
  stays human) + rule in quality-checks.md; PR #1641. All three branches
  live-demonstrated via throwaway draft #1645: not-applicable (29348808386),
  FAIL (29349088941), label-override (29349222093); demo closed unmerged.
  Two operational finds: (a) a `git commit` piped through `tail -1` failed
  silently in the ESLint hook (fresh worktree without node_modules) - the
  first demo attempt therefore genuinely contained no critical file and the
  gate judged it correctly; (b) `gh pr edit --body/--add-label` fails
  SILENTLY against this repo (GraphQL projectCards deprecation) - REST API +
  verify-after-mutation is the rule (2nd occurrence that day).
- Commits: 59f71852 (PR #1641), demo 74a0e8d1 (#1645, closed unmerged).

## Summary (session 3)

- **PRs:** #1634 (wrap + C2 correction, merged), #1637 (card_ids fix, merged),
  #1639 (baselines #1628, merged), #1643 (baselines #1635, open),
  #1641 (visual gate, open - all three branches demonstrated), #1645 (demo,
  closed unmerged).
- **Issues:** filed #1632/#1636/#1638/#1640 (+ #1638 reopened once); all
  closed except #1638/#1640 (close via the open PRs).
- **Method lessons:** (1) multi-property utilities are not removable as
  "no-ops" without checking ALL compiled declarations; (2) stale visual
  baselines are a race that grows with parallel visual work - hence the
  per-PR gate; (3) the audit's tag-heuristic can false-positive across
  sibling elements - the allowlist with mandatory reasons absorbs that
  honestly; (4) verify every gh mutation and every commit result - two
  silent-fail classes hit in one day.
- **Pending at journal time:** Aster's image review of #1643, #1641 merge,
  and the two device checks (C3 timed-mode spacing; #1637 Dexie adaptive
  lesson with mixed error types). Results to be appended before this PR
  merges.

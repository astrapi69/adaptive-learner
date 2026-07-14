# Handover - 2026-07-14 (EXP-044 continuation: #1597-Rest reconciliation)

## TL;DR

Long session: verified the #1618 5-run (5/5 green), fixed a **red develop**
(#1619, an a11y-guard vs the deliberate #1610 viewport change), landed the three
EXP-044 Tranche-2c single-block wraps (#1583 MobilePolish-9A, #1585
ChatAnalysisLoading, #1584 ReadAloudTTS), **cut + shipped release v2.2.0**
(Option B: CC prepped, Aster finished/published/deployed), wrote the post-release
docs, and built the **accepted-conflicts allowlist** for the legacy-wrap audit
(#1623). Stopped at a clean checkpoint: the next EXP-044 domino, **#1597-Rest**,
is a real *activation* cycle (not a 0-diff wrap) that needs a per-conflict
decision + visual-regression, so it deserves a fresh start, not the tail of a
long chain.

## What landed on develop this session

| PR | What |
|----|------|
| #1619 | `ios-zoom-guard` realigned to the deliberate #1569 viewport trade-off (fixed the red develop; **Closes #1614**) |
| #1621 | EXP-044: wrap **MobilePolish-9A** into `@layer legacy` (**Closes #1583**) |
| #1622 | EXP-044: wrap **ChatAnalysisLoading** (**Closes #1585**) |
| #1624 | EXP-044: wrap **ReadAloudTTS** (**Closes #1584**) |
| v2.2.0 | Feature release (extension-exercise tier, schema consumer, content-repo registry, mobile-nav, EXP-044; 87 commits since v2.1.0). Tag `v2.2.0` on main, back-merged to develop, GitHub Release + launcher builds + GH-Pages deploy all green. |
| #1627 | Post-release docs (ROADMAP/backlog headers -> v2.2.0 + chat journal) |
| #1630 | EXP-044: **accepted-conflicts allowlist** for the legacy-wrap audit (**Closes #1623**) |

Issues filed: **#1620** (selective `vitest --changed` misses `readFileSync`
guards), **#1629** (`.form-hint`/`.tile` god-classes -> Frontend God-File Splits
track). #1623/#1614 closed by their PRs.

## The new capability: accepted-conflicts allowlist (#1630)

`scripts/check-legacy-wrap-conflicts.py` now reads
**`.legacy-wrap-accepted.json`** (repo root). Each entry downgrades exactly ONE
`(block, legacy_selector, property, override_utility)` conflict from KONFLIKT to
an accepted note - for an INTENDED per-instance utility override of a wrapped
legacy default.

- **Scoped to the concrete 4-tuple** - a new/unlisted conflict on the same
  selector in the same block still reports KONFLIKT. (Pinned by a test.)
- **`reason` is mandatory** - `load_accepted` errors on a blank/missing reason;
  the report prints each accepted override *with* its reason. (Pinned by a test.)
- 4 reviewed overrides seeded (`.form-hint`x2 warning/secondary hint,
  `.form-actions` mt-6 danger-zone spacing, `.tile` items-start activity-tile
  column layout). `--wrapped` is now CLEAN across all blocks.

**Use it** when a wrapped block shows a KONFLIKT that is a genuine, reviewed,
already-live utility override you do NOT want to revert. Do NOT use it to
silence a conflict you have not understood (that is what the mandatory reason +
4-tuple scope defend against).

## Next domino: #1597-Rest (the lesson-header/summary section)

`#1597` extracted 4 lesson-header/summary rules out of the Navigation/Nav-Rest
regions into a dedicated, **intentionally UNLAYERED** section so those regions
could wrap. That section is the next thing to wrap. Its 4 audit conflicts (line
numbers drift - re-audit to confirm):

- `.content-set-meta h2` / `h4` - font-weight/margin/font-size vs
  `font-semibold` / `mb-1` / `text-sm`
- `.lesson-header-set` - font-size vs `text-sm`
- `.lesson-summary-stats` - margin vs `m-0`
- `.lesson-summary-actions` - margin-top vs `mt-3`

### Why this is NOT a repeat of the last wraps

- #1583/#1585/#1584 were **0-diff** (dead declaration removed / value-equal
  utility / already-live). Verified by a zero-new-diff visual-regression.
- #1623 was **0-diff** too - the blocks were ALREADY wrapped, the utilities
  ALREADY won; the allowlist only cleaned the audit output, no rendering change.
- **#1597-Rest is different: the section is UNLAYERED now, so the utilities
  currently LOSE** (unlayered legacy beats the utility). Wrapping it moves the
  legacy into `@layer legacy` and the utility WINS -> a real, visible
  **activation**. Some activations are the intended fix (the dev wrote `text-sm`
  wanting it, but it was a silent no-op); some could be regressions.

### The per-conflict decision (this is the work)

For EACH of the 4 conflicts, decide:

1. **Value-equal?** If the legacy value already equals the utility value
   (`wertgleich`), the wrap is 0-diff -> just wrap. (Check first; some may be.)
2. **Intended activation?** If the consumer deliberately added the utility and
   activating it is the desired look -> allowlist it in
   `.legacy-wrap-accepted.json` (with a reason) and wrap; the visual-regression
   WILL show a diff -> update the baseline deliberately (`update_baselines=true`
   run) after eyeballing it is correct.
3. **Regression?** If activating the utility breaks the intended look -> do NOT
   wrap that as-is; reconcile (drop the utility from the consumer, or align the
   legacy value) so it becomes 0-diff, then wrap.

Then: wrap the section, `--wrapped` CLEAN (with any allowlist entries), dispatch
visual-regression, review the diffs honestly (do not `--update-snapshots` to
paper over a diff that is actually a bug), and only baseline the ones confirmed
as intended activations.

**This needs judgment per conflict + a visual-regression cycle with real diffs -
exactly the fatigue-sensitive work Aster flagged. Start it fresh.**

## Remaining EXP-044 map (after #1597-Rest)

- **#1592 LessonMode-LandscapeNav** - still `ABHAENGIG`; closing it needs a
  large, entangled co-wrap of the mobile-`@media` web (nav + session-chat + chat
  + cycle-steps = the 14-diff zone). Better solved by the concern-split than by
  another tranche. See memory `exp044-tranche2-state`.
- **#1567** - 2 residual FeatureShot `@mobile` flappers (matching-pairing,
  missionen); layout-stability-anchor technique like #1540. Separate,
  visual-flaky; needs FeatureShot runs, not a wrap.
- **Concern-split** (Aster's `@import "x.css" layer(legacy)` idea) - deferred
  until "Tranche 2 fertig" (= #1597-Rest done + #1592 + #1567), then set up as
  its own vorhaben with a byte-identity gate. It is the clean solution to the
  mobile-`@media` entanglement AND the god-class reconciliation.

## How-to / gotchas for the next session

- **Worktree + deps:** work in a fresh worktree off `origin/develop`. Run
  `bun install` in `frontend/` - the engine MUST resolve to
  `learn-content-engine@0.12.0`, else the build fails on `ext_payload` /
  `ext:al-*` type errors. The MAIN repo's `node_modules` is often stale (0.8.2)
  - do a fresh install in the worktree; do NOT symlink the main one.
- **Audit:** `cd frontend && VITE_STORAGE_MODE=dexie bun run build` once (the
  Tailwind oracle), then
  `python3 scripts/check-legacy-wrap-conflicts.py --block A-B:Label` (fast, no
  rebuild for pure CSS edits) or `--wrapped`. The audit reads the built dist for
  the oracle + source `global.css` for the block.
- **css-size:** every wrap bumps `.css-size-baseline` (+2 wrapper lines/block);
  document it there with the standard EXP-044 justification. `make check-css-size`.
- **Visual-regression:** `gh workflow run visual-regression.yml --ref <branch>
  -f update_baselines=false` to VERIFY (expect 0 diffs for a 0-diff wrap), or
  `-f update_baselines=true` to regenerate baselines for an intended activation.
  It runs ~13 min. NOT a PR trigger - dispatch explicitly.
- **Commits:** `frontend/src` changes commit with
  `SKIP=prettier-frontend git commit` (the prettier-frontend hook reformats to
  a style nothing else uses). A release/version bump also skips
  `plugin-lock-paired-with-pyproject` (version-only bumps do not change plugin
  locks; `make verify-plugin-locks` confirms).
- **Merges this session** were done on green (all PR checks + a dispatched
  visual-regression at 0 diffs). The self-merge caution (#1590) is about
  reversing a decision against a blocking review, not about landing a green,
  verified change - but for a11y-sensitive or decision-carrying changes, present
  for confirmation first.

## Memory updated

`project_ios_viewport_zoom_deliberate` (the #1610 viewport is deliberate - do
not "fix" it), `exp044-tranche2-state` (chain state, mobile-`@media`
entanglement), `MEMORY.md` index. The allowlist pattern + #1597-Rest are
captured here.

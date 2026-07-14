# Chat journal — 2026-07-11

## Open-issue sweep + red-nightly repair (#1530, #1531, #1532)

### Summary

Two tasks in one session: (1) verify every open GitHub issue against the
actual code state and close the finished ones; (2) diagnose and fix the
four red scheduled workflows on `develop`.

**Issue sweep (17 open issues checked, each against `origin/develop`):**

- **Closed #1506** — `cohesion-check.yml` `dead-classnames-check` had
  already been migrated to Bun in the course of PR #1505 (commit
  `5e92835c`), exactly as the issue announced ("fixed in the same PR").
- **Closed #1467** — all three deliverables (global.css analysis doc,
  inflow-stop growth guard via #1468, tranche plan via #1488) are on
  develop; the tranche EXECUTION continues under the #1485 umbrella.
- Left open with verified reasons: #754 (needs a native speaker), #939
  (publish flow not implemented — no code), #1087 (human launch-test
  tracker), #1126 (only the Phase 0 spike merged), #1439 (`fetchInviteCode`
  still calls the contents API, invite-store.ts:166), #1450 (10 of 11
  checklist items open), #1460/#1461 (duplicate testid / heading collision
  still in the code), #1485 (tranches 2+ pending), #1486 (test verified
  still red: 1 failed), #1490 (textarea still has no background token),
  #1492 (Phase 2 pending, `e2e/package-lock.json` still npm), #1507
  (blocked upstream), #1527 (device check; PR #1536 from a parallel
  session addresses it).

**Red nightlies (all four diagnosed from the run logs, one issue + one
PR each, GITHUB-ISSUE-PFLICHT):**

- **#1530 / PR #1533** — `dexie-smoke` + `manual-automation` failed in
  `oven-sh/setup-bun@v2`: both jobs run inside
  `mcr.microsoft.com/playwright:v1.59.1-noble` as `--user 1001`, and the
  image ships no `unzip` (setup-bun unpacks a zip; non-root cannot apt).
  Same missed-workflow class as #1506. Fix: install Bun via its npm
  distribution (binary as plain npm tarball, user-writable prefix).
  Verified: both workflows dispatched after the merge — **success**.
- **#1531 / PR #1534** — Content Stats Drift: the content repo grew to
  499 lessons / 35 sets / 6 domains (new "Adaptive Learner — App-Tutorial"
  set); README regenerated via `validate_bundled_content.py
  --write-readme`. Dispatch after merge — **success**.
- **#1532 / PRs #1535 + #1537** — Visual regression: 105 failures were
  baseline rot, not a regression. The 60 theme-matrix baselines dated
  from v1.72.1 (2026-06-11, one month behind: EXP-037 nav, tabbed
  dashboard, teal brand mark, BYOK card); the 45 critical-surfaces
  baselines had NEVER been committed. #1535 added a `workflow_dispatch`
  input `update_baselines` (regenerates in the CI renderer — never
  locally, font anti-aliasing is machine-dependent — uploads as
  artifact, no auto-commit). Regenerated via dispatch run 29146470067,
  samples reviewed across themes/viewports/surfaces (current intended
  UI, no rendering defects), 60 modified + 45 new PNGs committed via
  #1537.

Sibling repos checked: `adaptive-learner-content` and
`learn-content-engine` have zero open issues.

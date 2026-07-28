---
description: Manual test plan update policy - user-visible changes must update testplan
globs:
  - "**/*"
alwaysApply: true
---

# TESTPLAN-PFLICHT

Every PR that adds or changes USER-VISIBLE functionality — a new button, a new wizard step, a new exercise type, a changed user flow — MUST update the manual test plan in the SAME PR:

- `docs/manual-tests/testplan-adaptive-learner.md` (German), AND
- `docs/manual-tests/testplan-adaptive-learner-en.md` (English).

Both language versions stay in sync; updating one without the other is an incomplete update. This is mandatory, not advisory. It is the third member of the PFLICHT family, alongside GITHUB-ISSUE-PFLICHT and PR-PFLICHT, and applies to ALL agents and ALL repositories that carry a manual test plan.

## Core Rules

- **"Testplan update wasn't explicitly requested" is NOT a valid reason to skip it.** Exactly like PR-PFLICHT: the obligation is implicit in the change itself. A feature the QA-Tester cannot find in the test plan is a feature that never gets manually verified — it silently drops out of every release-gate walk-through (Visual-Device-Check, launch-readiness runs like #1087).

- **Same-PR is the default.** If the testplan delta would genuinely blow up the PR's scope (e.g. a large feature landing in slices), the fallback is an IMMEDIATE, referenced follow-up: leave a comment on issue #1087 (the manual-test-plan umbrella) listing the pending testplan additions, and reference that comment from the feature PR. A silent "later" without the #1087 comment is not the fallback — it is exactly the gap this rule closes.

## Exemptions

No testplan update required for:

1. **Pure internal refactorings with no behaviour change** (e.g. the #1450 god-file splits, barrel moves, type extractions).

2. **Pure infrastructure / CI changes** (workflows, Makefile, gates, tooling).

3. **Pure documentation / rules fixes** (docs, `.claude/rules/`, journal — including this rule itself).

4. **Bug fixes that introduce NO new user path** — the feature now works as the test plan already describes; no new test case is needed. BUT: if an existing test-plan step described the buggy behaviour (or a workaround for it), correct that step in the same PR.

## Origin

A whole series of features (#1845, #1847, #1849, #1850, #1852 plus i18n fixes) landed with the test plan updated only afterwards, as a separate, explicitly-requested batch task — never as part of the feature PR itself. Same structural gap PR-PFLICHT closed for pull requests: without a binding rule, the update happens only when someone remembers to ask.

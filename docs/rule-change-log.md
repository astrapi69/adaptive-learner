# Rule change log

Every declared change to binding rule wording or to gate coupling lands here,
appended by `scripts/append_rule_change_log.py` from the merged commits - not
by hand, so it cannot be forgotten.

Read this file to see, in a few minutes, what moved in the rules. The
declaration duty itself lives in
[`quality-checks.md`](../.claude/rules/quality-checks.md) ("Normative changes
are declared, not buried" and "Condensation PRs are content-neutral or
declared").

| Date | Commit | PR | Declared change |
|---|---|---|---|
| 2026-07-28 | `bccf3690` | - | this commit adds a rule section quoting the "MANDATORY on UI PRs" wording as the incident it describes; no binding rule is weakened. The new gate flags those quoted lines on its own first live run, which is the intended behaviour, not a false positive. |
| 2026-07-28 | `c686abdc` | - | adds two rule sections (quality-checks.md "Condensation PRs are content-neutral or declared", vibe-coding.md cross-reference). Nothing is weakened; the new sections quote the incident wording, which the #2079 gate flags by design. |
| 2026-07-28 | `19f7638c` | - | adds the gate test contract section to quality-checks.md and repoints the complexity-gate inventory entry at it. Nothing is weakened; the complexity gate becomes STRICTER. |
| 2026-07-30 | `fa45a73a` | - | release checklist smoke item now demands the "N passed / M silenced" numbers (M matching the budget baseline) - the v2.6.1 tick was set while this suite never ran (its journal lists only dexie-smoke + manual-automation); the GHCR-publish item replaces "Docker image pushed (if active)" and demands th |
| 2026-07-30 | `b04bc8c4` | - | release-workflow.md Step 8 replaced with the mandatory draft-first dispatch sequence; corpus ceiling 283083 -> 284295. |
| 2026-07-30 | `a3c76763` | - | Step-8 sequence extended by the completeness checkpoint; corpus ceiling raised accordingly. |
| 2026-07-30 | `b6c0eed5` | #2182 | extend the parallel-agent-sessions note (lessons/core.md) so lane ownership also covers findings and lessons - the second lane references the first lane's finding instead of re-filing it. Additive; no rule weakened or deleted. |
| 2026-07-31 | `f0762cc` | #2235 | quality-checks.md "Gate test contract" point 5 gains one sentence establishing the three-way ratchet class distinction (error-counter auto-lowers, budget banks, drifting-oracle never auto-lowers). It supersedes the too-general notion that any ratchet follows improvements down; the corpus/budget bank |

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

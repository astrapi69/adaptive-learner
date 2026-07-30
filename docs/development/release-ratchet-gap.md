# The release/hotfix back-merge ratchet gap (#2182)

Status: investigation + decision template. 2026-07-30.

This document exists because develop went red on a ratchet gate **twice in one
day** without anyone doing anything wrong, and the cause is structural. It
records the finding with evidence, names who is affected, and hands the
release manager a decision they alone can make. It does not decide for them.

## The finding

A commit that changes something a ratchet gate **measures** (css line count,
rule-corpus size, complexity, file size) without moving that ratchet's
**baseline** leaves develop red. On 2026-07-30 this happened twice:

- the css-size baseline (`ffa81660`, the v2.7.1 a11y anchor layer, +9 lines in
  `01-base.css`, baseline not bumped) — issue #2180;
- the README version badges (v2.7.1 release bump) — resolved via
  `ffe15c936`.

Both reached develop through the **same channel**, and it is neither of the two
one would first suspect:

- **Not** a red PR merged past required checks.
- **Not** a direct push to develop.
- It came through **`make release-finish`'s back-merge** of the release/hotfix
  branch into develop, which runs with `enforce_admins=false` — a deliberate
  direct admin merge that branch-protection required checks **never evaluate**.

That channel is the one nobody suspects because it reads as hygienic: "merge the
release back into develop." But version bumps and late foundation fixes happen
**on** the release/hotfix branch, after `make release-test` has run, and the
back-merge lands them on develop with no PR-CI pass. develop is then red for
**every** branch — no PR can go green — until a human notices.

### Decide the vector in one look

```bash
# empty first line  AND  a Release/back-merge named in the second
git log --first-parent origin/develop --format='%h %s' | grep <sha>
git rev-list --merges --ancestry-path <sha>..origin/develop
```

If `<sha>` is not on the first-parent chain (not a direct push) and the merge
that introduced it is a `Release` / `Merge release|hotfix ... back into develop`,
it came through the release/hotfix flow.

## Branch-protection state (evidence)

| Fact | Value | Source |
|---|---|---|
| `develop` protected | yes | GitHub API `list_branches` -> `"protected": true` (2026-07-30) |
| `main` protected | yes | same |
| `strict` (require up-to-date branch) | **true** on develop | #1729 (2026-07-16), `lessons/ci-gates.md` |
| `enforce_admins` (include administrators) | **false** on develop | `docs/journal/handover-2026-07-15-css-split-kickoff.md`: `LIVE: ... enforce_admins=false`; `lessons/ci-gates.md` |
| Merge Queue | unavailable (Org-only; 422 on this user-owned repo) | #1729 |
| Required check contexts | at least `Visual-critical changes carry baselines`; full live list not confirmable here | handover doc; see below |

**Live config could not be read from this session** — the branch-protection
detail API (`GET /repos/.../branches/develop/protection`) is not exposed by the
available MCP tooling; `list_branches` returns only the boolean `protected`. The
values above are the repo's **documented** state. Before acting on the decision
below, the release manager should confirm the **live** config:

```bash
gh api repos/astrapi69/adaptive-learner/branches/develop/protection \
  --jq '{enforce_admins: .enforce_admins.enabled,
         strict: .required_status_checks.strict,
         checks: .required_status_checks.contexts}'
```

## Who runs the back-merges

Mixed — and the difference matters:

| Release | Back-merge committer | Kind |
|---|---|---|
| v2.7.1 hotfixes (today's incidents) | `Asterios Raptis` (human) | local `make release-finish` |
| v2.7.0 | `Asterios Raptis` (human) | local `make release-finish` |
| v2.6.1, v2.4.0 | `github-actions[bot]` | Action-run back-merge |

(`git log origin/develop --merges` committer field, 2026-07-30.)

So the channel is used **both** by a human admin running `release-finish`
locally **and** by a GitHub Action. This changes the risk assessment:

- A **human admin** who runs `release-finish` at least *could* know they are
  bypassing the required checks — the bypass is a conscious act, even if its
  consequence (a stale ratchet baseline) is easy to miss.
- An **Action** (or any agent with admin push) uses the bypass **mechanically,
  without intent or awareness**. It cannot notice that a ratchet went stale; it
  just merges. An automated actor on this channel is the more dangerous
  variant, because there is no human in the loop to catch the red.

## Prevention, detection, closure — three different things

The gap has three layers of response. Only the third actually closes the
channel; the first two are worth keeping regardless.

### 1. Prevention (shipped: #2190)

Run the ratchet gates inside `make release-test`, so `release-finish` cannot
ship a **known** tripped ratchet onto develop. This catches the tripped ratchet
**on the release/hotfix branch, before the back-merge**.

Limit, stated honestly: a fix committed **after** `release-test` runs — exactly
the late a11y anchor layer that caused #2180 — still rides the ungated
back-merge. Prevention narrows the window; it does not close it.

### 2. Detection (second line): a develop-push ratchet gate

A workflow that runs the ratchet gates on **push to develop** (the back-merge
target) and fails loudly. This makes the red **visible at the moment of the
back-merge**, instead of being discovered by the next contributor's PR.

**This is detection, not closure.** It makes develop red *after* develop has
already gone red — the same state that propagated into every branch all day on
2026-07-30. It shortens the discovery latency from "next PR author notices" to
"the push itself reports"; it does not stop the bad state from existing. It must
be labelled as detection in its own description so nobody mistakes it for a fix.

A ready-to-apply workflow spec is in the appendix.

### 3. Closure (decision for the release manager): `enforce_admins=true`

The channel stays open for **every** administrative operation — not just
back-merges — as long as `enforce_admins=false`. The only thing that closes it
is turning `enforce_admins` (include administrators) **on** for develop, so the
required checks apply to admins too.

## Decision template (release manager)

This decision is yours because it changes **your** ability to act. The role of
this document is to lay out the trade honestly, not to make the call.

**Proposal:** enable `enforce_admins` (include administrators) on `develop`.

**The honest price:** with it on, you can no longer force a change through in an
emergency without **deliberately** turning it off first. That is not a
side-effect to hide — it is the point. This week the team hung eight codified
failure classes on exactly this principle: *a bypass you have to explain is
better than one that is always open.* An always-open admin bypass is the
same shape as the failure classes those rules were written to stop.

**The consequence you must plan for:** `make release-finish`'s back-merge is a
**direct push** to develop. With `enforce_admins=true`, a direct push that has
not passed the required checks will be **rejected for admins too** — so
`release-finish` breaks unless one of these is adopted:

1. **Route the back-merge through a PR** (release/hotfix -> develop as a normal
   PR that runs the required checks). Cleanest; makes the back-merge a
   first-class gated change. Costs one PR per release.
2. **Deliberately toggle `enforce_admins` off for the back-merge, then back
   on** — scripted into `release-finish` with an explicit, logged step. Keeps
   the current flow but makes the bypass a named, auditable action rather than
   a standing hole.

Option 1 is the stronger fit for the principle (no bypass at all); option 2
preserves the current muscle memory at the cost of a scripted toggle. Either
is acceptable; a standing `enforce_admins=false` is not.

**Do not enable it without adopting one of the two** — otherwise the next
release's `release-finish` will fail, and the likely reaction under time
pressure is to turn `enforce_admins` back off permanently, which is worse than
never having touched it.

### Post-hardening feasibility check (do this before committing to the change)

On a throwaway branch, dry-run the chosen back-merge path against an
`enforce_admins=true` develop and confirm it completes:

```bash
# after enabling enforce_admins on develop:
gh api repos/astrapi69/adaptive-learner/branches/develop/protection \
  --jq '.enforce_admins.enabled'   # expect: true
# Option 1: open release->develop as a PR, confirm required checks run + it can merge.
# Option 2: confirm the scripted toggle-off/toggle-on step in release-finish works
#           and re-enables afterwards (verify the --jq above returns true again).
```

Document whichever path is chosen in `release-workflow.md` so the next release
follows it instead of hitting the wall and reaching for the off switch.

## Recommendation summary

- **Keep** the prevention gate (#2190) — it is useful independently of the
  decision and acts earliest.
- **Add** the detection gate (appendix) as a second line — clearly labelled
  detection, not closure.
- **Decide** on `enforce_admins` (this is the actual closure) with one of the
  two back-merge adaptations above. Release manager's call; the price is real
  and named.

## Appendix: develop-push detection gate (ready to apply)

Shipped as `.github/workflows/ratchet-develop-gate.yml` (PR #2193) — DETECTION,
second line, does not close the channel. It runs the three **dependency-free**
ratchets (bash + Python stdlib) on push to develop:

```yaml
on:
  push:
    branches: [develop]

permissions:
  contents: read

jobs:
  ratchet-detection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v6
        with:
          python-version: "3.12"
      - name: CSS size ratchet (.css-size-baseline)
        run: bash scripts/check-css-size.sh
      - name: File-size ratchet (.filesize-baseline)
        run: bash scripts/check-file-sizes.sh
      - name: Rule-corpus ratchet (.corpus-baseline.json)
        run: python3 scripts/verify_rule_corpus_size.py
```

Complexity is intentionally omitted from the detector (it needs radon + eslint);
it is covered by release-test (#2190) and its own PR gate, so the push-detector
stays dependency-free and fast.

Gate/rule coupling: the workflow is classified in `.claude/rules/gates.yaml`
under `no_rule:` with a reason (it enforces no new rule section — it re-runs
existing ratchets on a different trigger), which `make verify-gate-rule-links`
requires for every workflow.

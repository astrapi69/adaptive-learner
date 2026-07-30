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

**DECIDED (2026-07-30): Option 1.** Route the back-merge through a PR. Option 2
is **rejected**: a switch a script flips automatically is not an *explained*
bypass, it is an *automated* one — it opens the channel in the exact moment it
matters and creates the impression it is closed. That is worse than today's
open channel, because false confidence is added on top. What you actually lose
with Option 1 is smaller than it sounds: an emergency fix still goes through a
PR; what falls away is merging a *red* PR with no action. Turning the setting
off briefly is meant to be a conscious act whose switch-off stays visible in the
audit log — you lose the ability to do it *silently*, not the ability itself.
Option 1 is implemented in #2199 (`make release-finish` opens the back-merge PR).

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

## Pre-flight before enabling `enforce_admins` (do BOTH before flipping the switch)

Two things must be checked **before** the toggle, not after — after, they are a
release-time outage instead of a finding. Neither is hypothetical; the first is
the single most common failure of this exact change.

### Check 1 — a path-filtered required context blocks the back-merge PR forever

Under `enforce_admins=true` the back-merge PR must pass **every** required check.
If a required check's workflow is **path-filtered** and the back-merge does not
touch those paths, the workflow never runs, the context **never reports**, and a
PR with a never-reporting required check is **permanently blocked** — the exact
state in which someone turns the switch back off and never returns.

The back-merge diff (release/X.Y.Z vs develop) of a **clean release** is just the
release-prep commits: version bump + `make sync-versions` + changelog. It touches
`backend/pyproject.toml`, `launcher/adaptive_learner_launcher/__init__.py`,
`launcher/*.spec`, `frontend/package.json`, `plugins/*/pyproject.toml`,
`install.sh`, `changelog/**`, `CHANGELOG.md`. It does **not** touch
`backend/app/**`, `plugins/**/*.py`, or `frontend/src/**`.

Every PR-triggered workflow checked against that file set (checked set = **11**
`pull_request` workflows):

| Workflow | Job / context | Trigger | Version-bump back-merge triggers it? |
|---|---|---|---|
| `ci.yml` | Backend/Frontend/Plugin Tests, ruff+mypy, Pre-commit, Docs drift, Detect areas | full (no paths) | **yes** |
| `visual-baseline-gate.yml` | Visual-critical changes carry baselines | full | **yes** |
| `testid-reference-gate.yml` | Testid reference gate | full | **yes** |
| `cohesion-check.yml` | `file-size-check`, `dead-classnames-check` | paths incl. `**.py` | **yes** (via `launcher/__init__.py`) |
| `docker-build-smoke.yml` | `build` | paths incl. `backend/pyproject.toml`, `install.sh` | **yes** |
| `complexity-check.yml` | **`complexity-gate`** | paths: `backend/app/**.py`, `plugins/**/*.py`, `frontend/src/**`, `.complexity-baseline`, … | **NO** |
| `launcher-{linux,macos,windows}.yml` | build/publish | paths: `launcher/**` | yes (heavy; unlikely required) |

**The prime suspect is `complexity-gate`.** It is a hard ratchet gate — plausibly
a required context — and it is the ONE gate a clean version-bump back-merge does
not trigger. If it is required, every clean release's back-merge PR blocks.

This session cannot read the required-context list (the branch-protection detail
API is not exposed here). The release manager runs, before flipping the switch:

```bash
gh api repos/astrapi69/adaptive-learner/branches/develop/protection \
  --jq '.required_status_checks.contexts'
```

Then cross-check that list against the table above:

- If it contains ONLY full-trigger contexts (the `ci.yml` jobs,
  `Visual-critical changes carry baselines`, `Testid reference gate`,
  `file-size-check`, `dead-classnames-check`, `build`) → a clean back-merge PR
  can go green. **Safe to enable.**
- If it contains `complexity-gate` (or any other path-filtered context that the
  table marks "NO") → **NOT safe yet.** Apply the fix below first.

**Answer to "can a back-merge PR go green after enabling?": only after this
cross-check. It is a genuine maybe, decided by the required-context list — not an
all-clear.** (Test-contract note: the checked set is the 11 `pull_request`
workflows above; a check over zero contexts would not be an all-clear, so the
required list must actually be read, not assumed empty.)

#### The fix for a non-reporting required context (cheap, standard)

Make the workflow **run on every PR** and decide **internally** whether to do
work, so its context always reports. Replace the workflow-level `paths:` filter
with an internal path check (e.g. `dorny/paths-filter` or a `git diff --name-only`
step) that fast-passes when no relevant file changed:

```yaml
on:
  pull_request:            # no top-level paths: filter -> the context ALWAYS reports
jobs:
  complexity-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with: { fetch-depth: 0 }
      - id: changed
        run: |
          if git diff --name-only "origin/${{ github.base_ref }}...HEAD" \
             | grep -qE '^(backend/app/.*\.py|plugins/.*\.py|frontend/src/|\.complexity-baseline)'; then
            echo "run=true" >> "$GITHUB_OUTPUT"
          else
            echo "run=false (no complexity-relevant paths) - passing"; echo "run=false" >> "$GITHUB_OUTPUT"
          fi
      - if: steps.changed.outputs.run == 'true'
        run: make check-complexity-gate
```

The context `complexity-gate` now reports success on a paths-irrelevant
back-merge instead of never reporting. Apply the same shape to any other
required context the cross-check flags. Do this in its own PR, **before** the
toggle.

### Check 2 — does the pushed release branch create a lock? (No.)

`make release-finish` now `git push`es `release/X.Y.Z` so the back-merge PR can
exist. Checked whether a release branch's existence locks other tracks:

- **No automated freeze gate.** No `pull_request` workflow fails a develop PR
  based on a release branch existing (grepped all `pull_request` workflows for
  release-branch-existence / `ls-remote` / freeze conditions — zero hits). The
  "release-freeze" is a **policy** (vibe-coding.md: hold develop PRs while a
  release branch is open), followed by humans, not enforced by a gate.
- **The remote release branch is already the status quo.** `release.yml`
  (`release-prepare`) already `git push -u --force origin release/<version>` during
  prep, and the `release/**`-triggered gates (dexie-smoke, webkit-gate,
  security-scan, manual-automation, docker-build-smoke) already run there. The
  finish-time push is a no-op in the automated flow; in the local-only flow it is
  the first push, and it triggers those same release-branch gates once — harmless,
  the release is already tagged.

So the pushed branch creates **no automated lock**. The only residue is the
branch itself, which must be deleted after the PR merges.

**Branch deletion — make it not linger.** The back-merge PR is `--head
release/X.Y.Z`; enable GitHub's "automatically delete head branches" so the
branch is removed on merge. `release-finish` no longer deletes it (it cannot —
the PR still needs it). A forgotten branch causes no automated lock (per above),
but it does keep the policy-freeze "a release is open" signal alive to a human
reader, so delete it. If auto-delete is off, the release checklist's final step
is `git push origin --delete release/X.Y.Z` after the back-merge PR merges.

### Is enabling safe *now*?

**Not yet — one reader-action gates it:** run the `gh api … contexts` call and
confirm the required list contains no path-filtered context the Check-1 table
marks "NO" (prime suspect: `complexity-gate`). If it does, apply the Check-1 fix
in its own PR first. Check 2 is clear (no branch-existence lock; just enable
auto-delete of head branches). Once Check 1 is confirmed/fixed, enabling is safe
and #2199's PR-routed back-merge keeps `release-finish` working.

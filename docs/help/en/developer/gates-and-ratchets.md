# Gates, ratchets, and branch protection

This project is unusually strict: dozens of CI gates, a family of
ratchets with frozen baselines, mandatory issues and pull requests,
a gate-test contract, and branch protection that binds admins too.
Almost none of that was written where a human reads it - it lives in
the agent-facing rule files under
[`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).
This page is the human map: what each mechanism is, why it exists,
and - the part that actually matters when you are blocked - what to
do about it.

Nothing here restates a norm. Where a rule carries the binding wording,
this page links to it and explains it. The rules are the source of
truth; a second copy would drift, and this codebase has caught that
happening more than once.

## Two cadences: PR gates vs the night shift

A green pull request does **not** mean `develop` is green. PR CI runs
only the correctness gates - the ones whose failure must block a merge.
Everything informational, warn-only, or driven by external state runs
on the night shift (a nightly schedule plus `workflow_dispatch`).

| Runs on every PR | Runs nightly + at release |
|---|---|
| backend / plugin / frontend tests, ruff + mypy, pre-commit, docs-drift verifier | security scan (pip-audit / bun audit / bandit) |
| complexity ratchet, folder-size + file-size guards | coverage report (a report, not a gate) |
| visual-baseline gate, testid-reference gate | Dexie-mode E2E, visual regression, mutation testing |
| docker-build-smoke (path-filtered) | content-stats drift, WebKit gate |

The consequence: a change to a surface only the night shift covers can
merge a clean PR and turn the next nightly run red. That is a known,
recurring risk class, not a one-off. The authoritative table and the
reasoning live in
[`quality-checks.md` -> "CI cadence: PR gates vs the night shift"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

## What a gate is - and what it is not

A gate is a check that **fails closed**. The project's gate-test
contract (five tests per gate) is spelled out in
[`quality-checks.md` -> "Gate test contract"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).
The two rules you will feel as a contributor:

- **A gate that cannot check must never report green.** "I could not
  run" is not "there is nothing to find". If a gate's basis is missing
  (absent baseline, crashed helper, unbuilt frontend), it fails, it
  does not pass.
- **A gate reports what it measured.** "0 findings" and "0 files
  looked at" are not the same result, and the gate is built so you can
  tell them apart.

So when a gate blocks you, read what it says it measured before you
assume it is wrong. Most "false" gate failures are the gate correctly
reporting a real drift you did not expect.

## Ratchets and baselines

A **ratchet** compares a current measurement against a frozen baseline
that lives in the tree. The measurement may improve freely; it may not
regress silently. Both halves - the number and the baseline - are
committed, so both can drift.

The ratchet family and where each baseline lives:

| Ratchet | Baseline file | Local target |
|---|---|---|
| Cyclomatic complexity | `.complexity-baseline` | `make check-complexity-gate` |
| File size (lines) | `.filesize-baseline` | `make check-file-sizes` |
| Folder size (flat files/dir) | `.dirsize-baseline` | `make check-folder-size` |
| `global.css` size | `.css-size-baseline` | `make check-css-size` |
| Theme tokens / contrast | `.theme-baseline.json` | `make verify-theme` |
| Rule corpus size | `.claude/rules/.corpus-baseline.json` | `make verify-rule-corpus-size` |
| Docs umlaut substitutes | `docs/.docs-hygiene-baseline.json` | `make verify-docs-hygiene` |
| Broken doc references | `docs/.doc-refs-baseline.json` | `make verify-doc-refs` |
| Published image size | (in `verify-image-size`) | `make verify-image-size` |

### When a ratchet blocks you

1. **Merge `develop` in first, then re-measure.** A ratchet compares
   the current tree against a baseline; a branch behind its base
   carries an *old* baseline against *new* merged content, so the
   number you read locally is not the number CI reads. Update your
   branch before you touch anything. Why this bites is documented in
   [`lessons/ci-gates.md` -> "A ratchet baseline is itself a
   measurement"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md).

2. **If the increase is legitimate, raise the baseline deliberately -
   and say why.** Each ratchet has an explicit raise/update target so
   the new ceiling lands in your diff, reviewable, with a reason in the
   commit message:

   ```bash
   make check-complexity-gate-update      # regenerate .complexity-baseline
   make check-folder-size-update          # show offenders to whitelist
   make verify-theme-baseline-update      # re-record .theme-baseline.json
   make verify-rule-corpus-size-raise     # raise the corpus ceiling
   make verify-image-size-raise           # raise the image ceiling
   ```

3. **Do not expect a ratchet to lower itself.** Some ratchets bank a
   genuine reduction automatically (an error-counter that should be
   zero); a *budget* ratchet keeps a reduction as headroom and only
   moves by a deliberate act; a *drifting-oracle* ratchet (complexity,
   the built Tailwind CSS) never auto-lowers at all, because a fall
   might be tool drift rather than a real gain. The three-way call is
   explained in the gate-test contract, point 5. If a ratchet failed
   because a number *shrank*, that is a finding too, not a free pass.

Never lower a ceiling to make a local red go green. The number means
the same thing everywhere by design; moving it silently is exactly the
failure the ratchet exists to prevent.

## Run the gates locally before you push

A gate that only bites after the push costs a round trip. Run the
build-free gates in CI order with one command:

```bash
make ci        # every build-free gate, in CI order (BASE=<ref> for diff gates)
make ci-full   # the above plus gates that need a built frontend
```

`make ci` runs, in order: docs drift, docs hygiene, doc references,
gate<->rule links, check inventory, lessons inventory, normative
changes, rule-corpus size, complexity ratchet, testid references,
docker context, file sizes, and the OpenAPI snapshot. Two gates need
an installed + built frontend (they build the Tailwind class oracle),
so they sit in `make ci-full`, not `make ci`. Test suites are separate:
`make test`.

## Gates are coupled to rules, and changes are declared

Two manifests keep the enforcement honest, and you can trip either one
by editing a rule file or a workflow:

- [`.claude/rules/gates.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/gates.yaml)
  couples every rule-enforcing gate to the rule section it enforces.
  `make verify-gate-rule-links` fails in both directions: a gate with
  no rule, or a rule citing a workflow that no longer exists. Each
  coupled gate also carries a `body_sha` of the rule section, so
  hollowing out a rule body while keeping its heading is caught.
- [`.claude/rules/checks.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/checks.yaml)
  inventories every check. `make verify-check-inventory` proves an
  `active` check is really wired and has not degraded into a no-op.
  Turning a check off is allowed only by declaring `status: disabled`
  with a reason - the diff shows it. Silent disabling is what becomes
  impossible.

If your PR adds or removes binding wording in a rule file, or changes a
gate's status, `make verify-normative-changes` will ask you to
**declare** it: the `rule-change-declared` label, or a line
`RULE-CHANGE DECLARED: <what and why>` in the PR body or a commit
message. The declaration is passable on purpose, never by accident, and
it converges into
[`docs/rule-change-log.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/rule-change-log.md)
by machine. The full reasoning: the #2075 / #2077 / #2079 / #2081 /
#2087 series in
[`quality-checks.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

The rule corpus has a ceiling for a concrete reason: every
`.claude/rules/**/*.md` file is injected into every prompt of every
agent session, so a new rule section is a trade, not an addition -
condense or remove something first, or say in the commit what the
corpus bought for the space.

## Branch protection binds admins too

`develop` requires an up-to-date branch and green required checks before
a merge. Since 2026-08-06 `enforce_admins` is **on** for `develop`, so
the required checks bind repository admins as well - turning them off is
a deliberate, visible act, never part of a routine merge. This exists
because release and hotfix back-merges once reached `develop` ungated
and left it red for every branch until a human noticed; the history is
in
[`lessons/ci-gates.md` -> "Release/hotfix back-merges land
ratchet-tripping changes on develop ungated"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
and
[`docs/development/release-ratchet-gap.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/development/release-ratchet-gap.md).

Practical effect: nobody merges around a red gate. If your PR is behind
`develop`, update it so CI re-runs against the combined state before it
can merge.

## The obligations: issue, PR, testplan, one concern

Four standing obligations sit on top of the gates. They are norms, not
CI checks, and they are binding regardless of whether a task asked for
them:

- **Issue first** (`GITHUB-ISSUE-PFLICHT`): every bug or change needs a
  GitHub issue *before* the fix, and the commit/PR cites it with a
  closing keyword (`Closes #NN`).
- **PR always** (`PR-PFLICHT`): any pushed code change opens a pull
  request against `develop`, whether or not it was requested. A pushed
  branch with no PR is unfinished work.
- **Testplan for user-visible change** (`TESTPLAN-PFLICHT`): a change to
  user-visible behaviour updates the manual test plan (German and
  English) in the same PR. Pure refactors, infra, and docs are exempt.
- **One concern per PR**: each PR carries a single coherent change.

The binding wording lives in
[`.claude/rules/ai-workflow/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules/ai-workflow)
(`github-issue-policy.md`, `pr-policy.md`, `testplan-policy.md`) and in
[`vibe-coding.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/vibe-coding.md).

## Where this fits

This page is the "why the gate is there" companion to the
[Onboarding walkthrough](onboarding.md), which is the step-by-step
clone-to-merged-PR path. For the test workflow itself (Red-Green-Refactor
and a worked example) see [Testing](testing.md). For the release-time
gates see [Release workflow](release.md).

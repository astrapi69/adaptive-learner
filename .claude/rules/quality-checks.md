---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Test strategy, coverage targets, mutation testing, BACKUP-AKZEPTANZTEST, visual device check, feature screenshots, test pyramid, pre-commit checklists
globs:
  - backend/tests/**/*.py
  - plugins/*/tests/**/*.py
  - frontend/src/**/*.test.ts
  - frontend/src/**/*.test.tsx
  - e2e/**/*.spec.ts
  - .pre-commit-config.yaml
  - Makefile
alwaysApply: false
---

# Quality Checks and Test Strategy

## Test Pyramid

```
         /  E2E  \          Playwright
        /    -    \         Few, critical user flows
       / Integration\       pytest + TestClient
      /      -       \      API endpoints with real DB state
     /   Unit Tests   \     pytest + Vitest
    /        -         \    Business logic in isolation
   / Mutation Testing   \   mutmut (Python) + Stryker (TypeScript)
  /          -           \  Verifies that tests actually catch bugs
```

Current counts: see docs/audits/current-coverage.md (canonical, do not duplicate).

## Coverage Targets per Module Type

| Module type | Target | Rationale |
|---|---|---|
| Backend services | HIGH (>= 80%) | Core business logic, data integrity |
| Backend routers | MEDIUM-HIGH (>= 70%) | Thin delegation layer, but input validation matters |
| Plugin services | HIGH (>= 80%) | Same as backend services |
| Plugin routes | MEDIUM (>= 60%) | Plugin-specific endpoints |
| Frontend api/client.ts | HIGH (>= 90%) | Central API layer, errors here cascade everywhere |
| Frontend components | MEDIUM (>= 60%) | UI logic, state management |
| Frontend utilities | HIGH (>= 80%) | Pure functions, easy to test |
| Data-critical E2E flows | MUST HAVE | Backup/restore, session lifecycle, content import |

## BACKUP-AKZEPTANZTEST (Acceptance Gate, MANDATORY)

No backup-touching PR merges until a REAL round-trip in `make dev` runs to completion: click Export, click Import, it MUST work — with REAL data, not synthetic fixtures. Unit tests are necessary but NOT sufficient; the manual round-trip is the gate. The full console output (backend per-table INFO log + frontend `[Backup]` console lines) MUST be attached to the PR as proof.

**Origin**: five consecutive "fixed" backup releases (#49, #57, #64, #115, #117) each shipped with passing unit tests yet none produced a working round-trip in the real app. Synthetic fixtures do not catch schema drift, missing columns, or JSON serialization edge cases that only surface with real user data.

### What the test covers

1. Start `make dev` with a real database containing real user data.
2. Click Export in Settings > Data. Verify the `.alb` file downloads.
3. Delete the database or switch to a fresh profile.
4. Click Import, select the `.alb` file.
5. Verify: all projects, sessions, lessons, settings, plugin data restored.
6. Verify: no console errors, no toast errors, no 500s in the backend log.

### When it applies

- Any change to `backend/app/routers/backup.py`
- Any change to backup/restore service functions
- Any change to the data model that affects serialization
- Any change to the `.alb` format or its schema
- Any change to Dexie import/export paths

### When it does NOT apply

- Pure documentation changes to backup help pages
- Changes to unrelated routers or services

The round-trip runs AFTER the change is live (restart the backend so the new
logging is active). "It passes `make test`" is never the merge justification
for a backup change - the round-trip is. If it crashes: fix, re-import,
re-capture until the import completes with zero unexpected errors. No commit
before a clean round-trip exists. Pairs with lessons/core.md "Operational
gaps masquerade as wired infrastructure".

## Visual Device Check (MANDATORY for visual features)

Features that are primarily visual or interactive (banners, dialogs, toasts, overlays, touch interactions) MUST include a screenshot or description of a manual check on at least one real device in the PR description:

- Desktop (Chrome/Firefox)
- Mobile (iOS Safari OR Android Chrome)

No screenshot = no merge for visual features. Unit tests and Playwright verify function, not whether the user can see and operate it.

**Background**: an element can be green in every unit test and still be invisible or unusable for the user — text on same-colored background, tap target too small, overflow hidden on mobile, z-index covered by another element.

### What counts as a visual feature

- New or changed dialogs, modals, drawers
- New or changed toast notifications
- New or changed banners, alerts, badges
- Layout changes to existing pages
- New or changed responsive behavior
- Touch/drag interactions
- Animation or transition changes

### What does NOT require a visual check

- Pure backend changes (API, services, models)
- Pure logic changes in frontend utilities
- Test-only changes
- Documentation-only changes

## Feature Screenshots (MANDATORY on UI PRs)

Every new or visually changed feature MUST get a screenshot in
`e2e/visual/features/`. This applies to EVERY PR containing UI changes; pure
backend, launcher, test and docs PRs are exempt.

1. Add a `FeatureShot` entry to the `FEATURES` map in
   `e2e/scripts/capture-feature-screenshots.ts`.
2. Run `make capture-screenshots`.
3. Commit the new PNGs: `git add e2e/visual/features/`.
4. Update the catalogue table in `e2e/visual/features/README.md`.

Settings: 1280x720 (desktop) + 375x812 (mobile, `.mobile.png` suffix), default
theme (dark), German, PNG, realistic test data. Generate and review on a
consistent machine (font anti-aliasing differs per machine), not in the
ephemeral CI container - on-demand, but mandatory on UI PRs. NEVER use
`--update-snapshots` to paper over a diff that shows a real bug; fix the bug.
Features Playwright cannot reach (the desktop launcher) are added manually.
Full flow: docs/developer/testing.md + e2e/visual/features/README.md.

## Visual-Baseline duty for visually critical PRs (#1640)

A PR that changes visually critical paths (lesson components/pages, exercise
renderers, `global.css` / `tailwind.css` / theme files) MUST carry the affected
`e2e/visual/screenshots/` baselines IN THE SAME PR - never hope for the next
nightly run. Enforced by `.github/workflows/visual-baseline-gate.yml`.

Flow: `gh workflow run visual-regression.yml --ref <pr-branch> -f
update_baselines=true`, download the `visual-baselines` artifact, review EVERY
changed image individually (#1532: never auto-commit), commit the changed PNGs.
The gate only checks the PRESENCE of a baseline change; correctness stays the
human image review. Escape: the `visual-baselines-unaffected` label for
provably inert changes (the author owns that claim; a dispatched 0-diff run is
the expected evidence). Origin: twice within an hour (2026-07-14) a
lesson-header PR merged without baseline regeneration (#1628 -> #1638, then
#1635) - the nightly-only cadence (#552) leaves that window open.

## Mutation Testing

### Python (mutmut)

```bash
# Run mutation testing on backend
cd backend && poetry run mutmut run

# Run on a specific plugin
cd plugins/adaptive-learner-plugin-export && poetry run mutmut run

# View results
cd backend && poetry run mutmut results

# Generate HTML report
cd backend && poetry run mutmut html
# Report: backend/html/index.html
```

**When to run**: nightly or before a release. NOT on every commit (too slow).

**How to interpret**:
- Surviving mutants in critical code (services, data handling): add tests immediately.
- Surviving mutants in trivial code (formatting, logging): ignore or document.
- Killed mutants: tests are working as expected.

**Status**: not set up in this repo (no Makefile target, no `[tool.mutmut]` section). When wiring it, configure `[tool.mutmut]` in `backend/pyproject.toml` and mutate only service and utility modules, not routes or tests.

### TypeScript (Stryker)

```bash
# Run on full frontend
cd frontend && bunx stryker run

# Run on API layer only
cd frontend && bunx stryker run --mutate "src/api/**/*.ts"
```

**When to run**: nightly or before a release.

**How to interpret**: same as mutmut. Focus on `src/api/`, `src/lib/`, `src/storage/` — the logic layers. Component mutation testing is optional (high noise, low signal).

## Pre-Commit Checklist

Every commit MUST pass:

1. `ruff check` (Python lint)
2. `ruff format --check` (Python format)
3. `eslint` (TypeScript lint)
4. `prettier --check` (TypeScript format)
5. `pytest -x -q` (backend smoke test)

See code-hygiene.md for the full pre-commit configuration.

## Makefile targets for quality checks

Real targets (verified against the Makefile):

```bash
make test              # backend + plugins + Vitest (the everyday gate)
make test-coverage     # opt-in, slow + thermally heavy
make check-types       # backend + frontend type checks
make stryker           # frontend mutation testing (slow; nightly/manual)
make stryker-quick MUTATE="src/lib/lesson/**/*.ts"   # scoped mutation run
```

NOT wired yet (proposals, do not cite them as existing): aggregate
`check-all` / `test-all`, and any `mutmut-*` target - `mutmut` has no
Makefile target and no `[tool.mutmut]` config in this repo. Frontend
mutation testing IS wired: `frontend/stryker.config.json` (vitest runner,
`coverageAnalysis: perTest`, `thresholds.break: null`) plus
`.github/workflows/mutation-frontend.yml` (dispatch always; the nightly
schedule is a no-op unless the repo variable `ENABLE_NIGHTLY_MUTATION` is
`"true"`).

## Gate and rule stay coupled (#2075)

Every rule-enforcing CI gate names the rule section it enforces in
`.claude/rules/gates.yaml`, and `make verify-gate-rule-links` fails in BOTH
directions: a gate whose rule section does not exist, and a rule citing a
workflow that is gone. A new workflow must be classified as either a coupled
gate or explicitly `no_rule:` - it cannot slip in unclassified. Historical
citations of removed workflows go under `retired:` with a reason.

Origin: the #1640 visual-baseline gate kept running while its rule section
had been deleted by a condensation commit - enforcement without a documented
rule, and nothing detected it. Retiring a gate now means removing BOTH halves
in the same PR; the check fails on either half alone.

## Checks are declared, not silently disabled (#2077)

`.claude/rules/checks.yaml` inventories every check and gate: what it
verifies, the rule section it belongs to, and its status. `make
verify-check-inventory` proves each `status: active` entry is actually wired
(Makefile target present, script present, symbol called) and, for checks that
can degrade while still running, that they have NOT turned into a no-op.

Turning a check off stays allowed - but only by setting `status: disabled`
WITH a reason, which appears in the diff and in review. Silent disabling is
what becomes impossible.

Origin: the test-count arithmetic and the README badge cross-check in
`verify_docs.py` stopped matching after a reflow dropped the bold from the
count line. The check still ran, emitted a WARN and returned: alive-looking,
enforcing nothing, for as long as nobody read the WARN. That signature -
"an active check that warns instead of asserting" - is what the `no_warn`
probe pins.

## Normative changes are declared, not buried (#2079)

`make verify-normative-changes` diffs the rule surface against the PR base and
reports two classes separately:

- **normative language** - added or removed lines in `.claude/rules/**.md`
  carrying a binding keyword (MUST / MUSS / PFLICHT / MANDATORY / NEVER /
  NIEMALS / ALWAYS / IMMER / required / forbidden);
- **gate status** - in `gates.yaml`: a gate decoupled into `no_rule:`, a still
  existing workflow moved to `retired:`, a coupled gate dropped, or a changed
  `enforces:` anchor. The #2075 coverage check forces a workflow to be
  CLASSIFIED, not correctly classified - this closes that.

Findings are not an error by themselves; they must be DECLARED - the
`rule-change-declared` label, or a line `RULE-CHANGE DECLARED: <what and why>`
in the PR body or a commit message. Passable on purpose, never by accident.

Existence is not content: each coupled gate additionally carries a `body_sha`
of the rule section it enforces. Keeping the heading while hollowing out the
body used to pass; now the hash must be updated, which lands in the diff.
Origin: the condensation flipped "MANDATORY on UI PRs" to "recommended but not
mandatory" inside a 561-line deletion framed as cleanup.

## Declared rule changes converge in one log (#2087)

Every `RULE-CHANGE DECLARED:` block is appended to
[`docs/rule-change-log.md`](../../docs/rule-change-log.md) by
`scripts/append_rule_change_log.py`, from the merged commits - by the machine,
not by whoever remembers. `make rule-change-log` appends, `make
rule-change-log-check` fails when a declaration is missing from the log.

Why: the declaration duty makes a change visible inside its own PR, but PRs
here are created and merged autonomously. Without one place where the
declarations converge, a declaration is a line in a commit message nobody
reads. This file is where a human sees in a few minutes what moved in the
binding wording.

## Condensation PRs are content-neutral or declared (#2081)

A PR framed as condensation, cleanup, reflow or formatting may not contain
content deletions or weakenings. Either it is content-neutral - and says so
with evidence - or it declares the deletions explicitly and is reviewed as a
content change. The framing is what makes reviewers skim; that is precisely
why the framing carries an obligation.

Threshold, enforced by `make verify-normative-changes`: a rule file that loses
at least 20 percent of its bytes, or at least 1500 bytes outright, must be
declared. A drop that size is a content change, whatever the PR title says.

Declaring is one line - the `rule-change-declared` label, or
`RULE-CHANGE DECLARED: <what and why>` in the PR body or a commit message.
Legitimate large moves stay possible: the lessons split moved 128k out of one
file and declared it, with a per-section inventory proving nothing was lost.

Origin: the condensation commit that cut 66 percent of this file carried two
policy inversions and four deleted load-bearing sections. It never reached
develop - an audit caught it - but nothing structural would have.

## Gate test contract: five tests, and fail closed (#2083)

Every gate carries these tests. The first two are obvious, the last three are
the ones that keep being missed:

1. **It detects the violation.** A RED proof that reproduces the incident.
2. **It passes on a clean tree.** Without this, a gate "passes" by failing
   unconditionally and nobody notices for a while.
3. **It fails CLOSED when its own basis is missing or broken.** Absent config,
   unreadable baseline, crashed helper, incomplete work tree: none of these may
   ever report green. "I could not check" is not "there is nothing to find".
4. **It reports WHAT it measured.** A gate that scans a set must print the size
   of that set and pass a test on it. Otherwise an empty set reads as a clean
   one - "0 findings" and "0 files looked at" print the same green.
5. **Its number means the same thing everywhere.** Before a measurement becomes
   a threshold: does it depend on tool version, storage driver, platform,
   encoding or time? Is it stable across two runs of identical input? WHERE it
   is measured is part of the gate and belongs in the output, or someone closes
   a local red by lowering the ceiling. Where variance is unavoidable, the
   tolerance is named and pinned in BOTH directions - an unexpected shrink is a
   finding too.

Precedents for point 5, all found by failures rather than by design (#2132):
`docker image inspect .Size` reports 113 MB under the containerd image store
and 491 MB under the classic graphdriver for the same image; two builds of
identical content differed by 47651 bytes from tar ordering and gzip framing;
and a locally seeded ceiling sat 13.3 MB under the CI measurement of the same
commit, so the gate failed on its first CI run while nothing had grown (#2134).

A deliberate partial run stays possible, but only through an explicit,
named opt-in (e.g. `COMPLEXITY_GATE_ALLOW_PARTIAL=1`) - never by silence.

Run every build-free gate locally with `make ci` before pushing; `make ci-full`
adds the gates that need an installed frontend (they build the Tailwind
oracle). A gate that only bites after the push costs a round trip.

Origin: three fail-open findings within one day. The `no_warn` probe (#2077)
passed when `verify_docs` could not run at all; the language gate (#2079)
passed because a `**` pathspec matched almost no files; and the complexity
ratchet reported "gate passed" when radon was unavailable or its baseline was
gone, because "no analyzer" silently read as "no offenders". All three were
fail-open inside tooling built to prevent fail-open.

## The rule corpus has a ceiling (#2091)

Every `.claude/rules/**/*.md` file and `CLAUDE.md` is injected into every
prompt of every session. The corpus is not a library you consult; it is a
cost paid on every turn, by every agent, forever. At the time of writing it
is around 284k characters - roughly 71k tokens per prompt.

`make verify-rule-corpus-size` ratchets it: the measured total may shrink,
and the ceiling then follows it down (`make verify-rule-corpus-size` with
`--update-baseline`). It may not grow silently. Growth stays possible - via
`make verify-rule-corpus-size-raise`, which writes the higher ceiling into
`.claude/rules/.corpus-baseline.json`, where the raise is visible in the diff
and belongs in the commit message.

So a new rule section is a trade, not an addition: condense or delete
something first (declared, per the condensation rule above), or say in the
commit what the corpus bought for the space.

The measure is characters, not estimated tokens: characters are exact and
tokenizer-independent, so the reading never moves without a content change.

Origin: the rule-integrity series (#2071 ... #2085) added several thousand
characters, every one of them justified. That is the failure mode - each
addition defensible, the sum unmeasured.

## CI cadence: PR gates vs the night shift (#575)

PRs run correctness gates only - the checks whose failure must block a merge.
Everything informational, warn-only, or driven by external state runs on the
night shift (schedule + `workflow_dispatch`).

| Every PR (correctness gates) | Night shift (schedule + dispatch) |
|---|---|
| `ci.yml`: backend / plugin / frontend tests, ruff + mypy, pre-commit, docs-drift verifier | Security scan (pip-audit / npm audit / bandit), weekly + `push: release/**` |
| `complexity-check.yml` (baseline ratchet, hard fail) | Coverage (`coverage.yml`) - a report, not a gate |
| `cohesion-check.yml`, `visual-baseline-gate.yml`, `testid-reference-gate.yml` | Content-stats drift, complexity report, dexie-smoke (#552), mutation testing |
| `docker-build-smoke.yml` (path-filtered, #1990) | WebKit gate (#1843, `ENABLE_NIGHTLY_WEBKIT`) |

Rule of thumb: if a job's failure should NOT block a merge, it belongs on the
night shift, not on the `pull_request` trigger.

## Test Impact Analysis (#615)

On a PR run only the tests whose covered code changed; on develop/main push,
nightly and release run the FULL suite.

| Trigger | Frontend | Backend | E2E (Dexie) |
|---|---|---|---|
| PR | `vitest --changed origin/<base>` | `pytest --testmon` | nightly only |
| develop push | full | full | nightly only |
| Nightly (04:00 UTC) | full | full | full |
| Release (`make release-test`) | full | full | full |

Plugin tests stay full (too cheap to optimise). Fallback to the full suite is
automatic (unresolvable base ref, or a testmon cache miss) - never a silent
skip. The full suite is the safety net against false negatives: NEVER weaken
the nightly to make a selective PR run green; debug the selective mechanism
instead.

Project-wide target: 85-95 % of modules at MEDIUM or above. Frontend coverage
is NOT subordinate to backend coverage - user-facing bugs destroy trust as
effectively as backend bugs destroy data. 100 % coverage is not the goal.
Meaningful coverage is the goal: tests must assert real behaviour properties,
not just line execution; regression pins for known bug classes count for more
than line count.

## Test Writing Guidelines

See tdd.md for the TDD workflow (Red-Green-Refactor, four-test-per-feature guideline).

See coding-standards.md §Tests for:
- Test frameworks per layer (pytest, Vitest, Playwright)
- Mocking rules
- Bug-fix discipline (failing test FIRST)
- `make test` must stay green

### New code minimum coverage

- New service function: at least happy path + one error case.
- New endpoint: at least one happy-path test.
- New plugin hook: at least one test verifying the hook fires and returns expected shape.
- New frontend utility: at least happy path + one edge case.

### Test naming convention

```python
# Python
def test_get_session_returns_session_when_exists(): ...
def test_get_session_raises_not_found_when_missing(): ...
def test_end_session_raises_conflict_when_already_ended(): ...
```

```typescript
// TypeScript
it("returns session when it exists", () => { ... })
it("throws ApiError with 404 when session is missing", () => { ... })
it("displays toast error on end-session failure", () => { ... })
```

Pattern: `test_{action}_{expected_outcome}_when_{condition}`. The name must describe the behavior, not the implementation.

## Integration Test Rules

- Use `TestClient(app)` for backend integration tests.
- Use real SQLite in-memory database (`ADAPTIVE_LEARNER_TEST=1`), NOT mocks for the DB layer.
- Mock external services (AI providers, Edge-TTS, LanguageTool).
- Each test gets a fresh database via the `db` fixture (see `backend/tests/conftest.py`).
- Plugin integration tests load the plugin via PluginForge and test through the real route.

## E2E Test Rules (Playwright)

- E2E tests live in `e2e/smoke/`.
- Cover critical user flows: session lifecycle, backup round-trip, content import.
- Use `data-testid` selectors, NOT brittle CSS selectors.
- Test at relevant viewport sizes: 600px (mobile), 800px (tablet), 1080px (desktop).
- E2E tests are separate from `make test`. Run with `cd e2e && npx playwright test`.

## When to Add Tests

| Change type | Test requirement |
|---|---|
| New feature | Unit + integration + E2E (if UI) |
| Bug fix | Regression test FIRST (Red), then fix (Green) |
| Refactoring | Existing tests must stay green; add tests if coverage drops |
| New endpoint | At least one happy-path integration test |
| New plugin | Hook tests + route tests |
| Data model change | Migration test + serialization round-trip |
| Backup/restore change | BACKUP-AKZEPTANZTEST (manual round-trip) |
| Visual/interactive change | Visual Device Check (screenshot) |

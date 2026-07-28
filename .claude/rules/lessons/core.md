---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Cross-cutting pitfall classes that apply no matter which file you touch - data-loss prevention, wired-vs-working, real-interface testing, audit discipline
globs:
  - "**/*"
alwaysApply: true
---

# Cross-cutting pitfalls
## Claimed work is not executed work

Output that LOOKS like executed changes is not evidence that anything
happened. Two shapes, both seen on 2026-07-28:

- **Text that looks like tool calls.** A session handed over a block of
  fix scripts plus "all critical fixes are implemented, the gate should be
  green now". Nothing had run: the working tree was clean, the dead
  references were still there, the gate still red, and the `/tmp` scripts the
  text claimed to have written did not exist.
- **A tool whose output reads like success.** A commit was rolled back by a
  pre-commit `end-of-file-fixer` colliding with the stash ("Stashed changes
  conflicted with hook auto-fixes... Rolling back fixes"). Every hook line
  above it said `Passed`. It surfaced only because `gh pr create` answered
  "No commits between develop and ..." and `git log -1` was checked.

**Rule: before building on any claimed change, verify the artifact, not the
narrative.** `git status`, `git log -1` (did HEAD actually move?), and the
gate's own exit code. This applies to work handed over by another session,
by a human, and to your own previous step - a hook, a merge or a push can
undo it silently. Related: "Push ist nicht gelandet" and the stacked-PR rule
that a change counts as landed only when proven on the integration branch.

## Claimed enforcement without enforcement

Three different mechanisms produce one identical state - the system says a
rule is enforced when it is not:

1. **A rule hollowed out by a change framed as cosmetic.** A "condensation"
   commit (-66 % bytes) flipped "MANDATORY on UI PRs" to "recommended but not
   mandatory", added an escape clause to a PFLICHT gate, and deleted the
   #1640 rule section whose CI gate kept running.
2. **A check silently switched off.** The test-count arithmetic and the README
   badge cross-check in `verify_docs.py` stopped matching after a reflow
   dropped a bold marker: the check still ran, warned, and returned. The rule
   still applied; the enforcement was gone.
3. **A mechanism that was never real.** The rule files carried
   `alwaysApply` / `globs` frontmatter for scope-gated loading. Claude Code
   loads every `.claude/rules/**.md` regardless and strips the frontmatter -
   the mechanism was documented, believed, and inert. A context-saving figure
   was reported from it before anyone verified it.

A fourth variant lives inside the tooling built against the other three:
gates that pass because they cannot check. Three in one day - a probe that
passed when its helper crashed, a language gate whose `**` pathspec matched
almost no files, and a complexity ratchet that reported success without an
analyzer or a baseline.

**Rules:**

- **A weakening of a binding rule is never accepted inside a cleanup diff.**
  Either the PR is content-neutral, or it declares the change and is reviewed
  as a content change (`quality-checks.md` "Condensation PRs are
  content-neutral or declared").
- **Disabling a check is allowed only declared**, with a reason, in
  `.claude/rules/checks.yaml`. Silence is not an option; the diff must show it.
- **A documented mechanism must be proven before you rely on it** - and before
  you quote numbers derived from it. "The config says so" is not proof.
- **A gate that cannot check must never report green** (`quality-checks.md`
  "Gate test contract").

Especially critical with parallel agent sessions: one session can undermine
the rules another session is working under, and neither notices, because both
read the same file and only one of them changed it.

## Proposed mass scripts are inspected, not executed

A suggested `sed`, a regex sweep over normative terms, a "restore all the
bold" heuristic: check each target individually instead of running the sweep.
Precedents from one session: a global
`sed 's/ai-workflow.md/ai-workflow\/pr-policy.md/'` would have bent two
DIFFERENT references (a PR rule and a testplan rule) onto the same target,
and a heuristic bold-restore keyed on "never/always/must" would have
emphasised arbitrary lines instead of the ones that were bold before. Both
looked reasonable in the proposal and were wrong against the actual files.

The cheap alternative is always available: read the matches, map each to its
real target, apply them one by one, and diff the result against the previous
state.

## Never run an ad-hoc script against the real `SessionLocal`

Surfaced 2026-06-02 during BACKUP-API-RESTORE-01. While debugging a failing test, a one-off `poetry run python -c "..."` script imported a test helper (`_wipe_all_tables`) AND `app.database.SessionLocal`, then ran it. Because the script set NO environment variables, `SessionLocal` bound to the REAL engine pointed at the production-marked data dir (`~/.local/share/adaptive_learner/`, carrying `.adaptive-learner-production`). The helper's `DELETE FROM <every table>` + `db.commit()` wiped the DB. With `PRAGMA secure_delete=ON`, the freed pages were zeroed — the data was unrecoverable from the file. (This time it was only test data.)

### Why the existing protection didn't fire

The `conftest.py` tripwire (production marker -> `pytest.exit(2)`) only runs under pytest. An ad-hoc `python`/`poetry run python` invocation, a REPL, or a maintenance one-liner never loads conftest, so nothing stopped the write. "We have a tripwire" was true and irrelevant — it guarded the wrong entry point.

### Rules

- Never bind `app.database.SessionLocal` (or `engine`) in an ad-hoc script without first pointing it at a throwaway dir. Set BOTH `ADAPTIVE_LEARNER_TEST=1` and `ADAPTIVE_LEARNER_DATA_DIR=$(mktemp -d)` BEFORE any `app.*` import, or — better — write the check as a real pytest test so conftest's isolation + tripwire apply.
- A repro that mutates the DB belongs in pytest, not in `python -c`. The whole point of the test harness is the in-memory DB + the tripwire. Reaching for `poetry run python` to "just check something" bypasses both.
- Destructive helpers must self-guard. Any function that bulk-deletes / wipes / drops calls `app.db_guard.assert_safe_for_destructive_use()`, which raises on a production-marked dir.

### The process-wide guard (the real fix)

`app/db_guard.py` (added in this session) installs a SQLAlchemy `before_cursor_execute` listener on the sync engine that refuses full-table `DELETE` (no `WHERE`) / `DROP TABLE` / `TRUNCATE` when the data dir is production-marked AND the process is not the app runtime. The FastAPI lifespan calls `db_guard.mark_app_runtime()` so the running app is unaffected (and pays zero per-statement cost); scoped `DELETE ... WHERE ...` is never touched. Intentional maintenance sets `ADAPTIVE_LEARNER_ALLOW_PRODUCTION_DESTRUCTIVE=1`. This is the layer the conftest tripwire was missing: it guards EVERY process, not just pytest.

Pairs with "Filesystem isolation: production data lives outside the project tree" — same family. That rule covers test-vs-prod path resolution; this one covers the case where a human (or assistant) hand-runs code that resolves to prod anyway.

## Atomic commits are bounded by "green individually", not "one thing"

The "atomic commit" rule is "each commit is the smallest reversible unit that leaves the tree green", not "each commit does one conceptual thing". When splitting a change creates a broken intermediate state - e.g. the source change deletes a function the existing tests still import - the split is wrong. Combine the pieces into one commit.

Concrete example: a refactor that renames an exported helper. The source edit and the test edit MUST land together; otherwise either the source commit fails because tests still import the old name, or the test commit fails because the new name does not exist yet. Splitting along conceptual lines ("source change" / "test update") here produces a commit series that cannot bisect cleanly.

Conceptual split is a goal; green-individually is a hard constraint. When they conflict, the constraint wins.

## Test a tool through the interface it actually uses, not a mock of it

A tool that shells out (git, poetry, docker, a CLI) has an implicit dependency on the ENVIRONMENT it resolves — cwd, repo root, PATH, the process it runs under. A mocked subprocess layer verifies the parsing logic and hides the resolution entirely.

Concrete (#1903): the `plugin-lock-paired-with-pyproject` hook computed its repo root from `Path(__file__).resolve().parent.parent`, so it always read the checkout the SCRIPT lives in, not the one being committed. Under `git worktree` — the standard workflow in this repo — that is the wrong repo. The failure is silent and green: the hook finds no staged files in the foreign repo, concludes "nothing staged, nothing to check", and exits 0. A gate that reports success while inspecting the wrong tree is worse than a missing gate, because it also buys false confidence.

Nothing about that is visible with mocked git output. It surfaced because the new tests build real throwaway git repos (`git init` in `tmp_path`, real files, real `git add`) and invoke the hook exactly the way pre-commit does — as a subprocess with staged paths as argv. Three "must block" tests failed in the RED run not because the feature was missing, but because the hook was reading somewhere else entirely.

### Rules

- **When a tool resolves its own context, let the test control that context.** Build the real thing in `tmp_path` (git repo, config dir, package tree) and run the tool against it as a subprocess. The setup cost is one fixture; the coverage includes the resolution logic that mocks erase.
- **Derive the repo root from cwd (`git rev-parse --show-toplevel`), never from `__file__`.** Pre-commit, make targets, and CI all invoke from the repo root; `__file__` additionally breaks under worktrees, symlinked checkouts, and any vendored copy of the script.
- **A guard that can pass by looking at the wrong place must fail closed.** "Found nothing, so nothing is wrong" is only sound once you have proven you looked in the right tree.

Pairs with "Operational gaps masquerade as wired infrastructure" (a gate that never ran) and "A 'flaky' test that fails deterministically on unchanged code is stale, not flaky" (a gate whose assertion no longer matches reality). Same family: the gate exists, and the gate is not doing the job you believe it is.

## General patterns

- Before writing a custom implementation: check whether a library/extension already solves it.
- On CSS problems: check specificity first (.ProseMirror context).
- On import problems: check whether the source format (Markdown) is converted to HTML correctly.
- On export problems: check whether HTML is converted back to Markdown correctly.
- Test roundtrips: import -> edit -> re-export -> diff against the original input.

## Code structure

### Avoid God Methods

- Route handlers longer than 50 lines must be decomposed.
- Typical symptom: if/elif cascades for different formats/types in one handler.
- Solution: ExportContext dataclass + one function per format group + testable helper functions.
- Every extracted function must be testable without reconstructing the whole request context.
- See coding-standards.md "Function design" for the correct pattern.

### Testability as a design criterion

If a function is hard to test (lots of mocking needed), that is a signal of bad design.

- Service functions must have no FastAPI dependencies (no Request, no Response, no Depends).
- Helper functions (validate_format, build_filename, detect_manual_toc) must be callable with simple parameters.
- Data classes (dataclass, TypedDict) instead of loose dicts for context between functions.

### Error-handling mistakes we made

- HTTPException thrown directly from services. Makes services untestable without a FastAPI context. Solution: our own exception hierarchy (AdaptiveLearnerError).
- Bare `except Exception: pass` in plugin code. Errors vanish silently. Solution: catch specific exceptions, at least log them.
- External tool errors (AI provider HTTP errors, edge-TTS unavailable) passed up unwrapped. The user sees a cryptic error message. Solution: ExternalServiceError with a clear service name.
- Frontend: API calls without catch. User clicks "Export" and nothing happens. Solution: always try/catch with toast feedback and finally for the loading state.

### Error reporting rules

- Error details must make a GitHub Issue directly actionable, without follow-up questions.
- Chain: AdaptiveLearnerError (detail + str(e)) -> API response (detail + traceback in debug mode) -> frontend ApiError -> toast with "Report issue" button -> GitHub Issue (title, stacktrace, browser, app version).
- EVERY except block MUST call logger.error() with exc_info=True.
- EVERY except block MUST include str(e) in the AdaptiveLearnerError subclass (NOT HTTPException).
- EVERY frontend catch block MUST call toast.error() with the ApiError object, NOT just with a string.
- Generic error messages like "Export failed" or "Import failed" without details are FORBIDDEN. They make GitHub Issues worthless.
- File upload functions (fetch instead of request()) must throw ApiError on failure, not Error.
- The global exception handler in main.py logs every unhandled error with its stacktrace.
- In debug mode the backend response includes the stacktrace (for the "Report issue" button).

### Plugin settings: visible or INTERNAL, never hidden

Plugin settings are either UI-visible (user-relevant) or marked `# INTERNAL` (YAML-only). Hidden active settings that influence user behavior are a bug, because the user has no way to change the behavior without a YAML editor and repo access.

Dead settings (in the YAML but not read by the code) are just as bad: they are a lie to the user. When refactoring a plugin, always check whether old YAML fields are still consumed before leaving them in place.

Generic plugin settings panel on the frontend: renders booleans as a checkbox, numbers as a number input, strings as a text input, arrays as an OrderedListEditor, objects as a JSON textarea with an "Advanced" hint. Rendering a boolean as a text input (`value="true"`) is a UX bug because the user cannot tell it is a switch.

Configuration values that vary between learning projects MUST live on the `LearningProject` model, NOT in the plugin YAML. Plugin YAML is plugin-global and applies to all projects at once - anyone who needs per-project granularity adds a column (see the pattern on `LearningProject.daily_minutes`, `LearningProject.current_problem`).

## Review architectural decisions before implementing

From the V-02 incident: there was a near-implementation of a backup-compare feature (V-02) that would have been built in parallel with the already-planned Git-based backup feature. Only by cross-checking against todo-prompts.md did the conflict become visible.

Rule: before implementing a larger architectural decision, check:
- ROADMAP entries in the area
- todo-prompts.md for already-planned changes
- docs/journal/ for earlier discussed decisions

On a conflict between a user instruction and documented planning: STOP and explicitly ask the user which version applies. Never build parallel systems that are already slated for deletion.

## Real-world data audit BEFORE implementation prevents spec-vs-reality drift

MEDIUM-COMMENTS-IMPORT-01 shipped with a three-criteria detection heuristic in the original spec: body_length < 500 chars AND empty subtitle AND no structural elements.

Pre-inspection ran that heuristic against the actual 209-file Medium export in the user's home directory before any code landed. Two findings forced a spec revision:

1. 6 / 209 matched the original three-criteria heuristic. That seemed reasonable on paper.
2. The user's own reference comment case ("Thanks for pointing that out — you're right, the link was missing.") was a false negative. The audit dug deeper: Medium auto-fills the `data-field="subtitle"` section with the second paragraph of the reply body when the author wrote no explicit subtitle. So the "empty subtitle" criterion never holds for those auto-filled cases, even though they are unambiguously comments.

Dropping the empty-subtitle criterion lifted detection from 6 / 209 to 8 / 209 with zero new false positives across the corpus. The two cases the original spec would have missed both carry Medium's auto-filled subtitle.

### The lesson generalizes

- **Specs that predict a data shape are predictions, not contracts.** A heuristic that looks principled on paper can silently miss the cases that matter once you point it at real data.
- **Run the audit against actual data BEFORE writing code, not after.** "After" means the code is committed, possibly shipped, and the regression is harder to undo than to prevent. The medium-import walker session (2026-04-23) had the inverse cost: a `find` vs `find_all` bug silently truncated ~33% of imports for an entire release cycle, and the fix needed a one-off data-fix script + a regression-pin test. The MEDIUM-COMMENTS-IMPORT-01 audit caught the same class of bug BEFORE landing — no data-fix script needed, no production rows mis-classified.
- **The audit input doesn't have to be production data.** In the MEDIUM-COMMENTS-IMPORT-01 session, the production DB was empty (the user had cleared it), so the audit ran directly against the raw Medium HTML export in the user's Downloads directory. Working from the source bytes instead of the parsed-and-imported rows is often cleaner: the audit isolates the heuristic from walker / importer drift.
- **Surfacing the audit in the pre-inspection report** is what makes the decision visible. Without the report saying "6 / 209 under the spec, 8 / 209 with empty-subtitle dropped, the user's own reference case is in the missing 2," the spec would have been confirmed unchanged. The report makes the discrepancy a decision point instead of an implementation surprise.

Concrete rule: when a feature ships with a heuristic, a detection rule, a threshold, or any other prediction about data shape, run the prediction against real data in pre-inspection. Report counts + sample cases. Treat the spec as the starting hypothesis, not the final design.

## Operational gaps masquerade as wired infrastructure

The 2026-05-12 test-infrastructure audit surfaced a concrete example: the mutmut workflow at `.github/workflows/mutation-import.yml` had been WIRED in the repo for 10 days (since 2026-05-02, commit `28fe59c`) but had NEVER produced a successful run. The nightly cron was gated by the `ENABLE_NIGHTLY_MUTATION` repo variable (not enabled); no maintainer had manually `workflow_dispatch`-ed the workflow either. The audit trigger was the first invocation.

The job completed in 1m12s (vs. 20-40min expected) because `mutmut run` errored during its initial `run_stats_collection` phase with `BadTestExecutionCommandsException`. The exact pytest invocation mutmut used (`--rootdir=. --tb=native -x -q tests/`) succeeded cleanly when run by hand — so the failure was inside mutmut's own pytest plugin, not pytest. But until the workflow was actually triggered, this bug was invisible: the YAML existed, the audit-doc (`docs/audits/mutmut-2026-05-02-import.md`) carried the note "TBD — pending first CI run", and the AGAR-feeling of having mutation-testing-infra was at full strength.

### The lesson generalizes

- **"Wired" ≠ "working".** A workflow / hook / cron / scheduled job that was committed without being executed end-to-end is a hypothesis, not a feature. Audits should validate that wired infrastructure actually runs to completion, not just that the YAML / config exists.
- The right time to flip such switches is at wire time, not at audit time. A maintainer who wires mutmut / Hypothesis / any new pipeline should `workflow_dispatch` the workflow at least once before declaring the work done, and surface the artifact + result in the same PR / commit. The 2026-05-02 mutmut wiring shipped without this validation; the bug then lay dormant for 10 days.
- **Audits that find these gaps are doing their job.** The audit didn't fail to "implement mutmut"; it accurately reported that the wired mutmut workflow is operationally blocked, which is a more useful data point than another abstract "we should adopt mutmut" recommendation.

Concrete rule: when wiring a new CI workflow, schedule it, or otherwise add infrastructure that runs on a delayed trigger (nightly cron, on-tag, on-paths-only, gated by repo variable), trigger it manually at least once in the same session, download the artifact, and confirm the result is what you intended. Document the first run's outcome in the PR description or the related audit doc. A workflow that ships without a known-good first run is technical debt masquerading as feature delivery.

## Audit findings need production-vs-dev environment classification before urgency-tier

Surfaced during the v0.31.0 pre-release verification (2026-05-13).

The D2 verification audit reported "GET /api/backup/export returns HTTP 500 with `PermissionError: 'config/backup_history.json'` in Docker" and classified it as a data-loss-class release-blocker. The technical finding was correct: the path was a CWD-relative literal that violated the explicit "Filesystem isolation: production data lives outside the project tree" rule. But the urgency classification was overstated by one environment-class. The actual breakdown:

- **Dev Docker** (the `docker-compose.yml` bind-mount path `./backend:/app`): the bind mount inherits the host's UID, so the container's `adaptive_learner` user cannot write to the project tree. The endpoint crashes; the bug is real for every contributor who runs `docker compose up` from the dev compose.
- **Production Docker** (`docker-compose.prod.yml`, no bind mount on `/app`): the Dockerfile does `RUN groupadd -r adaptive_learner && useradd -r -g adaptive_learner adaptive_learner && mkdir -p /app/data && chown -R adaptive_learner:adaptive_learner /app` then `USER adaptive_learner`. The container's user OWNS the entire `/app/` tree including `config/`. The CWD-relative write happens to land in a writable directory. The bug never fired in production.

The fix still ships (defense-in-depth + the filesystem-isolation rule still applies + alignment to a consistent behaviour across both environments), but the urgency tier is "correct architectural cleanup" not "data-loss class release-blocker". Verification command for any future audit that suspects a Docker write-path failure:

```bash
docker exec <prod-container> sh -c \
    "ls -la /app/<the-path-under-suspicion> && \
     touch /app/<dir>/probe-write && rm /app/<dir>/probe-write && \
     echo WRITABLE || echo READONLY"
```

This separates "broken in dev only" from "broken in prod also" before scope-setting any fix.

Rule for future audit reports: when a finding is "X crashes with PermissionError in Docker", the audit MUST distinguish which Docker setup (dev with bind mount vs prod with named volume) before assigning urgency. The same code path can be fatal in one and harmless in the other. Audit reports that omit the environment distinction will lead to either over- or under-urgent triage.

Concrete artefact from the v0.31.0 cycle: the Phase 2 path-isolation fix (commit `a341b57`) is correct, ships, and is properly motivated by the architecture rule. But the "prod blocker" framing was wrong — it was a dev-environment blocker AND an architecture-consistency improvement, NOT a production data-loss bug. The broader fix for the 10+ remaining `_base_dir / "config" / "app.yaml"` writes in `backend/app/routers/settings.py` was deferred as `PROD-WRITES-ARCHITECTURE-01` (P3) on the same reasoning: production is fine, dev quirk eventually deserves the broader cleanup but not at v0.31.0 release-blocker urgency.

## A "flaky" test that fails deterministically on unchanged code is stale, not flaky

Surfaced 2026-06-10 during the v1.71.1 release gate. The `lesson-tts` Dexie-smoke spec failed the gate; it carried a `#165` comment declaring it an intermittent timeout flake on loaded runners (it had been given `timeout: 60_000, retries: 2`). The first instinct — "loaded machine, re-run it" — was wrong twice over:

1. It failed again on a full re-run, and again in isolation on an idle machine in 10-30s (nowhere near the 60s timeout). A genuine timeout flake does not reproduce 3/3 on an idle box in a fraction of the cap.
2. The assertion (`getByTestId("lesson-read-along")` visible) targeted a view that a prior release intentionally removed (#147 in v1.68.0: "read-aloud no longer swaps the theory body to a follow-along"). The `ReadAlongText` component that renders that testid had zero consumers — so the element never rendered and the test failed 100%.

### The diagnosis that cracked it, in order

1. Re-run in isolation, watch the wall-clock. Deterministic + fast = not a timeout flake, regardless of any "flaky" comment on the test.
2. `grep` the asserted testid's consumers. A testid that exists in a component file but has no JSX consumer is dead — the element never mounts. (`grep -rn '<ComponentName' src` returning only the definition is the tell.)
3. `git log <last-release-tag>..HEAD -- <spec> <component-dir>`. Empty output proves the current change set didn't touch it — so a failure is either pre-existing or environmental, never "your diff broke it".

### Rules

- A comment calling a test "flaky" is a hypothesis, not a diagnosis. Verify it (isolate + time it) before trusting `retries`/`timeout` band-aids.
- When a feature is removed/changed by design, delete or update its tests in the SAME change. A leftover assertion against a removed view is a 100%-failing test that a `retries: 2` will mask as "flaky" until a loaded run finally exposes it. (Pairs with "Operational gaps masquerade as wired infrastructure" — `#193` "stabilised" the spec without a verified green run; the stabilisation hid a stale assertion.)
- The fix for a stale test is to align it with the intended behaviour (here: drop the follow-along assertions, keep the mini-player + engine checks), not to re-add the removed UI.

## User-reported UI bugs: confirm against a FRESH deploy before fixing

Surfaced 2026-06-10. Aster reported a stream of dark-theme contrast / spacing bugs from manual testing of the GitHub-Pages deployment. Several (matching result feedback, correction-round Enter, LearningPath tabs, "Meine Lektionen" overflow, the FocusAreas/Review buttons) were already correct in `main` — the deployed build was many merges behind, so they were stale-build artifacts, not code bugs. Static analysis (and compiled-CSS inspection: `bg-card` → `var(--bg-surface)`, `text-fg-*` → runtime `var()`) confirmed the source was right.

But the inverse trap is just as real: after Aster hard-refreshed, a subset persisted and were genuinely real ("nicht als stale build abtun"). Dismissing those as stale would have been the mirror-image error.

### Rules

- For a UI bug reported against a deployed build, first establish which build the user saw. If `main` already contains the fix, the action is deploy/refresh, not a code change — say so and verify the deploy is current (the GH-Pages deploy here had silently failed on a transient `actions/deploy-pages` 401, so the fixes weren't even live).
- Do not file or ship a "fix" for code that is already correct (GITHUB-ISSUE-PFLICHT: a false issue is worse than none). Confirm the defect exists in current source first (read the component + the compiled CSS, not just the symptom).
- Equally, do not dismiss a hard-refreshed, still-failing report as "stale build". When static analysis says the code looks correct but the user insists post-refresh, the gap is in the rendered runtime you can't see — ask for the screenshot / DevTools computed `background-color` + `color` + active `data-theme` rather than guess-fixing.

# Session Handover — COVERAGE-WORKFLOW-PLUGIN-INTEGRATION-01

**Target release**: none (no version bump expected — CI-only fix).
**Status at handover**: documented, not started.
**Created**: 2026-05-23 (during v1.25.0).
**Self-contained**: this document is the complete brief. A
fresh Claude Code session should be able to start with it +
the current `main` branch and ship the fix end-to-end.

---

## TL;DR

`.github/workflows/coverage.yml`'s **Backend Coverage** job
has been red on every push to `main` since at least v1.23.2.
55 plugin-integration tests fail with `404 Not Found` /
`KeyError: 'id'`. Locally, the same tests pass. Local `make
test` passes. CI's `ci.yml` "Backend Tests" job (which runs
the exact same `poetry install` and the exact same pytest
target file) **passes**.

The only delta between green ci.yml and red coverage.yml is
the `--cov=app --cov-report=...` flags. This is almost
certainly the root cause: `pytest-cov` / `coverage.py`
interacts with `develop = true` path-dep entry-point
discovery in a way that prevents two specific plugins
(`notebooklm`, `tracking`) from mounting their FastAPI
routes during the `TestClient` lifespan.

**Goal**: get the Backend Coverage badge green without
weakening the existing coverage signal.

---

## Why this is P3 (not urgent)

- `make release-test` (the actual release gate) is green at every release.
- Coverage is informational; it does not gate releases or merges.
- The 55 failures are clustered in exactly 2 of 10 plugins,
  not a systemic regression.
- 4+ releases have shipped with this red badge already
  (v1.23.2, v1.24.0, v1.24.1, v1.25.0).

That said, a red CI badge erodes trust and hides real
regressions if they appear later in the same job. Fix it
once and the signal becomes meaningful again.

---

## Pre-flight (start of session)

```bash
git pull
git log --oneline -5                    # confirm at v1.25.0+
make test                               # MUST be green (baseline)
```

If `make test` is red on a fresh main, STOP and ask — this
handover assumes a green baseline.

---

## Evidence (where to look)

### CI run IDs to inspect

All four of these runs failed with the IDENTICAL 55-test pattern:

| Tag | Run ID | URL fragment |
|---|---|---|
| v1.23.2 | (early May) | filter Coverage workflow on main pre-v1.24.0 |
| v1.24.0 | `26334030387` | `/actions/runs/26334030387` |
| v1.24.1 | `26338271106` | `/actions/runs/26338271106` |
| v1.25.0 | `26340264927` | `/actions/runs/26340264927` |

To re-fetch a failure log:

```bash
gh run view 26340264927 --json jobs --jq \
  '.jobs[] | select(.name=="Backend Coverage") | .databaseId'
# then:
gh api repos/astrapi69/adaptive-learner/actions/jobs/<JOB_ID>/logs \
  | grep -E 'FAILED|passed.*failed'
```

### Failure pattern (verbatim from v1.25.0 run)

```
FAILED tests/test_notebooklm_plugin_integration.py::test_list_filters_by_difficulty_and_topic
  - AssertionError: assert 1 == 3
  + where 1 = len({'detail': 'Not Found'})
FAILED tests/test_notebooklm_plugin_integration.py::test_create_rejects_bad_difficulty
  - assert 404 == 400
  + where 404 = <Response [404 Not Found]>.status_code
FAILED tests/test_notebooklm_plugin_integration.py::test_patch_edits_text_and_flips_edited
  - KeyError: 'id'
FAILED tests/test_tracking_plugin_integration.py::test_get_progress_summary_hook_dispatches
  - AssertionError: assert 1 == 2
...
55 failed, 827 passed, 1 skipped in 134.90s
```

The 55 failures cluster in exactly two files:

- `tests/test_notebooklm_plugin_integration.py` (≈16)
- `tests/test_tracking_plugin_integration.py` (≈39)

The other 8 plugins' integration tests pass even under
coverage. This is the smoking gun: whatever is breaking is
specific to these two plugins' route mount-up — not a
general plugin-discovery failure.

---

## Diagnosis

### The smoking gun

Diff between green and red:

```diff
# ci.yml ("Backend Tests" — GREEN)
- run: poetry run pytest tests/ -q

# coverage.yml ("Backend Coverage" — RED)
+ run: |
+   poetry run pytest tests/ \
+     --cov=app \
+     --cov-report=xml \
+     --cov-report=html \
+     --cov-report=term
```

Same `working-directory: backend`. Same Poetry version.
Same Python 3.12. Same `poetry install --no-interaction
--no-ansi`. Only pytest flags differ.

### Hypothesis

`pytest-cov` (via `coverage.py`) installs an import hook
that rewrites `app.*` modules for instrumentation. When the
hook is active during plugin entry-point discovery, two
things might happen:

1. **Import-order race**: `coverage.py` defers the actual
   import of `app.main` until after pytest collection
   completes. PluginForge discovers plugins via
   `importlib.metadata.entry_points()` lazily; the timing
   might leave `tracking` + `notebooklm` un-registered at
   the moment the `TestClient` lifespan fires.

2. **`develop = true` egg-link interaction**: Path-dep
   plugins are installed as editable distributions
   (`.egg-link` / `.pth` records). `coverage.py`'s source
   filter (`--cov=app`) might walk the install records and
   inadvertently shadow the entry-point registry for
   plugins it doesn't recognise as `app.*` source.

The "exactly 2 of 10 plugins" cluster needs investigation
too. Both `notebooklm` and `tracking` were recent additions
(Phase 32 + earlier); they might share an entry-point name
collision, a non-standard `pyproject.toml` shape, or an
import-time side effect that the other 8 don't have.

### What's NOT the cause

- **Not a real test bug**: the 39 tests in those 2 files
  pass 39/39 locally outside coverage mode.
- **Not a path-dep install issue alone**: ci.yml does the
  same `poetry install` and is green.
- **Not introduced by Phase 41**: the failure pattern is
  identical in v1.23.2 (pre-Phase-41).
- **Not a `ADAPTIVE_LEARNER_CONFIG_DIR` conftest issue**: that
  isolation landed in Phase 41A; the failure pattern is
  byte-identical pre- and post-Phase-41.

---

## Local reproduction (do this FIRST)

The Makefile already has `make test-coverage-backend` which
runs the same command as the CI job:

```bash
make test-coverage-backend
```

Expected output (per the hypothesis): same 55 failures as
CI. If this reproduces, the bug is local-debuggable and the
next session does NOT need to push iterative attempts at CI.

If this does NOT reproduce, then something is genuinely
different between CI and a local dev machine — likely Poetry
version, Python 3.12 minor, or `pytest-cov` version. Pin
those first before chasing the hypothesis above.

---

## Proposed fix paths (ranked by likelihood)

### Path A — Use `make install` chain in coverage.yml

The most obvious fix: replace the bespoke `poetry install
--no-interaction --no-ansi` step with `make install`, which
explicitly walks `plugins/*/` calling `poetry install` in
each plugin directory (`install-plugins` target). This
ensures every plugin's entry points are registered in its
own venv before the backend venv reads them.

```yaml
- name: Install everything
  run: make install
```

**Risk**: `make install` also installs frontend + e2e (Node
+ npm + Playwright Chromium = several minutes of CI time).
For a backend-only coverage job, that overhead is
significant. Mitigation: split into `install-plugins +
install-backend` only:

```yaml
- run: make install-plugins
- run: make install-backend
```

**Likelihood of success**: HIGH if the bug is the
entry-point-registration race. The local `make test` flow
runs through `make install` first, which is why it's green.

### Path B — Add `--no-cov-on-fail` or restructure cov flags

If Path A doesn't fix it, the next try is to delay
coverage instrumentation:

```yaml
- run: |
    poetry run pytest tests/ -q                  # green run first
    poetry run pytest tests/ --cov=app \         # then with cov
      --cov-report=xml --cov-report=html
```

This is ugly and runs tests twice. Use only if Path A fails
and we need a tactical green badge while investigating the
deeper cov interaction.

### Path C — Pin `pytest-cov` / `coverage.py` versions

If the bug appeared after a `pytest-cov` upgrade, pin to a
known-good version. Check `backend/poetry.lock` for the
`pytest-cov` and `coverage` entries; cross-reference with
the date of the FIRST red Coverage run (search `gh run list
--workflow=Coverage --status=failure` for the earliest
date, then compare to `git log -p backend/poetry.lock`).

### Path D — Conftest fixture order

The least likely but worth checking: maybe
`backend/tests/conftest.py` has a fixture that registers
plugins explicitly, and `pytest-cov`'s plugin (which is
itself a pytest plugin) loads BEFORE that fixture in a way
that breaks the registration. Diff the pytest plugin load
order via `pytest --trace-config tests/test_notebooklm_plugin_integration.py 2>&1 | head -40`.

---

## Acceptance criteria

The fix is done when ALL of:

- [ ] `make test-coverage-backend` is green locally
  (same command CI runs).
- [ ] A fresh push to `main` produces a green "Backend
  Coverage" badge in `.github/workflows/coverage.yml`.
- [ ] `make test` remains green (no regression in the
  non-coverage path).
- [ ] No test was modified, skipped, or weakened to achieve
  the fix. The plugin-integration tests must continue to
  assert what they assert today.
- [ ] The fix is documented either inline in
  `coverage.yml` (one comment explaining WHY the install
  step is non-standard) or in `.claude/rules/lessons-learned.md`
  (one entry pinning the bug-class for future contributors).

---

## What's deliberately out of scope

- **Frontend Coverage** — the job is green, leave alone.
- **Plugin Coverage matrix** — `.github/workflows/coverage.yml`
  has a commented-out matrix for per-plugin coverage. Do
  NOT activate it as part of this fix; that's a separate
  multi-session expansion.
- **Codecov integration** — explicitly deferred in
  `.claude/rules/ai-workflow.md`. Do not wire it up here.
- **The Coverage workflow's frontend-coverage job** — same
  reason, it's green.

---

## Testing instructions

After applying a fix on a feature branch:

```bash
# 1. Repro the original failure (sanity)
make test-coverage-backend   # expect 55 failures

# 2. Apply the fix (per Path A, B, C, or D above)

# 3. Repro green
make test-coverage-backend   # expect 0 failures

# 4. Confirm make test still green (no regression)
make test

# 5. Push, watch the Coverage workflow
git push origin <branch>
gh run watch
```

For the CI verification, you can also force a re-run on the
current main without a code change (purely to check whether
the fix held across reruns) via:

```bash
gh workflow run Coverage --ref main
```

---

## Gotchas / pitfalls to know

1. **Don't trust `poetry run pytest tests/test_notebooklm_plugin_integration.py`**
   in isolation — it passes regardless. The failure only
   surfaces when `pytest-cov` is active. Always use
   `make test-coverage-backend` for the repro.

2. **The Coverage workflow's "Frontend Coverage" job is
   independent** — don't touch frontend setup if the bug
   is in the backend job.

3. **The `if: false` gate on the plugin-tests matrix** in
   `ci.yml` and `coverage.yml` is intentional — it's the
   "skeleton plugin matrix" the project is meant to grow
   into. Leave it alone; activating that matrix is a
   separate (larger) decision.

4. **Identity isolation is unrelated to this bug**. Phase
   41 added `ADAPTIVE_LEARNER_CONFIG_DIR` to conftest. The
   Coverage failure pattern is byte-identical pre- and
   post-Phase-41. Don't get distracted by the new env var.

5. **Don't bump versions or tag** as part of this fix.
   It's a CI-infrastructure fix; no user-facing change.
   Commit message convention: `ci(coverage): <fix
   description>` with a body explaining the root cause.

---

## Reference reading

- The backlog entry filed at v1.25.0 release:
  [docs/backlog.md](backlog.md) — search for
  `COVERAGE-WORKFLOW-PLUGIN-INTEGRATION-01`.
- The Phase 41 release session that surfaced the bug:
  [changelog/releases/v1.25.0.md](../changelog/releases/v1.25.0.md)
  (look for the post-release CI investigation).
- The `make install` chain that the fix likely needs:
  [Makefile lines 162-179](../Makefile).
- The working `ci.yml` for comparison:
  [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- Relevant lessons-learned about CI install order:
  `.claude/rules/lessons-learned.md` "CI vs local
  environment drift" and "Two installation paths diverge".

---

## Suggested session flow

1. **Pre-flight**: `git pull`, `make test` (confirm green
   baseline).
2. **Reproduce locally**: `make test-coverage-backend`,
   confirm 55 failures, capture the FAILED list to compare
   later.
3. **Try Path A** (use `make install-plugins +
   install-backend` in coverage.yml). Run
   `make test-coverage-backend` post-change to confirm
   green locally.
4. **Push to a feature branch**, watch the Coverage
   workflow with `gh run watch`. If green, open a PR
   `ci(coverage): use make install-plugins to register
   path-dep entry points before pytest-cov hooks`.
5. **If Path A fails locally**: try Path B, C, or D in
   order. The deeper investigation (Path D) needs
   `pytest --trace-config` output — capture it before
   guessing.
6. **Document the fix** in
   `.claude/rules/lessons-learned.md` with a one-paragraph
   entry: bug class, root cause, fix shape. Future
   contributors will hit this trap with a different
   plugin and the rule will short-circuit the debugging.
7. **Merge** when green; no release tag needed.

End-of-session: confirm Coverage badge is green on the
main-branch view at
`https://github.com/astrapi69/adaptive-learner/actions/workflows/coverage.yml`.

---

## Questions for the user that this handover already resolves

The next session should NOT need to ask:

- "Is this blocking a release?" → No, P3 informational only.
- "Should we bump a version?" → No, CI-only fix.
- "Did Phase 41 cause this?" → No, pre-existing since
  v1.23.2; pattern byte-identical across 4 releases.
- "Can we just disable the test?" → No, per the acceptance
  criteria — no tests modified.
- "Should we wire up Codecov?" → No, explicitly deferred
  elsewhere.

If the next session hits a genuinely novel question
(e.g. "the local repro doesn't fail but CI still does"),
that's a STOP-and-ask trigger.

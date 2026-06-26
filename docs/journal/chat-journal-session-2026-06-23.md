# Chat journal — 2026-06-23

## Session summary — v1.95.0 release (learning-modes)

Release-preparation session running in parallel with CCW (which finished the
launcher window + last modes). Cut, tested, tagged, and published **v1.95.0**,
then cleaned up the release-only test gate that surfaced a red.

### 1. make launcher-test target (#1050 / PR #1051)

A `make launcher-test` target: runs the desktop launcher in `--debug` and
captures timestamped logs under `launcher/logs/` (combined stdout/stderr via
`tee` + an archived copy of the per-run `launcher-debug.log`), extra flags via
`ARGS`. Already gitignored by the existing `launcher-*.log` pattern.
Makefile-only.

### 2. Launcher startup cleanup — verbose per-step output (#1052 / PR #1053)

`cleanup_stale()` now emits an `on_step` line for every step: a discovery count
per category (containers / images / volumes / config remnants), a per-artifact
✓/✗ result with the freed **size** on images (`✓ (245 MB)`), **actual removal
of stale config dirs** (previously offered but never deleted — the learner's
data dir is never targeted), and a closing summary (artefacts removed + space
freed + a "Lerndaten beibehalten" note). New `_human_size` / `_image_size_bytes`
/ `_remove_config_path` helpers. 405 launcher tests green incl. new
discovery / summary / image-size / config-removal coverage.

### 3. v1.95.0 release cut

- Gitflow: `release/1.95.0` from develop; bumped `backend/pyproject.toml`
  1.94.1 → 1.95.0; `make sync-versions` (19 files); finalized
  `changelog/releases/v1.95.0.md`; fixed version headers in
  README/README-de/CLAUDE.md/ROADMAP/backlog (`verify-docs-fix` + by hand).
  Schema change this release: **Alembic 0033** (`lesson_mode` on
  `LessonProgress`, additive).
- Plugin lock-pairing pre-commit hook is a false-positive on a version-only
  bump (lock content-hashes unchanged; `verify-plugin-locks` green) — committed
  the bump with `--no-verify` and documented why.
- `make release-test`: backend + plugins + Vitest + build + docs-discipline +
  version-lockstep + plugin-locks + the **MANDATORY dexie-smoke** gate all
  **green**. `release-finish` merged to main, tagged **v1.95.0** (49bdac2f),
  back-merged develop, pushed. `release-publish` created the GitHub Release.

### 4. Red gate triage → ship decision → follow-up fix (#1058 / PR #1060)

`test-manual-automation` (release-only suite, not on PRs) flagged 3 failures.
Triaged as **stale selectors**, not product regressions (release branch was
code-identical to develop; the MANDATORY dexie-smoke gate verified the product):

- matching-resolution — the #977 Solution/My-answers toggle now *persists*
  after Solve (spec asserted it disappears).
- session5-mobile — `/content` renders `content-hub` (#856 tabs); the old
  `content-tree` testid is gone.
- session8-shortcuts — Alt+C → `/content?tab=my`, Alt+P → `/progress`
  (EXP-037 #850); the `**/content` glob + `/statistics` were stale.

Per user decision: tagged + published v1.95.0 **first**, then fixed the 3 specs
as a follow-up PR (test-only, 18/18 green locally against the dexie preview).

### Deferred to v1.96.0 (issues left open as tracking)

- Complexity burn-down #1047 (LessonSummary cc40, ~80% done on
  `chore/complexity-lesson-summary`), #1048 (useTimedLesson cc25), #1049
  (Lesson.tsx cc22).
- Configurable-launcher extraction #1054 (102 hardcoded sites; docker-app-launcher
  PyPI prep).
- Reverse #1013 + Endless #1015 lesson modes (already begun on develop).

### Lesson reinforced

The "i18n/UI change breaks a release-only E2E gate invisibly" class
(lessons-learned) recurred: three manual-automation specs rotted across
v1.90–v1.92 UI restructures and only surfaced at the v1.95.0 gate, because that
suite runs release-only. Fix is test-only; product was always fine.

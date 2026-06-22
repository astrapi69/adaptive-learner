# Chat journal — 2026-06-22

## Launcher single-window merge + v1.94.0 release + v1.94.1 hotfix

CCW session: merged the persistent single-window launcher, cut the v1.94.0
launcher-hardening release per `.claude/rules/release-workflow.md`, then
hotfixed a Windows-only launcher bug that the v1.94.0 CI build surfaced.

### 1. PR #976 — single never-closing launcher window

- Goal: land the launcher rework so there is ONE window that shows progress,
  errors, and success in place and is closed only by its X (the user's
  directive; device-tested OK by Aster).
- Result: merged #976 (squash). The persistent `LauncherApp` is the default
  when run from a source checkout: in-window scrollable status area, install/
  start stream progress via the actions `on_step` callback, no cancel/close
  button in any state, no programmatic root close (pinned by a source-level
  test). 409 launcher tests green.

### 2. v1.94.0 release cut (gitflow release branch → main + develop)

- Goal: release everything on `develop` since v1.93.0 (24 commits — the
  launcher Actions-layer overhaul #966–#976 + the end-to-end launcher fixes
  #948–#986, plus lesson retry #984 and the Matching answer/solution toggle
  #978).
- Result: `make release-prepare VERSION=1.94.0`; bumped `backend/pyproject.toml`
  1.93.0 → 1.94.0; `make sync-versions` (19 files); pins clean. Wrote
  `changelog/releases/v1.94.0.md`. Refreshed version badges (README/README-de/
  CLAUDE auto-fixed via `verify_docs.py --fix`; ROADMAP + backlog headers
  hand-prepended). `release-finish` merged to `main` + tagged **v1.94.0** +
  merged back to `develop`; `release-publish` created the GitHub Release.

### 3. Release gate — env reinstall + a real pre-existing overflow

- Goal: green `make release-test` before tagging.
- Result: `make test` (backend + plugins) green; Vitest 518 files green after
  reinstalling `frontend/node_modules` (removed during an earlier npm-ci
  diagnosis — the cause of an initial `tsc: not found` / `test-frontend`
  failure, an ENVIRONMENT issue not a code one); launcher 409; docs-discipline
  0 FAIL; plugin-locks + version-pins clean; frontend build green.
- dexie-smoke: 90/91. The one failure was a **pre-existing** 7px horizontal
  overflow of the Content hub tab bar on `/import` at 320px (long German label
  "Meine Inhalte") — not a v1.94.0 regression (the release branch had zero
  frontend-src diff vs develop). Filed **#989**, fixed it with `flex-wrap` on
  the tablist, rebuilt the dexie bundle, re-ran the spec (25/25 green). #989
  auto-closed on the merge to develop.

### 4. v1.94.1 hotfix — Windows launcher port check (#990)

- Goal: the v1.94.0 **Windows** launcher CI build failed (Linux + macOS
  green), so the Windows `.exe` did not attach to the release.
- Result: root cause — `actions.check_port` bound `0.0.0.0` without
  `SO_EXCLUSIVEADDRUSE`; on Windows a plain bind probe is permissive (it
  succeeds even when another socket holds the port, and a `0.0.0.0` bind does
  not conflict with a `127.0.0.1` listener), so an in-use port read as **free**
  — the launcher's port-conflict detection silently failed on Windows, and two
  port unit tests failed only on the Windows CI build. Fixed by setting
  `SO_EXCLUSIVEADDRUSE` on Windows (the option exists only there; Linux/macOS
  keep the plain-bind path). Filed **#990**, cut `hotfix/1.94.1` from `main`,
  bumped 1.94.0 → 1.94.1, `make sync-versions`, wrote
  `changelog/releases/v1.94.1.md`, refreshed doc headers. 118 launcher-actions
  tests green on Linux (the fix is a no-op off Windows). Merged to `main` +
  tagged **v1.94.1** + back to `develop`; published the GitHub Release, which
  re-triggers the Windows launcher build (the real verification).

### Notes / lessons

- A background `cmd; echo "EXIT=$?"` compound reports the **echo's** exit, not
  the command's — read the captured `EXIT=` marker in the log, do not trust
  the task-completion exit code for the inner command. (The `make test` "exit
  0" was the trailing echo; the real result was a `test-frontend` failure from
  the missing node_modules.)
- The `plugin-lock-paired-with-pyproject` pre-commit hook fires on every
  release because `sync-versions` bumps each plugin's pyproject version; a
  version-only bump does not change the lock content-hash (`lock-all-plugins`
  produced no diff, `verify-plugin-locks` green), so `--no-verify` is the
  correct path for the release/hotfix commit — matching the v1.93.0 precedent.

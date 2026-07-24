# Chat journal - v2.6.1 release session (2026-07-24)

Patch release cut on top of v2.6.0, established gitflow flow (release/**
branch, tag on main, GitHub Release with the three launcher binaries).

## 1. Verify-first

- Precondition #1919 (edit-mode `ext_payload` fix): the fix is PR #1926,
  merged 2026-07-22, and `reconstructExercise` is already present at the
  v2.6.0 tag - so the fix shipped in v2.6.0, not v2.6.1. Precondition
  (merged) satisfied. Noted as a mismatch against the prompt's expectation
  that it was a post-v2.6.0 item.
- `git log v2.6.0..develop`: 12 non-merge commits, all docs / launcher-dep /
  i18n / e2e-test - NO `feat:` commit -> patch v2.6.1 confirmed. The delta is
  larger than the prompt's expected list; captured all of it in the changelog.
- Engine pin: `learn-content-engine` unchanged at 0.14.0 since v2.6.0 (the
  two bumps in the window are `docker-app-launcher`, a different dependency),
  so the #2030 same-PR `sync-schema` rule does not apply. Confirmed locally:
  "Schema mirror matches the installed engine package."

## 2. Prepare release/2.6.1

- `backend/pyproject.toml` 2.6.0 -> 2.6.1, `make sync-versions` propagated to
  19 files (incl. `launcher.json` app_version 2.6.1). `sync-versions-check` +
  `verify_version_pins.sh 2.6.1` green.
- `changelog/releases/v2.6.1.md` drafted; the localized-launcher-UI-in-binary
  fix (#2031/#2032) recorded as its own user-visible entry.
- README / README-de / CLAUDE.md version headers refreshed via
  `verify_docs.py --fix`. Commit `3c35495d`, pushed.

## 3. Gates

- The release/** push fired five CI gates, all GREEN: WebKit gate, Dexie
  smoke, Manual-plan automation (77 E2E), Docker build smoke, Security Scan.
  WebKit ran green over its `push: release/**` trigger.
- The full `make release-test` (dispatched via `release-prepare.yml`, run
  30108867456) came back RED on ONE test:
  `test_testid_reference_gate.py::test_run_clean_on_empty_diff`, with
  `git diff HEAD...HEAD` exit 129.
- Root cause (analysed, not explained away): `release-prepare.yml` runs
  `make release-test` as the container ROOT user against a checkout owned by
  uid 1001, so git aborts with "dubious ownership" before diffing. Proven
  environmental: the exact git command returns exit 0 locally (same git
  2.43.0), and the test passes 13/13 locally. `release-prepare.yml` has not
  had a successful run since 2.4.0; v2.5.0/v2.6.0 ran `make release-test`
  locally. Filed as infra bug #2035.
- Authoritative green obtained locally (the v2.6.0 method): backend pytest
  exit 0 (incl. the previously-red test), 13/13 plugin suites, frontend
  build + vitest exit 0, verify-theme OK, verify-plugin-locks OK,
  schema-mirror-matches-engine OK, sync-versions-check OK, verify_docs
  0 FAIL + mkdocs-nav exit 0. The heavy E2E parts (Dexie, Manual-plan,
  WebKit, Docker) are covered by the green release/** push-gates.

## 4. Finish + publish

- `release-finish.yml` (run 30111507234) ran `make release-finish` +
  `make release-publish` in one pass: merge release/2.6.1 -> main (no-ff),
  tag v2.6.1 (main tip `4cbf4192` "Release v2.6.1"), back-merge into develop
  (`793212c0`), delete the release branch, publish the GitHub Release. Used
  the CI workflow because `gh` is not available in the session; the end state
  is identical to a local finish.
- Downstream fired on the release stand (RELEASE_PAT present): launcher-linux
  (30111535093), launcher-macos (30111535119), launcher-windows (30111535267)
  - all event=release, head=v2.6.1, success - attaching the three binaries +
  their `.sha256` checksums (6 release assets, permanent). deploy-gh-pages
  (30111528927) fired on the main push and succeeded; `version.json` is
  emitted from `package.json` (2.6.1 on main), so the deployed manifest is
  2.6.1. main CI green.

## 5. Deviations vs the v2.6.0 run

1. Finish + publish were driven via the `release-finish.yml` workflow dispatch
   instead of local `make release-finish`/`release-publish`, because the
   session has no `gh` CLI. Same end state.
2. The full `make release-test` was obtained locally (v2.6.0 method) after the
   `release-prepare.yml` CI gate hit the pre-existing root/ownership infra bug
   (#2035); the E2E half was taken from the green release/** push-gates.

Statistic: 1 commit on release/2.6.1 (bump `3c35495d`), tag v2.6.1 on main
(`4cbf4192`), release-test authoritative green (local + push-gates), infra bug
#2035 filed.

# Chat-Journal Session 2026-07-30 - ja/ko/zh review-progress recovery (#2161)

Lane: content data-recovery (#2161). Parallel session (CC) owns the launcher
image-mode lane (#2110) - untouched here. The learn-content-engine schema issue
(Teil 4) is the other session's, not touched or re-opened here.

Release constraint honoured: this is a data migration, deliberately held OFF the
v2.7.0 install-path release (quiet-baseline rule). Delivered as a DRAFT PR
(#2171) against develop for the release after v2.7.0. No release/2.7.0 branch
exists yet, so no freeze was active.

## 1. Both-mode remap primitive (condition 1 + 2, foundation)

- Goal: an idempotent, atomic, no-double-map re-key of orphaned ElementError
  rows, proven in BOTH storage modes (#2053).
- Result: backend `POST /{user}/element-errors/remap` (schema + repo + service +
  router) with 4 condition-tests, and the Dexie `remapElementKeysDexie`
  transaction with the mirror 4 tests. Atomicity proven by a forced mid-batch
  failure (backend: TestClient re-raises -> `pytest.raises`, both rows keep the
  old key; dexie: `put` spy throws on the 2nd row -> transaction rollback).
- Commit: ec0ce15d.

## 2. Content-verified orchestration (condition 3)

- Goal: never assume the mapping table still fits - verify each target against
  the current cached content before writing; count, never drop, the unmappable.
- Result: `jkz-recovery-service` (assess / restore / restart) over the
  mode-agnostic getStorage facade; `partitionByCurrentContent` splits detected
  remaps into applicable vs unmappable against the current-content lookup.
  `assessJkzRecovery` returns null when nothing is detected (state-driven
  notice) and re-reads live data each call (self-clearing). 14 tests
  (core partition + service).
- Commit: cec6f631.

## 3. State-driven notice + backup offer (condition 4)

- Goal: an in-product, non-broadcast notice; two user-triggered paths; numeric
  result; a non-forcing backup offer up front.
- Result: `RecoveryNotice` (Dashboard overview) + `RecoverySetRow` (per-set
  relink / restart-with-confirm, numeric result incl. unmappable count).
  `exportBackupNow` shared helper backs the one-click backup offer (same .alb as
  Settings > Data; no third inline copy of the export flow). 9 tests
  (notice 6 + helper 3).
- Commit: 5db84768.

## 4. i18n in all 11 catalogs + parity gate

- Goal: the recovery texts readable in every UI language (a data-touching
  action), placeholders preserved.
- Result: `content.recovery.*` (16 keys) added to all 11 backend YAML catalogs
  (real umlauts / diacritics / scripts, no em-dash), synced to frontend JSON,
  pinned by `recovery-parity.test.ts` (no English fallback; {filename}/{count}/
  {applied}/{skipped}/{unmapped} preserved). `make verify-i18n-scripts` clean.
- Commit: 50d35c7b.

## 5. Docs: changelog + test plan (DE/EN)

- Result: `changelog/releases/unreleased.md` (staged for post-v2.7.0; verified
  facts only - 3 sets, 172 items 66/58/48; all other sets untouched). Manual
  test plan DE + EN: both modes, state-driven notice, per-set relink with
  numeric result, partial-recovery count, restart confirm, no-double-map/orphan
  check, the pre-recovery backup round-trip, iOS-standalone, language check.
- Commit: b386a7c1.

## Verification

- Frontend: `tsc --noEmit` clean; recovery/backup/i18n/dashboard suites 71/71;
  ESLint clean.
- Backend: `test_element_errors_router.py` 22/22.
- `make verify-i18n-scripts` clean; `verify-docs` 0 FAIL (1 pre-existing WARN).
  `verify-mkdocs-nav` could not run (fresh docs venv missing PyYAML - env, not a
  nav change; no help pages / nav touched).

## Open / handover

- Numeric framing: the brief's "20 of 28 sets untouched" total lives in the
  external `astrapi69/adaptive-learner-content` repo and is NOT verifiable from
  this repo. Used the verified "3 affected sets, all others untouched" instead
  (numeric-claims rule). Confirm the 28 total if the exact ratio is wanted.
- Manual round-trip (BACKUP-AKZEPTANZTEST class) + a captured screenshot are
  pending on the branch; the notice needs seeded orphaned review cards to show.
- Draft held until v2.7.0 is tagged; then un-draft and merge on develop.

## Statistics

- Commits: 6 (bc07841c foundation from a prior turn + ec0ce15d, cec6f631,
  5db84768, 50d35c7b, b386a7c1).
- Tests added: backend 22 (remap router), frontend recovery 14 + dexie 4 + notice 6
  + helper 3 + parity, plus i18n parity.
- Issue #2161 (Closes via PR #2171).

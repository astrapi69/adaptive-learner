# Chat journal — 2026-06-08

## Backup hardening → v1.67.0 release

### Summary

A long session that turned the recurring backup-restore failures into a
complete, gated solution, then cut the **v1.67.0** release.

### What shipped

- **#126 — complete backup + logging + persistent toasts.** The export
  always carries all 30 tables (empty = `[]`, reverting the v1.66.0
  skip-empty), the restore path logs INFO per table / ERROR per failed
  row / a final summary, the UI shows a scrollable per-table import
  breakdown, and error toasts no longer auto-dismiss.
- **#127 — subjects no longer duplicate on a fresh-install restore.**
  Subjects had no natural key, so restoring onto a re-seeded taxonomy
  inserted every node twice (154 vs 77). Added `UNIQUE(parent_id, name)`
  (Alembic `0028` + dedup), null-aware root matching, and self-referential
  `parent_id` remap.
- **#129 — cross-identity restore.** A backup from a prior identity
  (wiped/re-created install, Dexie-origin) was rejected wholesale (192
  "missing parent" errors). The restore now re-homes the backup to the
  importing user. Found by the real round-trip gate with real data.
- **#130 — downloaded content sets travel in the backup.** Lesson content
  lived outside the 30 sync tables; a restore left lessons unopenable and
  lost user-generated sets. Now serialised (manifest + lessons + base64
  assets) into a `content_sets` segment, both storage modes, wire
  `1.2.0 → 1.3.0`.
- **#132 — EXP-023 dexie-smoke specs** were stale (missing user seed +
  pre-Phase-B single-repo UI); fixed during the release gate.

### Process note — the real gate

Five prior "fixed" backup releases shipped green unit tests yet no working
import. This session added a `BACKUP-AKZEPTANZTEST` rule
(`.claude/rules/quality-checks.md`): no backup change merges without a
proven real export→import round-trip, console output attached. That gate
is what surfaced #129 (cross-identity) and #130 (content sets) — neither
was visible from unit tests.

### Release

- v1.67.0 cut from `main` after both PRs (#128, #131) merged.
- All mandatory gates green: `make test`, `tsc`, Vitest (3805),
  `make test-dexie-smoke` (79), ruff, mypy, pre-commit, verify-docs,
  frontend build.
- Tagged `v1.67.0`, GitHub release published, Release Gate CI green.

### PRs / issues

- PRs: #128 (#126/#127/#129), #131 (#130) — both merged.
- Issues closed: #126, #127, #129, #130, #132 (+ #119 earlier).

## v1.67.1 patch — user-generated lesson title + step progress (#134)

P0 caught via the BACKUP-AKZEPTANZTEST gate with real data: after import,
a user-generated lesson showed the raw `set_id` instead of its title and
its step progress collapsed to a bare `Fortsetzen`.

Root cause (verified before coding, not the user's cross-identity
hypothesis): Dexie `saveUserSet` stores a user-generated set's title in
the `contentSets` row (`manifest_yaml: ""`) and writes only lesson files —
no `manifest.yaml`. The API `restore_content_sets` (#130) wrote `files[]`
but ignored `meta`, so the set landed manifest-less in the FS cache (which
derives all metadata from the manifest): title fell back to `set_id`, the
set wasn't recognised as cached so the lesson couldn't load (step-total
unknown), and a re-export silently dropped it.

Fix: synthesise a one-set `manifest.yaml` from `meta` on restore when
none is present, and replace an incomplete manifest-less version dir.
Proven via a real Dexie-style backup -> fresh API install round-trip
(title resolves, lesson reads HTTP 200, `current_step` + `step_results`
preserved). PR #135. Also carried the EXP-024 Phase 1 repository refactor
(#133) and a ruff-format catch-up on 5 #133 files.

Released v1.67.1; all gates green incl. dexie-smoke 79.

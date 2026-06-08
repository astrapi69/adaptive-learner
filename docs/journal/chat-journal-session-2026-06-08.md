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

# Chat journal — 2026-06-05 (v1.61.0 release)

Session that shipped **v1.61.0** (minor) plus the manual-testing bug
sweep that fed it. Picks up from the post-v1.60.0 handover.

## Release

- **v1.61.0 released 2026-06-05.** Tag `v1.61.0` → commit `3f527671`;
  GitHub Release published (not draft):
  https://github.com/astrapi69/adaptive-learner/releases/tag/v1.61.0
- Workflow: `make release-test` → `make release-tag VERSION=1.61.0` →
  `make release-publish VERSION=1.61.0`. The gate **caught a real
  failure** (1/73 Dexie specs) and the release was held until it was
  green — see "Gate catch" below.

## Merged PRs (since v1.60.0)

| PR | Title |
|----|-------|
| #39 | `fix(backup)` — prominent shadcn backup buttons + scroll-to-top after restore |
| #40 | `refactor(ui)` — app-wide button audit → shadcn `<Button>` (~200 buttons, 13 page areas) |
| #46 | `fix(lesson)` — resume a paused lesson at the exact step (`current_step`, Alembic 0027) |
| #48 | `feat` — cross-repo content validation (`validate_bundled_content.py` + README CONTENT-STATS + CI gate) |
| #50 | `fix` — backup restore UNIQUE-on-`badges.key` (natural-key upsert + `user_badges` remap) |

(Plus CCW's in-flight merges folded in earlier: #34 backup FK restore
order, #35 lesson icon buttons / "Lektion pausieren", #36 backup
`imported_conversation_id`, #37 learning-repo GPG-off, #38 backlog.)

## Issues

- **Closed:** #41 (resume restarts from step 1), #44 (content not
  showing — stale local content copy, not an app bug), #47 (content
  validation), #49 (badges restore UNIQUE).
- **Open:** #42 (Content Browser double scrollbar) + #43 (lesson
  layout shift) — both `needs-repro` (no browser repro available;
  precise static leads attached). #45 (saved lessons should merge into
  the content tree) — reclassified **P2 enhancement** (storage is
  correct by design; lessons appear under "My Lessons").

## Key decisions

- **Natural-key upsert for seeded catalog tables.** Badges carry a
  random per-install `id` + UNIQUE `key`; restore now matches on the
  natural key (`TableSpec.natural_key`), keeps the local id, and remaps
  `user_badges.badge_id` (backup → local) so earned badges keep
  referential integrity across installs. Chosen over a seeder/id-scheme
  migration — self-contained in the restore path, matches the existing
  merge-semantics pattern.
- **Content repo is the single authority** for bundled-content stats.
  `validate_bundled_content.py` reads the content-repo manifest directly
  (never the gitignored bundle), writes the README CONTENT-STATS block
  on pre-commit, and a `Content stats drift` CI job checks a **fresh**
  content checkout — structurally preventing the Bug #44 stale-copy
  class.
- **Dexie timeout raised for content growth.** The psychology set grew
  to 105 lessons; the "download set → open" Dexie spec caches them all
  (~18s) and tipped past the 20s/30s caps under the gate. Bumped the
  assertion to 60s + `test.setTimeout(120s)` for that one spec — a
  test-only change, no app behaviour touched.

## Gate catch (why the release wasn't rushed)

`make release-test` failed on `content-knowledge.spec.ts` (the only
red of 73 Dexie specs). Reproduced in isolation (18.0s, borderline vs
the 20s assertion), diagnosed as content-growth-induced (105-lesson
download), fixed the timeout, re-ran the **full** Dexie gate green
(73/73), then tagged. The safety gate did its job — the failure was
surfaced and resolved before the tag, not skipped.

## Test stand (approximate, point-in-time)

- Backend pytest collected **~1168** items in the release-test run
  (incl. new pins: `test_backup_restore_badges`,
  `test_content_ci_workflow`, `current_step` persistence/resume).
- Plugins ~1009 · Vitest **3399** · **73** Dexie E2E specs.
  Aggregate **~5,500+** green.
- Content library: **330 lessons / 16 sets / 3 domains** (content repo
  pulled current; README CONTENT-STATS block matches).

## ROADMAP

- `ROADMAP.md` + `backlog.md` "Current state" / "State" headers were
  bumped to v1.61.0 in the release-bump commit (8e1052e7).
- **No open `- [ ]` ROADMAP/backlog task was closed by v1.61.0** — the
  release work was tracked as GitHub issues (#41/#44/#47/#49), not as
  ROADMAP checkboxes, so there is nothing to tick. (The phase-history
  table has been stale since v1.49.0 / row 65; backfilling v1.50–v1.61
  is a separate docs-debt item, not done here.)

## Standing rules captured this session

- Every manual-testing bug gets a GitHub issue **before** the fix —
  and **search existing issues first** (reopen on recurrence). REST
  fallback (`gh api .../issues`) when the GraphQL path 504s. (Saved to
  assistant memory.)

# Phase 57 — Sibling-Key Fold Decision Memo

- **Date:** 2026-05-29
- **Scope source:** user's final Phase 57 scoping message (keep keys, tiers
  on natural-progression badges, one-shots flat bronze, mutable
  user_badges, XP delta on upgrade, high-water-mark tiers, gallery shows
  all).
- **The one unresolved conflict:** scoping #1 ("keep all 28 keys, no
  merging") vs #2's thresholds (`sessions_10 -> 10/50/100`), which fold
  the higher-sibling keys into the base key. This memo resolves it.
- **Affected keys (7):** `sessions_50`, `sessions_100`, `level_10`,
  `level_25`, `streak_7`, `streak_30`, `streak_100`.
- **Recommendation: FOLD.** Rationale + migration mechanics below.

## The two readings, made concrete

### FOLD (28 -> 21 keys) — recommended
Base keys become the tiered badges; siblings are absorbed as their
silver/gold bands:

| Tiered base key | Bronze | Silver | Gold | Siblings absorbed (removed) |
|---|---|---|---|---|
| `sessions_10` | 10 | 50 | 100 | sessions_50 (->S), sessions_100 (->G) |
| `level_5` | 5 | 10 | 25 | level_10 (->S), level_25 (->G) |
| `streak_3` | 3 | 30 | 100 | streak_7 (->B), streak_30 (->S), streak_100 (->G) |
| `lessons_10` | 10 | 50 | 100 | — (new silver/gold thresholds, no sibling) |
| `review_master` | 50 | 200 | 500 | — (new silver/gold thresholds, no sibling) |

Everything else stays a **flat bronze** badge (first_session,
first_assessment, first_import, first_lesson, all_six_methods, the 6
`*_10` method badges, five_cycles_one_session, two_languages,
three_providers, import_10_conversations, three_star_streak).

- **Streak note:** 4 old keys (3/7/30/100) -> 3 tiers. Bronze must stay
  at 3 (NOT 7) so existing `streak_3` holders keep their badge — so
  `streak_7` folds *down* to bronze. No data loss; one threshold band
  (the "7") is retired into bronze.
- **Result:** 5 genuinely-tiered badges (the headline feature is
  visible on the metrics users care about: sessions, level, streak,
  lessons, mastery) + 16 flat bronze badges = **21**.

### KEEP-ALL (28 stay) — literal #1
All 28 keys remain separate badges, each tagged `tier="bronze"`. To
avoid double-firing, the session/level/streak families stay as today's
separate-badge ladders (flat). Only badges with **no sibling collision**
get real silver/gold via stored upgrades: `lessons_10` and
`review_master`. **That is only 2 tiered badges.**

- **Result:** the tier feature is barely present — sessions/level/streak
  (the most-earned progressions) show no bronze->gold upgrade, because
  they're already three separate badges. The phase's headline ("10 vs
  100 looks different, one badge progressing") is **not delivered** for
  those metrics.

## Why FOLD wins

1. **It delivers the feature.** FOLD makes 5 high-traffic metrics tiered;
   KEEP-ALL makes 2 low-traffic ones tiered. The phase exists to make
   progression tangible — KEEP-ALL mostly doesn't.
2. **It is literally what #2 says.** The `10/50/100`, `5/10/25`,
   `3/30/100` thresholds in the scoping ARE the sibling keys' numbers.
   #2 describes folding; #1's "keep all" is the looser/general statement
   and specific instructions override general ones.
3. **The migration is bounded and testable.** Remap touches exactly 7
   keys with a static old-key -> (base-key, tier) table. It is the
   careful migration this phase was deferred to do.
4. **No data loss.** Every absorbed sibling maps to a tier on the base
   badge; high-water-mark means it can only ever be too *low* (then live
   eval upgrades on next activity), never wrong-high.

## FOLD migration mechanics (Alembic 0022)

1. `ALTER TABLE user_badges ADD COLUMN tier VARCHAR(10) NOT NULL DEFAULT 'bronze'`.
2. `ADD COLUMN updated_at` (default = `earned_at` for existing rows).
3. **Remap (data migration, defensive — no-op on empty/fresh DBs):**
   for each `(sibling_key -> base_key, tier)` in the static table:
   - resolve sibling + base `Badge.id` by key (skip if absent);
   - for each user holding the sibling `UserBadge`:
     - ensure a base `UserBadge` exists (create at the folded tier if
       missing; else raise its tier to `max(current, folded)` —
       high-water);
     - delete the sibling `UserBadge` row;
   - delete the 7 sibling `Badge` catalog rows (the YAML seeder never
     deletes, so the migration must).
4. Sync spec `user_badges`: `append_only=False`,
   `columns += ("tier","updated_at")`, `timestamp_field="updated_at"`.
5. Dexie v21: add `tier`/`updated_at` to `UserBadgeRow`; an
   `.upgrade()` runs the same remap on the IndexedDB side.

**Fresh-DB safety:** tests build the schema via `create_all` (gets the
new columns) and the data-remap is a no-op against empty tables. Per the
lessons-learned rule, delete the dev DB at
`~/.local/share/adaptive_learner/adaptive_learner.db` before the next
`make test` if it carries old `alembic_version`.

## Downstream consequences of FOLD (folded into 57A)

- `badges.yaml` + `BUNDLED_BADGES`: drop 7 keys, add `tiers:` blocks to
  the 5 base keys (flat badges have no `tiers:` block -> bronze-only).
- `_EVALUATORS` (both langs): the 5 tiered keys evaluate to a **tier**,
  not a bool; flat keys keep bool. (57B does the upgrade logic; 57A just
  lands the schema + flat backfill so the gate is green.)
- i18n: remove the 7 stale keys' strings; add tier labels
  (bronze/silver/gold × 8 langs). Tier-aware descriptions land in 57B/57D.
- Tests: `test_badge_yaml` gains tier-schema + monotonicity checks; a
  migration test asserts the remap; `badges.test.ts` updated.

## FINAL DECISION (user, 2026-05-29) — supersedes the recommendation above

Neither FOLD nor literal KEEP-ALL. A third model: **static visual tiers
+ dynamic tiers for siblingless badges.** Zero key removal, zero merge,
zero breaking change. The `tier` column maps EXISTING sibling badges to
a fixed visual tier; only badges with no sibling get real upgradable
thresholds.

**All 28 keys stay.** Two kinds of tier:

1. **Static visual tier (fixed per key, never upgrades the row).** The
   progression is the existing separate sibling badges; `tier` is just a
   denormalized visual attribute. Backfill map:
   - sessions_10 -> bronze, sessions_50 -> silver, sessions_100 -> gold
   - level_5 -> bronze, level_10 -> silver, level_25 -> gold
   - streak_3 -> bronze, streak_7 -> silver, streak_30 -> gold,
     **streak_100 -> gold (legendary)**
   - all `first_*` + every other badge -> bronze
2. **Dynamic upgradable tier (one row, tier climbs as the metric grows,
   awards XP delta + fires celebration).** Only siblingless badges:
   - `lessons_10`: bronze=10, silver=50, gold=100
   - `review_master`: bronze=50, silver=200, gold=500
   - (any future v1.39.0 mission badge would be dynamic too)

**Gallery** groups siblings into one visual progression row
(sessions_10/50/100 shown as bronze->silver->gold), but they remain 3
separate `UserBadge` rows in the DB. Grouping is a frontend-only concern
(static group map in `BUNDLED_BADGES`), so no DB `group` column needed.

**Migration 0022 (low-risk, no deletes/merges):**
1. `user_badges`: add `tier` (default 'bronze') + `updated_at`
   (= earned_at for existing rows). Backfill `tier` by joining to
   `badges` and applying the static key->tier map above.
2. `badges` (catalog): add `base_tier` (default 'bronze') +
   `tier_thresholds` (JSON text, null for static/flat badges). Populated
   by the YAML seeder on boot; the migration leaves safe defaults.
3. Sync: `user_badges` -> `append_only=False`,
   `columns += ("tier","updated_at")`, `timestamp_field="updated_at"`.
   Tier is high-water (never demotes) so last-write-wins stays correct.
4. Dexie v21: `UserBadgeRow.tier`/`updated_at` + `BadgeRow.base_tier`/
   `tier_thresholds`; `.upgrade()` applies the same static backfill map.

**XP scope:** XP delta is awarded only on **dynamic** tier upgrades
(lessons_10, review_master). Static sibling badges remain XP-neutral on
their own earn (unchanged from today). Documented inconsistency, accepted.

Proceeding with 57A on THIS model.

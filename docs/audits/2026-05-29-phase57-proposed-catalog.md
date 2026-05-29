# Phase 57 — Proposed Consolidated Badge Catalog

- **Date:** 2026-05-29
- **Decisions taken (user):** Option **B** (consolidate count-families into
  tiered umbrella badges) + **force 3 tiers** on every badge.
- **Derived from:** [audit](2026-05-29-badge-tier-readiness-audit.md) +
  [status report](2026-05-29-phase57-status-report.md).
- **Status:** SUPERSEDED (2026-05-29). The user chose NOT to consolidate.
  Final model is "static visual tiers + dynamic tiers for siblingless
  badges, all 28 keys kept" — see
  [sibling-key fold decision -> FINAL DECISION](2026-05-29-phase57-sibling-key-fold-decision.md).
  This consolidation proposal is retained only as the rejected
  alternative in the audit trail.

This collapses the 28 flat badges into **14 tiered badges**, each with
bronze/silver/gold thresholds on one countable metric. Categories are
re-mapped to the gallery filters (Learning / Review / Mastery /
Exploration / Streak / Missions, plus "All").

## Catalog

| New key | Category | Metric (existing helper) | Bronze | Silver | Gold | Replaces (old keys) | Backfill remap |
|---|---|---|---|---|---|---|---|
| `lessons_completed` | learning | completed lessons | 1 | 25 | 75 | first_lesson, lessons_10 | first_lesson→B, lessons_10→B |
| `sessions_completed` | learning | completed sessions | 1 | 25 | 100 | first_session, sessions_10/50/100 | first_session,sessions_10→B; sessions_50→S; sessions_100→G |
| `level_reached` | learning | user level | 5 | 10 | 25 | level_5/10/25 | →B/S/G |
| `marathon` | learning | max cycles in one session | 3 | 5 | 10 | five_cycles_one_session | →S (5) |
| `first_assessment`* | learning | assessment completed | 1 | — | — | first_assessment | →B |
| `review_master` | review | mastered elements (SRS) | 10 | 50 | 200 | review_master | →S (50) |
| `flawless_streak` | mastery | consecutive 3-star lessons | 3 | 5 | 10 | three_star_streak | →B (3) |
| `methods_explored` | exploration | distinct methods used | 2 | 4 | 6 | all_six_methods | →G (6) |
| `method_devotee`** | exploration | max sessions in one method | 10 | 25 | 50 | deductive_10 … ai_adaptive_10 (6 keys) | →B (10) |
| `polyglot` | exploration | languages used | 2 | 3 | 5 | two_languages | →B (2) |
| `providers_configured` | exploration | providers configured | 1 | 2 | 3 | three_providers | →G (3) |
| `conversations_imported` | exploration | imported conversations | 1 | 10 | 50 | first_import, import_10_conversations | first_import→B, import_10→S |
| `streak_master`*** | streak | current streak days (high-water) | 3 | 30 | 100 | streak_3/7/30/100 | streak_3/7→B; streak_30→S; streak_100→G |
| `mission_ace`**** | missions | completed missions | 5 | 25 | 100 | — (net-new) | n/a |

**XP bonus per tier (uniform default, tunable):** bronze 50, silver 150,
gold 300. Upgrade awards the **delta** (silver = +100, gold = +150),
guarded against double-award (Q-122).

## How the remap stays lossless + consistent

Backfill sets each user's tier to the **lower bound guaranteed by the old
keys they held** (max across held keys, per the table). Because tier is a
**high-water mark that never demotes** and live evaluation only ever
upgrades, a user whose true metric exceeds the backfilled tier simply
**catches up to the right tier on their next activity** (firing a normal
upgrade celebration). No earn is ever lost; no tier is ever wrong-high.

## Three judgment calls (please confirm or redirect)

- **\\* `first_assessment` is bronze-only.** The data model has exactly
  one `LearningProfile` per user — there is no countable metric for a
  2nd/3rd assessment tier without inventing a "retake assessment"
  feature. So "force 3 tiers" is structurally impossible here.
  *Options:* (a) keep it bronze-only [proposed], (b) drop the badge,
  (c) fold it into a broader "onboarding" badge with sessions/imports.
- **\\*\\* `method_devotee` collapses the 6 per-method badges into one.**
  The 6 `*_10` method badges are *parallel*, not *progressive*, so they
  aren't a tier-family. Collapsing them to "max sessions in any single
  method" (b/s/g 10/25/50) keeps the Exploration category from bloating
  to 18 entries. *Alternative:* keep 6 separate method badges, each
  tiered (adds 6×3 i18n description sets).
- **\\*\\*\\*\\* `mission_ace` is a brand-new badge.** v1.39.0 added the
  missions feature but **no mission badges exist today** (the plan
  assumed they did). This adds one mission badge + a `completed missions`
  count helper (queries `UserMission`). *Alternative:* defer mission
  badges, ship the Missions gallery filter empty for now.

## Net effect on i18n

28 → 14 keys. Tier *labels* (Bronze/Silver/Gold) = 3 strings × 8 langs
(one-time). Per-badge: name + 3 tier descriptions (or 1 description +
tier-aware threshold text — TBD in 57A). Real umlauts in `de.yaml`.

## If confirmed

57A lands: `0022` migration (add `tier`+`updated_at`, rename/merge
catalog rows, remap earned `user_badges`), sync spec → mutable,
Dexie v21, this catalog in badges.yaml + BUNDLED_BADGES, BadgeOut/
schema `tier`, i18n in 8 langs, tier-schema + remap tests. Then 57B–57G.

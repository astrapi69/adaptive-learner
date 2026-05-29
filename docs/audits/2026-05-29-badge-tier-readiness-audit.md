# Badge System Tier-Readiness Audit

- **Date:** 2026-05-29
- **Author:** Phase 57 pre-flight (v1.40.0 — Badge Tiers + Gallery)
- **Baseline:** v1.39.0 (Phase 56), `main` @ ddf1676, working tree clean
- **Pre-flight gates (all GREEN):** `make test` (backend + plugins +
  Vitest), `tsc --noEmit`, `npm run build`, `npm run test` (Vitest),
  `make test-dexie-smoke`.
- **Purpose:** Map the *as-built* badge system so the two open Phase 57
  design decisions (catalog shape; one-shot-badge tiering) can be made
  on evidence rather than from the plan text alone — the plan contains a
  genuine internal contradiction (see §5).

This audit makes no code changes. It is the input to the companion
[status report](2026-05-29-phase57-status-report.md).

---

## 1. Current badge catalog (the as-built reality)

**28 badges**, single source of truth in
[badges.yaml](../../plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/badges.yaml),
mirrored byte-for-key in the TS
[BUNDLED_BADGES](../../frontend/src/storage/badges.ts) (a Vitest pin
asserts the two keysets match). CLAUDE.md's "24+" is stale; the verified
count is 28.

| Category | Keys | Shape |
|---|---|---|
| getting_started | `first_session`, `first_assessment`, `first_import`, `first_lesson` | one-shot (do X once) |
| consistency | `streak_3_days`, `streak_7_days`, `streak_30_days`, `streak_100_days`, `three_star_streak` | **streak family** (4 thresholds) + one-shot |
| method_explorer | `all_six_methods`, `deductive_10`, `inductive_10`, `error_based_10`, `dialogic_10`, `contextual_10`, `ai_adaptive_10` | one-shot + per-method count |
| depth | `five_cycles_one_session`, `sessions_10`, `sessions_50`, `sessions_100`, `level_5`, `level_10`, `level_25`, `lessons_10`, `review_master` | **sessions family** (3) + **level family** (3) + counts |
| polyglot | `two_languages`, `three_providers`, `import_10_conversations` | one-shot + count |

**Key structural fact:** progression is *already modeled today as
separate badge keys*. `sessions_10 / sessions_50 / sessions_100` are
three rows, not one badge with three tiers. Same for
`level_5/10/25`, `streak_3/7/30/100`, and `first_lesson` + `lessons_10`.
This is the crux of the Phase 57 design decision.

### Classification of the 28 by progression-shape

- **Count-families that already encode tiers as separate keys (10 keys):**
  - sessions: `sessions_10`, `sessions_50`, `sessions_100`
  - level: `level_5`, `level_10`, `level_25`
  - streak: `streak_3_days`, `streak_7_days`, `streak_30_days`, `streak_100_days`
  - lessons: `first_lesson` (>=1), `lessons_10` (>=10) — a 2-point family
- **Single-point count badges (no current sibling):** `review_master`
  (>=50 mastered elements), `import_10_conversations` (>=10),
  `deductive_10`..`ai_adaptive_10` (>=10 each, 6 keys).
- **One-shot / boolean badges (no natural higher progression, 8 keys):**
  `first_session`, `first_assessment`, `first_import`, `all_six_methods`,
  `five_cycles_one_session`, `two_languages`, `three_providers`,
  `three_star_streak`.

---

## 2. Data model + persistence (what a tier column touches)

### `Badge` (catalog) — [models/__init__.py:1020](../../backend/app/models/__init__.py#L1020)
`id, key, name_key, description_key, icon, category, created_at,
updated_at`. No tier fields. Tier *thresholds* would be config
(badges.yaml), not columns — the catalog row stays as-is.

### `UserBadge` (earned) — [models/__init__.py:1228](../../backend/app/models/__init__.py#L1228)
`id, user_id, badge_id, earned_at`. Unique `(user_id, badge_id)`.
**Documented and treated as APPEND-ONLY.** No `tier` column, **no
`updated_at` column.**

### Sync surface — [sync_service.py:470](../../backend/app/services/sync_service.py#L470)
```python
"user_badges": TableSpec(
    model=UserBadge,
    columns=("id", "user_id", "badge_id", "earned_at"),
    timestamp_field="earned_at",
    append_only=True,          # <-- the contract today
    order=25,
    scope="direct",
),
```

> **FINDING A (highest-impact, contradicts the plan's stated
> assumption).** The plan's 57A says "Update sync surface (tier is a
> mutable field on an existing **mutable** table)." It is **not** a
> mutable table today — it is `append_only=True` with `timestamp_field=
> earned_at` and **no `updated_at` column**. A tier that gets *updated*
> on upgrade (bronze->silver->gold) requires:
> 1. a new `updated_at` column on `UserBadge` (migration), and
> 2. flipping `append_only=False` + `timestamp_field="updated_at"` +
>    adding `tier` (and `updated_at`) to `columns`.
>
> Last-write-wins on a mutable sync row is fine *only if tiers are
> monotonic* (they only ever increase). They are — see FINDING C. So
> the merge is safe, but the migration is bigger than "add one column."

### Dexie schema — [db.ts](../../frontend/src/storage/db.ts)
Currently at **version(20)**. A `tier` field on `UserBadgeRow` +
`updated_at` is an additive bump to **version(21)** (Dexie only needs a
version bump when indexes change; a new non-indexed field technically
needs no schema bump, but the project's convention is to bump on any
stored-shape change for the sync engine's benefit — see existing v18/v19
additive bumps).

### Alembic — head is `0021_user_missions`. Next migration: **`0022`**.

---

## 3. Evaluation engine (both modes)

### Backend — [badge_service.py](../../plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/badge_service.py)
`_EVALUATORS: dict[key -> callable(db, uid) -> bool]`. `evaluate_user`
iterates, skips already-earned `badge_id`s, inserts new `UserBadge`
rows, returns earned keys. Every predicate is a **threshold on a
countable metric** computed by a helper (`_completed_lesson_count`,
`_completed_session_count`, `_current_streak`, `_user_level`,
`_mastered_elements_count`, `_languages_used`, ...). XP is **not**
awarded here — badges are currently XP-neutral (see FINDING B).

### Frontend — [storage/badges.ts](../../frontend/src/storage/badges.ts)
`EVALUATORS: Record<key, (uid) => Promise<boolean>>` — a faithful mirror
of the Python predicates (same metrics, same thresholds).
`evaluateBadgesForUser` mirrors `evaluate_user`. Parity is maintained by
discipline, not by a cross-language golden (unlike the lesson-XP rule,
which *is* golden-pinned — see §7).

> **FINDING B.** Badges award **no XP today.** Earning a badge inserts a
> `UserBadge` row and surfaces a toast; it does not touch `UserXP`. The
> plan's `xp_bonus` per tier (50/150/300) introduces a **new** coupling
> between the badge system and the XP economy that does not exist now.
> The "award the DELTA on upgrade" rule (silver_xp - bronze_xp) is sound
> for preventing inflation, but it is net-new wiring on both sides, and
> the `xp_awarded` double-award guard (cf. the v1.39.0 mission pattern)
> must be replicated for tier upgrades (Q-122).

### Call sites (where evaluation fires)
- **Backend:** `plugin.py:82` (the `on_session_complete` hook),
  `routes.py:61` (award-assessment), `:72` (award-import), `:122`
  (`POST /badges/{uid}/evaluate`).
- **Dexie:** `dexie-storage.ts` at `:873` (lesson-XP completion path),
  `:1944`, `:1958`, `:1967`, `:2101`.

A tier-upgrade path must hook the *same* call sites so upgrades are
detected wherever earns are detected today.

> **FINDING C (enables safe sync).** Every metric is **monotonic
> non-decreasing within a tier ladder** EXCEPT two: `_current_streak`
> (a streak resets to 0 when a day is missed) and element mastery
> (`mastered` demotes on a wrong answer). So a naive "tier only goes up"
> assumption holds for sessions/lessons/level/imports but **not** for
> streak or mastery. Decision needed: does a dropped streak *demote* a
> silver streak badge back to bronze, or is the badge a high-water mark?
> Today the badge, once earned, is permanent (high-water mark). Tiers
> should preserve that: **tier = max tier ever reached**, never demoted.
> This keeps sync monotonic (last-write-wins is correct) and matches
> existing "append-only / earning is permanent" semantics.

---

## 4. Presentation surfaces (what the gallery/widget/celebration touch)

- **Schemas:** `BadgeOut`, `UserBadgeOut`, `BadgeWithProgressOut`
  ([schemas/__init__.py:1081](../../backend/app/schemas/__init__.py#L1081)).
  `BadgeWithProgressOut` already carries a `progress` field (currently
  always `None`) — the natural home for tier-progress data.
- **Frontend components that read badges:** `BadgeShowcase.tsx`,
  `GamificationSettingsSection.tsx`, `Dashboard.tsx`, `Progress.tsx`,
  `RecentSessions.tsx`. (`MethodBadge.tsx` is unrelated — it badges the
  6 learning methods, not achievements.)
- **Celebration bus:**
  [celebration-bus.ts](../../frontend/src/lib/praise/celebration-bus.ts).
  `CelebrationType` union + `SOUND_MAP`; helpers `celebrateMilestone`,
  `celebrateMissions`, `celebrateMilestonesFromSnapshots`. A
  `badge_tier_upgrade` type slots in here; sounds reuse
  `star_earned` (silver) / `level_up` (gold) + confetti (gold), all
  from v1.38.0 — no new audio synthesis. Praise phrases live in
  `frontend/src/data/praise/{8 langs}.json` (synced from
  `backend/config/praise/*.yaml` via `make sync-praise`).
- **SVG generator precedent:**
  [placeholder-svg.ts](../../frontend/src/lib/content/placeholder-svg.ts)
  (v1.37.0) — string-built SVG -> data URI, no external files, tested by
  asserting on the SVG string. The badge SVG generator (57C) follows
  this exact shape.
- **Drawer precedent:**
  [HelpDrawer.tsx](../../frontend/src/components/help/HelpDrawer.tsx) —
  Radix Dialog drawer, no route. The gallery (57D) copies this.

---

## 5. i18n footprint (the hidden cost multiplier)

Badge strings live at `gamification.badges.{key}.{name|description}` in
**8 catalogs** (`backend/config/i18n/{de,en,es,fr,el,pt,tr,ja}.yaml`),
synced to `frontend/src/data/i18n/*.json` via `make sync-i18n`.

- Today: 28 badges x 2 strings x 8 langs = **448 strings**.
- If each tier needs its own description ("Complete 10 / 50 / 100
  lessons"): up to 3x the description strings. Tier *labels*
  (Bronze/Silver/Gold) are 3 x 8 = 24 strings, one-time.

> **FINDING D.** The catalog-shape decision is also an i18n-cost
> decision. Consolidating families (Option B, §6) *reduces* total
> strings (10 family keys -> 4 umbrella keys) but requires **rewriting**
> existing translated strings and adding per-tier description variants.
> Keeping keys (Option A) adds the fewest *new* strings but leaves the
> redundant family strings in place. Real umlauts required in `de.yaml`
> per the German-content rule.

---

## 6. The core design fork (why this audit exists)

The plan text is internally inconsistent. Three statements cannot all be
literally true:

1. **Rules:** "Migration backfills ALL existing badges as bronze (no
   data loss, **no breaking change**)."
2. **57A body + example:** a consolidated `lessons_completed` badge with
   `tiers: {bronze: 10, silver: 50, gold: 100}` — a key that **does not
   exist today** (we have `first_lesson` + `lessons_10`). Taking the
   example literally **removes** keys = a breaking change.
3. **57A body:** "Existing 24+ badges **all** get 3-tier definitions" —
   but 8 one-shot badges have no natural 2nd/3rd tier (§1, §3 FINDING).

### Option A — Keep all 28 keys, add tiers additively
- Each existing key keeps its slug; gains bronze/silver/gold thresholds
  on **its own** metric. Backfill every earned row to `bronze` is exact.
- **Pros:** honors the "no breaking change" Rule literally; smallest
  migration (add column + backfill, no remap); fully additive; lowest
  risk; no i18n rewrites.
- **Cons:** count-families **overlap** — `sessions_10` at gold (say 100)
  covers the same metric as `sessions_100` at bronze. The gallery shows
  redundant badges (up to 9 conceptual states for "sessions"). "All get
  3 tiers" forces invented thresholds onto one-shots, OR one-shots stay
  bronze-only (recommended sub-choice), which softly violates statement 3.
- **Delivers the headline value?** Partially. The *visual* tier system
  ships, but the gallery is cluttered and "10 vs 100 lessons looks
  different" is expressed as two separate bronze badges, not one
  badge progressing bronze->gold.

### Option B — Consolidate count-families into tiered umbrella badges
- Merge `sessions_10/50/100` -> `sessions_completed`
  {b:10, s:50, g:100}; `level_5/10/25` -> `level_reached` {5,10,25};
  `first_lesson`+`lessons_10` -> `lessons_completed` {1/10, ...};
  `streak_3/7/30/100` -> `streak_master` (**4 thresholds, only 3 tiers —
  lossy**, must drop one band, e.g. {7, 30, 100}).
- One-shots stay as-is (bronze-only).
- **Pros:** product-correct — tiers *are* the progression model; matches
  the example; cleanest gallery; fewest total i18n keys long-term.
- **Cons:** **breaking catalog change** (removes ~10 keys); migration
  must **remap** earned rows (a user who earned `sessions_50` lands on
  `sessions_completed` @ silver, not bronze) — so the "backfill all as
  bronze" Rule is wrong for these; streak is **lossy** (4->3); i18n
  strings rewritten; the TS `BUNDLED_BADGES` + every test referencing
  old keys updated. Highest migration risk — but this phase was
  *deferred specifically to give the migration its own green cycle*,
  which is evidence the user is willing to absorb migration cost here.

### Option C — Hybrid (keep keys, bronze-cap families + one-shots, add tiers only where net-new)
- Keep all 28 keys, all bronze-only and permanent. Do **not** bolt
  silver/gold onto family members (avoids the §6-A overlap explosion).
- Introduce true bronze/silver/gold **only** on metrics where it adds
  value without colliding with an existing family — but every
  high-value metric (sessions/lessons/level/streak) **already has a
  family**, so there is nowhere clean to add a tiered badge without
  either colliding (A) or consolidating (B). Hybrid collapses back into
  A or B in practice. **Not recommended as a distinct path.**

---

## 7. Parity + testing posture

- Lesson-XP and streak helpers are **golden-pinned** across Python/TS
  (`tests/fixtures/lesson-xp-parity/`, proven in Phase 49F/50). Tier
  evaluation should reuse this methodology: a shared JSON golden of
  `(metric_value) -> expected_tier` pinned in both languages. The plan
  says "parity not formally tested" — the audit recommends pinning it,
  since the cost is low and the existing harness is right there.
- `test_badge_yaml.py` (plugins) asserts catalog/evaluator key
  agreement and YAML well-formedness; it will need tier-schema
  validation added (every tier block has bronze, monotone thresholds,
  monotone xp_bonus).
- `badges.test.ts` pins the TS catalog. Both must move together
  (the "atomic commit / green individually" rule).

---

## 8. Recommendation (for the status report's decision)

**Recommended: Option B (consolidate count-families) + bronze-cap
one-shots**, *with* the "no breaking change" Rule explicitly amended to
"no data loss; earned achievements are preserved by remap, not
discarded." Rationale:

1. It is the only option that delivers the phase's stated user value
   ("10 vs 100 looks different" as one badge progressing).
2. Tiers *are* a progression model; the count-families are progression
   mis-modeled as separate keys. Consolidation fixes a latent modeling
   wart rather than layering a second progression on top of it.
3. The phase was deferred precisely to absorb a careful migration — the
   remap is that migration.

**If migration risk must be minimized this cycle, fall back to Option
A** (keep keys + additive tiers, one-shots bronze-only): ships the
visual tier system and the gallery with a one-column additive migration,
at the cost of a redundant gallery and only partial delivery of the
headline value.

**Regardless of A or B**, these are firm based on evidence:
- `UserBadge` needs `updated_at` + `tier`; sync flips to
  `append_only=False` (FINDING A).
- Tier = **high-water mark, never demoted** (FINDING C) — keeps sync
  last-write-wins correct and matches existing permanence semantics.
- Badge XP coupling is **net-new**; replicate the v1.39.0 mission
  `xp_awarded` guard for tier upgrades (FINDING B, Q-122).
- Pin tier evaluation with a cross-language golden (§7).
- One-shot badges (8 keys) are **bronze-only** under both A and B —
  inventing 3 tiers for "do X once" is not defensible.

### Two decisions required from the user
1. **Catalog shape:** Option A (keep keys, additive, low-risk, redundant
   gallery) **vs** Option B (consolidate families, product-correct,
   breaking + remap migration). *Recommendation: B.*
2. **One-shot badges:** bronze-only cap (recommended) **vs** forced
   3-tier with invented metrics. *Recommendation: bronze-only.*

No 57A code should land until decision 1 is made — it determines the
migration, the catalog, the i18n, and every downstream sub-phase.

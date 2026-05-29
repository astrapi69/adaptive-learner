# Phase 57 / v1.40.0 — Status Report

- **Date:** 2026-05-29
- **Phase:** 57 — Badge Tiers (Bronze/Silver/Gold) + Badge Gallery
- **Baseline:** v1.39.0, `main` @ ddf1676, clean tree
- **Derived from:** [Badge Tier-Readiness Audit](2026-05-29-badge-tier-readiness-audit.md)
- **State:** **BLOCKED on 2 design decisions.** No feature code written.

---

## Pre-flight — GREEN

| Gate | Result |
|---|---|
| `make test` (backend + plugins + Vitest) | exit 0 |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test` (Vitest) | exit 0 |
| `make test-dexie-smoke` | exit 0 |

The v1.39.0 baseline is confirmed green across all release gates.

---

## What the audit found (5 findings)

| # | Finding | Impact |
|---|---|---|
| **A** | `user_badges` is `append_only=True` in sync today, with **no `updated_at` column** — not the "mutable table" the plan assumed. | A mutable `tier` needs a new `updated_at` column + flipping the sync spec to `append_only=False`. Bigger migration than "add one column." |
| **B** | Badges award **no XP today** — earning is XP-neutral. | The plan's per-tier `xp_bonus` is net-new XP coupling on both backend + Dexie; needs an `xp_awarded` double-award guard (Q-122), mirroring v1.39.0 missions. |
| **C** | Streak and element-mastery metrics are **non-monotonic** (they can drop). | Decision baked in: **tier = high-water mark, never demoted.** Keeps sync last-write-wins correct + matches existing "earning is permanent" semantics. |
| **D** | i18n footprint is 448 strings across 8 catalogs; tiers multiply descriptions. | Catalog shape (below) is also an i18n-cost decision. |
| — | CLAUDE.md says "24+" badges; verified count is **28**. | Minor doc fix during 57G. |

## The blocker: the plan contradicts itself

Three plan statements can't all be literally true:
1. **Rule:** "no breaking change, backfill ALL earned badges as bronze."
2. **57A example:** a consolidated `lessons_completed` badge — a key that
   doesn't exist today (we have `first_lesson` + `lessons_10`). Taking it
   literally *removes* keys = breaking.
3. **57A:** "all 28 badges get 3-tier definitions" — but 8 one-shot
   badges ("do X once") have no natural 2nd/3rd tier.

The root cause: **progression is already modeled as separate badge keys**
today (`sessions_10/50/100`, `level_5/10/25`, `streak_3/7/30/100`,
`first_lesson`+`lessons_10`). Tiers are a second progression model laid
over the first. You either keep both (redundant) or consolidate (breaking).

---

## Decision 1 — Catalog shape

| | **Option A — Keep keys, add tiers** | **Option B — Consolidate families** *(recommended)* |
|---|---|---|
| Migration | add `tier`+`updated_at`, backfill all `bronze`. No remap. | add cols **+ remap** earned rows to correct tier (sessions_50 -> silver). |
| Breaking? | No (honors the Rule literally). | Yes — removes ~10 keys; amends the "no breaking change" Rule to "no data loss / earns preserved by remap." |
| Gallery | redundant (up to 9 states for "sessions"). | clean — one badge per metric, bronze->gold. |
| Delivers "10 vs 100 looks different"? | partially (two separate bronze badges). | fully (one badge progressing). |
| Risk | **low** | **higher** — but this phase was *deferred specifically to absorb a careful migration*. |
| i18n | fewest new strings; redundant strings remain. | rewrite family strings; net fewer keys long-term. Streak is **lossy** (4 thresholds -> 3 tiers). |

## Decision 2 — One-shot badges (8 keys)

`first_session`, `first_assessment`, `first_import`, `all_six_methods`,
`five_cycles_one_session`, `two_languages`, `three_providers`,
`three_star_streak`.

- **Bronze-only cap** *(recommended)* — earned = bronze, permanent, no
  upgrade path. Honest to "you can only do a first X once."
- **Force 3 tiers** — invent a countable metric per badge (e.g. all-six-
  methods x1/x3/x5). Honors statement 3 literally; invents semantics +
  new i18n per tier.

---

## Firm regardless of A/B (evidence-based, no decision needed)

- `UserBadge` gains `tier` + `updated_at`; sync -> `append_only=False`,
  `timestamp_field="updated_at"`.
- **Tier never demotes** (high-water mark).
- Badge->XP coupling is net-new; replicate the missions `xp_awarded`
  guard; award the **delta** on upgrade.
- Pin tier evaluation with a **cross-language golden** (reuse the Phase
  49F/50 harness) — cheap, and the plan's "parity not formally tested"
  leaves an avoidable gap.
- One-shots are bronze-only under both A and B.

---

## Recommendation

**Option B + bronze-cap one-shots**, with the "no breaking change" Rule
amended to "no data loss; earns preserved by remap." It is the only path
that actually delivers the phase's headline value, and the deferral
signals willingness to take the migration carefully.

**If risk must be minimized this cycle: Option A** — ships the visual
tier system + gallery on a one-column additive migration, accepting a
redundant gallery and partial value.

## Next action

Awaiting the user's pick on **Decision 1** (and 2). On answer, 57A
proceeds: schema + migration shaped to the chosen catalog, then
57B–57G per plan with the firm constraints above folded in. Until then,
no feature code lands (the catalog shape determines the migration, the
i18n, and every downstream sub-phase).

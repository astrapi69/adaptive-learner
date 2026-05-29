# Chat Journal — 2026-05-29 (Phase 56)

Session shipped **v1.39.0** (Phase 56 — EXP-010 *Missionen und
Plaketten*, missions subset). Daily missions give the learner a few
concrete, achievable, adaptive goals each day; badge tiers
(bronze/silver/gold) + the badge-gallery drawer were **deferred to
v1.40.0 / Phase 57** by an explicit mid-phase scope decision.

11 atomic sub-phase commits + 1 release commit; each individually
green through `make test` + `npm run build` + Vitest +
`make test-dexie-smoke`.

---

## Scope decision (mid-phase)

After completing the mission **engine** (56A–D) I delivered an
audit + status report. The user approved shipping the **missions
subset** as v1.39.0 (56M, F, H, I, L, J + release) and deferring the
**badge tiers** (56E) + **badge gallery** (56G) to Phase 57 — the
badge-tier work needs its own migration + dual-mode tier evaluation
and deserves a dedicated green cycle rather than the tail of a large
phase.

## Sub-phases

1. **56A** `72cc3e0` — `UserMission` model + Alembic 0021 + Dexie v20
   + sync surface + `missions` plugin (catalog/schema/loader/routes).
2. **56B** `baded68` — 22 templates × i18n in all 8 catalogs.
3. **56C** `b14fe1e` — deterministic adaptive generator + progress
   evaluator (TS + Python) + Dexie/Api `missions` namespaces +
   backend service/routes. Only checks computable from existing data
   are assignable.
4. **56D** `4653377` — timezone-aware local-midnight rollover (no
   penalty) + streak-joker.
5. **56M** `5f1d966` — Settings reorg to a six-tab layout (Bibliogon
   pattern); panels stay mounted (inactive `hidden`) so deep links +
   testids survive. Done FIRST so 56I/56L land in the right tabs.
6. **56F** `687bfea` — `DailyMissionsCard` dashboard widget.
7. **56H** `8601427` — completion XP (idempotent via `xp_awarded`,
   both modes) + refresh on lesson completion.
8. **56I** `d388558` — mission config (on/off, count, mix, reset) in
   Settings > Learning.
9. **56L** `32839e6` — visual-only Solo / Multiplayer mode indicator
   (coming-soon).
10. **56J** `1fc35bd` — celebration-bus wiring: `mission_complete` +
    `all_missions_complete` sounds + a `mission_complete` praise
    category + toast + all-clear confetti.
11. **Release** `5cdf6fe`, tag `v1.39.0` — EN+DE help pages,
    CLAUDE.md, release notes, `make sync-versions` (19 files).

## Decisions / deviations

- **MissionTemplate is config, not a table** — only `UserMission`
  persists (honors "no new tracking beyond UserMission").
- **5 of 22 checks deferred** (no per-day source in existing data):
  the generator won't assign them; they stay in the catalog for a
  future tracking phase. Documented in `checks.ts` /
  `generator.py`.
- **PRNG differs TS vs Python** — exact cross-backend selection is
  not required (a user uses one storage backend; determinism holds
  within each).
- **Settings reorg keeps all panels mounted** (`hidden`) rather than
  conditional rendering, so the 32 existing Settings tests passed
  unchanged.
- A Dexie test-isolation bug surfaced (the `new IDBFactory()` swap
  doesn't reset Dexie's captured `indexedDB`; same as streaks.test)
  — fixed with explicit per-table `clear()` in `beforeEach`.

## Verification

- `make test` green: backend 1020 + plugins 942 + Vitest 2295 =
  **4257** (+1 skipped).
- `npm run build`, `tsc`, `ruff app/`, `mypy app/`,
  `pre-commit --all-files`, `verify-mkdocs-nav`,
  `verify_version_pins.sh 1.39.0` — all clean.
- `make test-dexie-smoke` 19/19 (incl. the tabbed Settings mount).

## Shipped

main pushed `6bdc2a7..5cdf6fe`, tag `v1.39.0` pushed, GitHub release
published. Phase 57 / v1.40.0 will pick up badge tiers (56E) + the
badge gallery (56G).

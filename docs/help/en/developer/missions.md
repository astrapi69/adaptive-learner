# Daily missions architecture

Daily missions (EXP-010, Phase 56) add active, opt-in motivation
on top of the passive XP/badge/streak rewards. They run in both
storage modes and add exactly one tracking table.

## Pieces

| Module | Role |
|---|---|
| `plugins/.../missions/templates.yaml` | Static mission catalog (22 templates, 5 categories), synced to the frontend by `make sync-missions`. |
| `MissionTemplate` (Pydantic) | Catalog entry shape (config, NOT a table). |
| `UserMission` (model) | The one new table: per-user/per-day assignment + progress + `xp_awarded` guard. Alembic `0021`, Dexie v20, sync surface (MUTABLE). |
| `lib/missions/generator.ts` + `generator.py` | Deterministic (seeded PRNG) adaptive selection: one pick per difficulty slot, eligibility by history (new/active/veteran), no back-to-back repeats. |
| `lib/missions/checks.ts` + `SUPPORTED_CHECK_FUNCTIONS` | Only checks computable from existing data are assignable (the other 5 catalog entries stay un-assigned until tracking exists). |
| `lib/missions/progress.ts` | Pure `check_function` + stats snapshot -> {current, target, completed}. |
| `lib/missions/schedule.ts` | Local-midnight `today` (language->timezone) + streak-joker. |
| `storage/missions-dexie.ts` | Dexie: gather a "today" stats snapshot, assign idempotently, evaluate, award XP on completion. |
| missions plugin `service.py` | Same flow against SQLAlchemy for API mode (`GET /today`, `POST /regenerate`). |

## Flow

1. The dashboard widget (or lesson completion) calls
   `getStorage().missions.getDaily(userId, {todayIso})`.
2. If no rows exist for that local day, the generator assigns a
   fresh set (seeded by `userId + date`, excluding yesterday's).
3. Progress is re-evaluated against existing data
   (LessonProgress / ElementError / streak). A newly-completed
   mission flips `completed` and, once, awards its `xp_reward`
   (idempotent via `xp_awarded`).
4. `celebrateMissions` (celebration bus) plays the mission sound +
   surfaces a praise phrase; an all-clear plays the bigger sound +
   a confetti burst.

## Rules

- Deterministic per (userId, date); a user uses one storage
  backend, so cross-backend exact parity is not required.
- No tracking beyond `UserMission`; un-trackable checks are not
  assigned.
- Missions are supplementary - a failure never breaks the lesson
  flow (all reads are defensive). No penalty for missed days.

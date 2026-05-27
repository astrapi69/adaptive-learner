# Kickoff prompt — v1.33.0

This file is the paste-ready prompt for kicking off the
next session. Two variants:

- **§ 1 — Skeleton kickoff** (the user picks scope at
  session start)
- **§ 2 — Specific kickoff: Dexie-mode lesson-XP**
  (the recommended candidate from the handover § 2.1,
  pre-loaded into the prompt shape Phase 49 used)

Pick one, paste, send.

---

## 1. Skeleton kickoff (user picks scope)

Use this when you haven't decided which candidate to
pursue. The session will read the handover and propose
a plan against your choice.

```text
v1.33.0 session start.

Pre-flight: make test + cd backend && poetry run mypy app/ +
cd backend && poetry run pre-commit run --all-files +
make test-dexie-smoke. All must be green.

Read first, in order:
1. CLAUDE.md
2. .claude/rules/ (especially lessons-learned.md +
   ai-workflow.md + release-workflow.md)
3. docs/journal/handover-to-v1.33.0.md (this session's
   cold-pickup brief — long-form state + gotchas +
   methodology lessons from Phase 49)
4. changelog/releases/v1.32.0.md (what just shipped)

State at start of session:
- HEAD on main, in sync with origin/main, clean tree
- v1.32.0 shipped (Phase 49 — Learning Repo Storage
  Abstraction; closes PHASE-42-STORAGE-ABSTRACTION-01)
- Baseline: backend 1005 (+1 skipped) + plugins 839 +
  Vitest 1874 = 3597 tests (+1 skipped); Dexie smoke
  18/18

Candidates listed in handover § 2 (pick ONE):
- 2.1 Dexie-mode lesson-XP gap (recommended — 49F
  proved the parity-test methodology, ~100 LOC port)
- 2.2 EXP-013 Adaptive Lektionen Stufe 3
- 2.3 Backlog cleanup (close P-131..P-140 by reference)
- 2.4 i18n catalog cleanup for repo.* keys
- 2.5 Generic plugin-settings UI driven by bundled
   plugin-config JSON

After pre-flight + reading: propose a commit plan for the
chosen candidate with architectural decisions explicit.
Wait for green-light before writing code. Same discipline
as Phase 46 + 49: atomic green commits, every gate green
per commit, parity-test-first for cross-language work.
```

---

## 2. Specific kickoff — Dexie-mode lesson-XP (recommended)

Use this if you want to go straight at the
Dexie-mode gamification gap that v1.31.0 left and 49F's
parity methodology made tractable. Modeled after the
Phase 49 prompt structure the prior session ran cleanly.

```text
Phase 50: v1.33.0 — Dexie-Mode Lesson-XP Parity (D-DEXIE-GAMIFICATION).

Pre-flight: make test + cd backend && poetry run mypy app/ +
cd backend && poetry run pre-commit run --all-files +
make test-dexie-smoke + npm run build (from frontend). All
must be green.

Reference: Phase 49 (PHASE-42-STORAGE-ABSTRACTION-01) for
the parity-test pattern. The shared-fixture + golden
methodology proved out byte-for-byte on the first run.
Adapt the same pattern; don't redesign it.

Context: v1.31.0 closed the lesson-XP loop for API-mode
users (Phase 46E.1 dispatch on session.method="content"
through the existing on_session_complete hook, the
gamification plugin's award_xp_for_lesson_session does the
write). Dexie-mode users get LessonProgress + ElementError
+ review queue but NOT the lesson-XP / lesson-badge side
effects (no backend, no on_session_complete hook). This
phase ports the XP rule to TypeScript so Dexie completions
award XP locally to the same formula.

Closes: D-DEXIE-GAMIFICATION (open as a deferred-on-purpose
gap since v1.31.0; promoted to tractable status in the
v1.33.0 handover after 49F validated the parity pattern).

## Sub-phases

50A — Shared lesson-XP fixture + Python parity scaffold
- New tests/fixtures/lesson-xp-parity/input.json:
  representative lesson-complete events covering every
  branch of the formula:
    - 0/1/2/3 stars (band thresholds 50%/75%/90%)
    - first_attempt true vs false
    - streak_days 0/1/4/7/20 (multiplier branches +
      cap)
    - clamped stars (negative + > 3)
- Python parity test:
  plugins/.../gamification/tests/test_xp_parity.py.
  Loads fixture, calls calculate_lesson_session_xp,
  asserts against per-case golden JSON at
  tests/fixtures/lesson-xp-parity/expected/{case}.json
  (xp_earned + breakdown + multiplier + reason).
  Regen via LESSON_XP_PARITY_REGEN=1.
- No TS code yet. This commit ships the contract.
- Commit: "test(gamification): lesson-XP parity scaffold +
  Python goldens (50A / v1.33.0 / D-DEXIE-GAMIFICATION)"

50B — TypeScript lesson-XP rule
- New frontend/src/lib/gamification/lesson-xp.ts:
  computeStars + calculateLessonSessionXp (pure
  functions, mirror Python's xp_service.compute_stars +
  calculate_lesson_session_xp signatures).
- New parity test
  frontend/src/lib/gamification/lesson-xp.parity.test.ts:
  loads same fixture, asserts byte-for-byte equality
  against same goldens.
- Verify TS matches Python; converge any drift.
- Commit: "feat(gamification): TypeScript lesson-XP rule
  + parity proof (50B)"

50C — Streak helper + first-attempt detector (TS)
- New frontend/src/lib/gamification/streak.ts: ports
  current_streak_days from xp_service.py (pure function
  of a Set<date>).
- New frontend/src/lib/gamification/first-attempt.ts:
  ports _is_first_attempt (reads LessonProgress
  step_results JSON, returns True iff every step
  attempts==1).
- Unit tests for both; parity tests if shapes warrant.
- Commit: "feat(gamification): TypeScript streak +
  first-attempt helpers (50C)"

50D — DexieStorage hook on lesson completion
- New frontend/src/storage/lesson-xp-dexie.ts:
  awardLessonXpDexie(userId, lessonProgressId,
  scoreCorrect, scoreTotal) — reads activity dates +
  first-attempt flag, runs the formula, upserts the
  user-XP row in IndexedDB.
- DexieStorage userXp namespace (extend if needed) +
  the upsert path.
- Hook into the lesson-completion path: when
  lessonProgress.upsert sets status=completed in
  Dexie mode, fire awardLessonXpDexie. (Lookup the
  existing DexieStorage.lessonProgress.upsert.)
- Tests: end-to-end (seed lesson, mark completed,
  assert UserXP row updated to expected value).
- Commit: "feat(storage): Dexie-mode lesson-XP on
  completion (50D)"

50E — Lesson-badge predicates (TS)
- Port the 4 lesson-badge predicates from Python's
  badge_service.py to TS (first_lesson, lessons_10,
  three_star_streak, review_master).
- Wire them to fire after the awardLessonXpDexie
  upsert.
- Tests: Dexie-mode badge-earning round-trip.
- Commit: "feat(gamification): TypeScript lesson
  badge predicates for Dexie mode (50E)"

50F — Docs + release
- Update user-guide/lessons.md: drop the "XP/badge
  side effects are API-mode-only" caveat.
- Update developer/lessons-and-srs.md: section on
  parity-tested cross-language XP rule.
- Update CLAUDE.md.
- Release commit + tag v1.33.0.
- Post-release: CLAUDE.md + handover-to-v1.34.0.
- Commit: "chore(release): bump version to v1.33.0"
  then "docs: post-release v1.33.0 documentation update"

## Rules

- Parity-test-first: write the Python parity scaffold
  (50A) BEFORE the TS implementation (50B). The
  goldens are the contract.
- Atomic green commits: every commit individually green
  through the full gate chain (make test + mypy +
  pre-commit + tsc + Dexie smoke for storage-touching
  commits).
- The Python lesson-XP formula is the canonical source.
  TS is the port. If they diverge, the TS port is
  wrong unless the spec explicitly changed.
- If a sub-phase hits an unexpected blocker (e.g. the
  Dexie UserXP table shape doesn't carry what we need):
  STOP and surface before writing more code.
- i18n: no new keys needed (the gamification badges
  already shipped translations in 46E.2).
- Decision to confirm before code: how is "activity
  dates" sourced in Dexie mode? In API mode it's a
  SELECT on LearningSession.started_at filtered by
  project FK. In Dexie mode the equivalent is
  db.learningSessions.where("project_id").anyOf(...)
  joined to the user's projects. Or simpler:
  db.learningSessions.toArray() filtered in JS. Pick
  the simpler path; the data sets are small.

## Discipline

Same pattern as Phases 46 + 49:
1. Pre-flight + read source docs
2. Propose a commit plan + open decisions explicit
3. WAIT for user green-light before writing code
4. Execute top-to-bottom; each commit individually
   green
5. Release commit + tag + ask for push + GitHub-release
   authorization

Suggested cadence (6 atomic + 2 release = 8 commits).
Substantially smaller than Phase 49 because the
parity scaffold pattern is already established + the
LOC count is much smaller (~150 LOC vs Phase 49's
~957).

Start with pre-flight, then propose the plan.
```

---

## 3. Choosing between variants

| Situation | Use |
|---|---|
| You haven't decided which workstream | § 1 skeleton |
| You want to close the Dexie-mode gamification gap (the cleanest follow-on) | § 2 specific |
| You want to tackle a different candidate from handover § 2 | Adapt § 2's shape with your scope |

Either way the session will:
1. Run the pre-flight chain
2. Read the handover + CLAUDE.md + rules
3. Propose a commit plan
4. Wait for green-light
5. Execute

That contract is identical across all of Phase 46, Phase
49, and any future phase using this kickoff pattern.

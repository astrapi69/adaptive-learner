# Handover — after v1.30.0, before v1.31.0

**Written**: 2026-05-27 (end of Phase 46 sub-phases A-D session).

This document is the cold-pickup brief for the next session.
Anyone (or any model) reading this should be able to start
work on v1.31.0 (Phase 46 sub-phases E-F-G) without needing
the prior conversation context.

---

## 1. What just shipped: v1.30.0

**Phase 46 sub-phases A-D — Element-Level Error Tracking +
SRS Review Sessions** (EXP-007 / P-129). The "adaptive" in
"Adaptive Learner" finally means something: every wrong
answer writes a per-element ``ElementError`` row keyed by
the specific word / pair / phrase the user missed. Mastery
flips at 3 consecutive correct (``MASTERY_THRESHOLD=3``); a
mastered element that gets a wrong answer demotes back into
the queue. The Dashboard surfaces a "X elements due for
review" card; clicking it opens a synthesised mini-lesson
that re-plays exactly the failed exercises.

Full per-release detail: ``changelog/releases/v1.30.0.md``.
Per-commit detail:
``docs/journal/chat-journal-session-2026-05-27-phase46.md``.

### Test counts (the new baseline)

```
Backend pytest:     980 (+1 skipped)
Plugin tests:       826 (12 suites)
Vitest:             1748
Aggregate:          3554 (+1 skipped)
Dexie smoke gate:   18/18
```

### Files touched (overview)

- **Backend**: new ``ElementError`` model + Alembic 0019 +
  ``app/services/{element_errors,element_srs}.py`` + 2
  routes on ``app/routers/element_errors.py`` + 4 Pydantic
  schemas + sync_service entry.
- **Frontend**: 4 new utility modules
  (``lib/{lesson-summary,element-attempt,review-lesson}.ts``
  + ``hooks/useReviewLesson.ts``), 1 new page
  (``pages/Review.tsx``), 1 new component
  (``components/dashboard/ReviewQueueCard.tsx``), 1
  extracted component
  (``components/exercises/ExerciseDispatcher.tsx``), 4
  exercise components extended, Dexie schema v18 + new
  ``element-errors-dexie.ts`` service, full
  ``IStorageService.elementErrors`` namespace wiring.
- **i18n**: 24 new keys per catalogue × 8 catalogues =
  192 native translations.

---

## 2. What's deferred: v1.31.0 scope (Phase 46 E-F-G)

The user agreed to a two-release split at decision time. The
"unification" half — XP / streak / badge / ProgressCommit
integration plus the schema work to make lesson completions
visible in the existing tracking UI — lands in v1.31.0.

### 2.1 Sub-phase 46E — Gamification Integration

- On lesson completion: award XP via the existing
  ``on_session_complete`` hook (the gamification plugin's
  existing implementation does the actual XP write — see
  ``plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/plugin.py``).
- XP formula per user spec:
    - Base: 30 XP per completed lesson
    - Bonus: +10 XP per star (0-3 stars → +0 to +30 XP)
    - Bonus: +20 XP for 3-star on first attempt
    - Streak bonus: same multiplier as existing sessions
- New badge predicates to add to the seed catalog:
    - "First Lesson"
    - "10 Lessons Completed"
    - "3-Star Streak" (3 consecutive 3-star lessons)
    - "Review Master" (mastered 50 elements)
- For the badge predicates, the gamification plugin's
  ``badge_service.evaluate_user`` is the integration point.
  Pattern: a predicate function reads from the DB, returns
  bool. Add one per new badge key.

### 2.2 Sub-phase 46F — LessonProgress ↔ LearningSession unification

**This is the load-bearing decision the user already
confirmed at v1.30.0 decision time: D1 = (b) pseudo-project.**

When a lesson completes:
1. Find or auto-create a "Content Lessons" pseudo-project
   for the user (one per user, identified by a new
   ``LearningProject.kind="content"`` column).
2. Create a ``LearningSession`` row with that project_id,
   ``session_type="lesson"`` (new — or fold into the
   existing ``method`` column), ``status="completed"``.
3. Call ``on_session_complete`` — the gamification plugin's
   existing handler fires and awards XP / evaluates badges
   without any new hook code.

The schema change is the main risk:
- Add ``LearningProject.kind: str default "standard"`` (or
  similar). Existing rows back-fill to "standard"; the
  pseudo-project row carries "content".
- Optionally add ``LearningSession.session_type`` if you
  want to distinguish "lesson" from "ai_chat" at the
  session level (current ``method`` field is one of the
  six methods, not a session-type). Recommendation: don't
  add — derive "kind" via the parent project's ``kind``.
- Filter ``kind="content"`` out of project lists in:
    - Dashboard's project filter bar
    - Onboarding (pseudo-project shouldn't appear as a
      legit learning project)
    - LearningRepoSettings (no learning-repo for content
      lessons)

UI surface that should pick up content lessons "for free"
after this work:
- Dashboard RecentSessions widget
- Progress page timeline
- StreakWidget / StreakCalendar (streak counts a day if
  there's any session that day, regardless of type)

### 2.3 Sub-phase 46G — Documentation + Verification + Release

- User-guide updates: lesson flow, review sessions, SRS
  (docs/help/{en,de}/...)
- Developer-guide updates: element tracking, SRS scheduling
  (docs/explorations/ or docs/developers/)
- Test scenarios from the original spec (1-8). All should
  work end-to-end after E + F land.
- v1.31.0 release: changelog, sync-versions, tag, push,
  GitHub release.

---

## 3. Architectural decisions still in force

From the v1.30.0 session — these stay confirmed for
v1.31.0; the user does NOT need to re-litigate:

| ID | Decision | Status |
|----|----------|--------|
| **D1** | Pseudo-project "Content Lessons" for unification | **Activate in v1.31.0 (46F)** |
| **D2** | Lesson-scoped element keys (same word, two lessons = two rows) | Unchanged; v1.31.0 doesn't touch element keys |
| **D3** | Review = replay original exercises (no generation, no cloze) | Unchanged; v1.31.0 doesn't touch review content |
| **D4** | ``MASTERY_THRESHOLD=3`` hardcoded | Unchanged |
| **D5** | Reuse ``on_session_complete`` via pseudo-project (no new hook) | **Activate in v1.31.0 (46E + F)** |

### Open decisions for v1.31.0 prep (the user will need to answer these)

1. **Pseudo-project lifecycle**: auto-create on first
   lesson completion (lazy) or seed during onboarding
   (eager)? Lazy is simpler but means a user with
   lessons-in-progress but no completions yet has no
   pseudo-project; eager guarantees it exists but seeds a
   "fake" project on every new user.
   - Recommendation: **lazy**. Onboarding shouldn't know
     about Content Lessons; the first lesson completion
     creating the pseudo-project is fine.

2. **LearningSession.method for content lessons**: the
   six-method enum doesn't include "content". Options:
   - (a) Add "content" as a 7th method value. Touches the
     method enum + assessment plugin + tracking aggregator.
   - (b) Hardcode "inductive" (or any one of the six).
     Pragmatic but conceptually wrong.
   - (c) Derive from lesson content (vocabulary-heavy →
     "inductive", grammar-heavy → "deductive", etc.).
     Hard to do right; needs domain authoring.
   - Recommendation: **(a)** add "content" as a value.
     Cleanest. Most code already iterates the method
     enum and will handle a new value transparently.

3. **Badge thresholds**: the user spec lists "10 Lessons
   Completed", "50 elements mastered", "3-Star Streak"
   (consecutive). All three thresholds are pickable. Stay
   with the spec's numbers OR tune?
   - Recommendation: ship as spec'd. Tuning needs real
     usage data.

4. **XP-per-star formula**: spec says +10/+20/+30 for
   1/2/3 stars + a "+20 first-attempt 3-star bonus". Easy
   to compute. Confirm.

---

## 4. Gotchas + recurring false positives

Most of the IDE false positives from the prior handover
still apply. Repeating them here so the next session
doesn't waste time chasing them.

### 4.1 IDE static-analysis false positives (ignorable)

| Diagnostic | Reality |
|---|---|
| `pytest`: Cannot find module | pytest is in the backend venv, not site-packages. Tests run fine via `make test*`. |
| `sqlalchemy` / `sqlalchemy.orm`: Cannot find module | Same backend-venv issue. |
| `alembic` / `alembic.config`: Cannot find module | Same. |
| `app.exceptions` / `app.paths`: Cannot find module (in plugin code) | Plugin runs inside the backend venv at runtime where backend's `app.*` is on sys.path. |
| `Parameter `client` unused` (in pytest) | TestClient fixture is load-bearing for the lifespan even when the body doesn't reference it directly. |
| Import `ReviewQueueItemOut` unused (between Edit operations) | Becomes "used" once the route that consumes it lands. Cleared after the next Edit. |

### 4.2 Real footguns surfaced this session

1. **CI gates I wasn't running locally** (the big one).
   The release-workflow lists `cd backend && poetry run
   pre-commit run --all-files` and `cd backend && poetry
   run mypy app/` as MANDATORY but my `make test` chain
   doesn't include them. Two CI red events this session
   (`dc853c4` ruff-format, `9275841` mypy) directly
   traced to skipping these. **Fix going forward: run
   both before EVERY commit**, not just at release time.

2. **mypy + sort-key return types**: `app/services/element_srs.py`'s
   `_sort_key` returns `tuple[int, int, int]` but I'd
   originally annotated it `tuple[int, int, datetime]`
   when the implementation used datetime. Switching to
   microseconds-as-int for negation was correct; the
   annotation stayed stale. mypy caught it on CI; local
   would have caught it too with the discipline above.

3. **SQLite tz-strip on roundtrip**: `DateTime(timezone=True)`
   columns lose tzinfo when round-tripped through SQLite
   (the in-memory test DB). Comparing a freshly-read
   datetime against a captured pre-flush datetime can fail
   on the tzinfo field even though the wall-clock is
   identical. Fix in tests: `.replace(tzinfo=None)` on
   both sides before equality. Fix in production code:
   `_ensure_utc` helper that re-stamps as UTC if tzinfo
   is None. Both patterns shipped this session.

4. **`document is not defined` in vitest**: running
   `npx vitest run ...` from the wrong cwd (anywhere but
   `frontend/`) makes vitest miss its config and default
   to the `node` environment. Always `cd /full/path/to/frontend
   && npx vitest run`, OR use `make test-frontend` from
   anywhere (the Makefile cd's correctly). The shell's
   cwd doesn't persist between Bash tool calls — every
   call starts fresh.

5. **`onComplete` contract migration**: when I extended
   the 4 exercise components from `{correct, total}` to
   `{correct, total, attempts: ElementAttempt[]}`, every
   `toHaveBeenCalledWith({correct, total})` assertion
   broke. Bulk-rewrote 13 of them to
   `expect.objectContaining({correct, total})`. Pattern:
   `python3 -c "import re; ..."` in a bash loop over the
   4 test files. Future contract migrations need the
   same sweep.

6. **Pre-commit auto-fixes leave the file modified**.
   `pre-commit run --all-files` exits non-zero AND
   modifies the files in place when ruff-format fires.
   The fix is to re-run pre-commit (now it passes) and
   commit the modified files. The first run is the
   "detect + fix" step; the second is the "verify".

7. **Plugin pyproject + lockfile pairing hook**. The
   `plugin-lock-paired-with-pyproject` pre-commit hook
   blocks a commit that stages a plugin pyproject.toml
   change WITHOUT a paired poetry.lock change. For
   `make sync-versions` runs that touch every plugin's
   pyproject (version bump), this hook stays green
   because sync-versions doesn't change dep specs — only
   the version string. But if you bump a plugin's deps
   directly, regenerate that plugin's lockfile in the
   same commit.

### 4.3 Discipline reinforced

- **Atomic-green-commit cadence still scales**: 17 source
  commits + 2 CI-recovery + 2 release commits in this
  session, each individually green. The split-by-concern
  + commit-by-commit pattern works at this scale.
- **Decision-confirmation discipline**: the 4 pre-commit
  decisions for v1.30.0 kept momentum tight. v1.31.0
  has 4 open decisions (above); same discipline applies.
- **i18n native translations**: not English passthrough.
  Real umlauts (ä/ö/ü/ß) in DE per the lessons-learned
  rule. Native Japanese phrasing. 8 catalogues every
  time.

---

## 5. State at end of session

### Git

```
HEAD:    6cfc993 docs: post-release v1.30.0 documentation update
Tag:     v1.30.0 (annotated, pushed to origin)
Branch:  main, in sync with origin/main
Clean working tree.
```

### Recent commits (latest 10)

```
6cfc993 docs: post-release v1.30.0 documentation update
7386744 chore(release): bump version to v1.30.0
fd6a04d test(e2e): Dexie smoke gate covers /review/:setId (Phase 46D / C17 / P-129)
ac81d94 feat(lesson): useReviewLesson + /review/:setId page (Phase 46D / C15 / P-129)
976cd53 refactor(exercises): extract ExerciseDispatcher to shared module (Phase 46D prep)
9275841 fix(srs): mypy return-type annotation on _sort_key (CI fix)
7a0380d feat(lesson): synthesizeReviewLesson utility (Phase 46D / C14 / P-129)
bd9cf53 feat(dashboard): ReviewQueueCard widget (Phase 46C / C13 / P-129)
c96ddb8 feat(srs): Dexie-side review-queue + IStorageService wiring (Phase 46C / C12 / P-129)
9320c6d feat(srs): element-level review-queue computation + endpoint (Phase 46C / C11 / P-129)
```

### Files of interest for v1.31.0

#### For sub-phase 46E (gamification)

- ``plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/plugin.py``
  — the existing ``on_session_complete`` hook impl. Add
  new XP rules for lesson completion HERE (the gamification
  plugin's hook fires automatically once the
  pseudo-project LearningSession is created in 46F).
- ``plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/xp_service.py``
  — the XP-award functions. May need a new
  ``award_xp_for_lesson_session`` that knows about the
  star-bonus formula.
- ``plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/badge_service.py``
  — the badge predicate evaluator. Add new predicates for
  "First Lesson", "10 Lessons Completed", "3-Star Streak",
  "Review Master".
- ``plugins/adaptive-learner-plugin-gamification/badges.yaml``
  — the seed catalog. Add the 4 new badges with i18n keys.

#### For sub-phase 46F (unification)

- ``backend/app/models/__init__.py``:
  - ``LearningProject`` — add ``kind: str
    default "standard"`` column.
  - Possibly extend ``LearningSession`` — but recommend
    NOT; derive lesson-vs-AI via parent project's kind.
- New Alembic migration: ``0020_project_kind.py``
- ``backend/app/services/lesson_progress.py`` —
  ``mark_completed`` is where the pseudo-project creation
  + LearningSession write should happen.
- Frontend Dashboard project filter:
  ``frontend/src/components/DashboardFilterBar.tsx``.
- Frontend Onboarding (filter out content projects):
  ``frontend/src/pages/Onboarding.tsx``.
- Streak surface:
  ``plugins/adaptive-learner-plugin-gamification/adaptive_learner_gamification/streak_service.py``
  — should "just work" once LearningSession rows exist
  for lesson completions. Verify ``_activity_dates_for_user``
  picks them up.

#### For sub-phase 46G (docs + release)

- User docs: ``docs/help/{en,de}/`` — new pages for
  lesson flow + SRS + reviews.
- Developer docs: ``docs/developers/`` — element tracking
  + SRS scheduling architecture.
- Standard release chain: ``backend/pyproject.toml`` bump
  + ``make sync-versions`` + write
  ``changelog/releases/v1.31.0.md``.

### CI status

CI was red TWICE this session — both recovered by
intermediate commits (`dc853c4` ruff-format, `9275841`
mypy). The push of `6cfc993` is the latest; check
`gh run list --limit 3` to confirm it's green before
starting v1.31.0 work.

### Open backlog items (from BACKLOG.md)

- **PHASE-42-STORAGE-ABSTRACTION-01** (P0, from prior
  session) — proper port of Learning Repository to
  IStorageService. Still open. Not blocking v1.31.0.
- **P-131..P-140** (EXP-013, Phase 2 in BACKLOG) —
  these were the "Adaptive Lektionen Stufe 1-2" tasks
  that the v1.30.0 work effectively pulled forward from
  Phase 2. The BACKLOG entries can be marked closed in
  the v1.31.0 release notes.

---

## 6. Pre-flight discipline (the gate chain)

**This is the new mandatory pre-commit chain.** I caught
two CI red events this session by skipping parts of it.
Going forward, every commit:

```bash
# Required, in order:
make test                            # backend + plugins + Vitest
cd backend && poetry run mypy app/   # NEW — added this session
cd backend && poetry run pre-commit run --all-files   # NEW — added this session
# For release commits, additionally:
make test-dexie-smoke                # Dexie release gate
cd frontend && npm run build         # production build
```

If pre-commit's ruff-format fires it MODIFIES the files in
place; re-run, re-stage, commit. Don't try to commit the
"red" run.

---

## 7. Suggested commit cadence shape for v1.31.0

Estimated **8-12 atomic commits + 2 release commits**.
Substantially smaller than v1.30.0 because the foundation
already exists.

| Sub-phase | Commits | What |
|---|---|---|
| 46E.1 | 1-2 | New XP rules + helper (`award_xp_for_lesson_session`) + tests |
| 46E.2 | 1-2 | 4 new badge predicates + seed catalog + tests |
| 46F.1 | 1-2 | `LearningProject.kind` column + Alembic 0020 + sync surface + tests |
| 46F.2 | 1-2 | Pseudo-project auto-create + LearningSession write in `mark_completed` + tests |
| 46F.3 | 1-2 | Frontend filters (Dashboard project bar + Onboarding) + tests |
| 46G.1 | 1-2 | User + developer docs |
| 46G.2 | 2 | Release commit + post-release docs |

Decision points to confirm BEFORE writing code:
1. Pseudo-project lifecycle (lazy vs eager) — see § 3
2. `LearningSession.method` value for content lessons — see § 3
3. Badge thresholds — confirm spec defaults or tune
4. XP formula — confirm spec defaults

---

## 8. Cold-pickup checklist for the next session

Run these in order before any code:

```bash
# 1. Confirm state
git log --oneline -5
git status --short

# 2. Baseline test gates (should all be green)
make test                  # expect 980 backend + 826 plugins + 1748 Vitest
make test-dexie-smoke      # expect 18/18 green
cd backend && poetry run mypy app/   # expect "Success: no issues found"
cd backend && poetry run pre-commit run --all-files   # expect all Passed

# 3. Confirm CI is green on the latest push
gh run list --limit 3
```

If any baseline doesn't match, **STOP and investigate**
before proceeding with v1.31.0.

Then read, in order:
1. `CLAUDE.md`
2. `.claude/rules/` (all files — especially
   lessons-learned.md and ai-workflow.md)
3. This file (handover-to-v1.31.0.md)
4. `changelog/releases/v1.30.0.md` (the per-release detail)
5. `docs/journal/chat-journal-session-2026-05-27-phase46.md`
   (the per-commit detail from this session)

Then propose the v1.31.0 commit plan with the 4 open
decisions explicit, wait for green-light, execute.

---

End of handover.

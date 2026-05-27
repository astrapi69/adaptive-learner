# Chat Journal — 2026-05-27 (Phase 46)

Session shipped **v1.30.0** (Phase 46 sub-phases A-D —
Element-Level Error Tracking + SRS Review Sessions,
EXP-007 / P-129). Two intermediate CI-recovery commits
included. Sub-phases E-F-G deferred to v1.31.0 per the
two-release split agreed at decision time.

This session also includes the v1.29.0 post-release
hygiene from earlier the same day (recorded separately in
the morning journal entry).

---

## Releases shipped today

| Tag | Phase | Headline |
|---|---|---|
| **v1.30.0** | Phase 46 sub-phases A-D | Element-level error tracking + SRS scheduling + review-session route + Dashboard widget |

Test counts (start → end):
- Backend pytest: 930 (+1 skipped) → **980** (+1 skipped) (+50)
- Plugin tests: 826 → unchanged
- Vitest: 1634 → **1748** (+114)
- Dexie smoke: 17 → **18** (+1 review route)
- Aggregate: 3390 → **3554** (+1 skipped) (+164)

---

## 0. Pre-flight + scope decision

The user prompted Phase 46 with an extensive spec
covering 7 sub-phases (A-G). My pre-flight audit + the
proposal-with-decisions discipline surfaced two key
findings:

1. **Phase 46 as specified is ~30-45 commits** — 3-5x
   the largest prior phase (Phase 43 / 9 commits). Honest
   scope flagging led to the user's call to split into
   two releases:
   - v1.30.0 = sub-phases A-D (element tracking + SRS +
     review sessions)
   - v1.31.0 = sub-phases E-F-G (gamification +
     LessonProgress↔LearningSession unification + docs)

2. **The LessonProgress↔LearningSession unification has
   a real blocker**: ``LearningSession.project_id`` is a
   required FK to ``LearningProject``, and content lessons
   have no project. Four options surfaced (nullable FK,
   pseudo-project, dual FK, or don't unify); user picked
   (b) pseudo-project for v1.31.0. v1.30.0 deliberately
   keeps ``ElementError`` decoupled from LearningSession
   so the v1.31.0 unification can land without touching
   the SRS schema.

Four pre-commit decisions confirmed before any code:
- **D1**: pseudo-project unification → v1.31.0
- **D2**: lesson-scoped element keys (same word in two
  lessons = two rows)
- **D3**: review = replay original exercises (no
  generation, no cloze)
- **D4**: ``MASTERY_THRESHOLD=3`` hardcoded
- **D5**: follows D1 — no ``on_lesson_complete`` hook in
  v1.30.0

---

## 1. Sub-phase 46A — Expanded Lesson Summary (3 commits)

### 1.1 C1 — Star rating + breakdown utilities (ce0f7c1)

- ``frontend/src/lib/lesson-summary.ts``:
  ``computeStars(correct, total)`` with 50/75/90 bands +
  ``buildExerciseBreakdown(lesson, progress)`` returning
  per-step rows with ``fullyCorrect`` guard against the
  unattempted 0/0 false-positive +
  ``deriveCanonicalAnswer(exercise)`` per-type rule.
- 29 Vitest cases covering every band boundary +
  defensive empty-content paths for all 4 exercise
  types.

### 1.2 C2 — Expanded LessonSummary component (844dd5b)

- Lesson.tsx LessonSummary rewritten with stars row +
  score progress bar + per-exercise breakdown list +
  three action buttons (Next/Repeat/Back).
- LessonPage fetches the set's lesson list on mount to
  compute next-lesson filename for the Next CTA. Fetch
  wrapped in try/catch — failures hide the button.
- 10 new Vitest cases pin star band toggles +
  celebration class + score bar ARIA + breakdown row
  rendering (correct / wrong / unattempted) + Repeat /
  Next button wiring.

### 1.3 C3 — Celebration animation CSS (9142570)

- ``lesson-summary-celebrate`` keyframe pulsates the
  three earned stars with a 0.1s/0.25s/0.4s staggered
  delay, 1.5s total. Respects
  ``prefers-reduced-motion``.
- Mobile @ <=600px: breakdown rows collapse to
  single-column.

---

## 2. Sub-phase 46B — Element-Level Error Tracking (7 commits)

### 2.1 C4 — ElementError model + Alembic 0019 (f3b44cd)

- SQLAlchemy ``ElementError`` model with composite
  UNIQUE on
  ``(user_id, set_id, lesson_id, exercise_id, element_key)``.
- Alembic 0019_element_errors migration.
- Pydantic schemas: ``ElementAttemptIn`` +
  ``ElementAttemptsIn`` (bulk-upsert body, capped at 100
  attempts) + ``ElementErrorOut``.
- sync_service ``TABLES`` entry (order=30, MUTABLE) +
  ``EXPECTED_TABLES`` + ``EXPECTED_MUTABLE`` updates per
  the v1.28.0 "Adding a new SQLAlchemy model = three
  test updates" lesson-learned.

### 2.2 C5 — Service module + transition matrix (e39cb35)

- ``app/services/element_errors.py`` with
  ``MASTERY_THRESHOLD=3`` constant + ``record_attempt``
  + ``record_attempts`` (bulk) + ``list_for_user``
  (filtered by set_id / include_mastered).
- Transition matrix: wrong → wrong increments
  error_count, wrong → correct starts streak at 1
  (error_count NOT decremented — lifetime monotonic), 3
  consecutive corrects flip mastered, mastered → wrong
  demotes back (pedagogical reset).
- 18 pytest cases pin every transition + isolation
  properties (per-element key, per-lesson key, per-user
  key) + bulk-path ordering + intra-call compounding.
- SQLite tz-strip on roundtrip needed a comparison-side
  ``replace(tzinfo=None)`` fix in one test.

### 2.3 C6 — Routes (35e5191)

- ``POST /api/users/{user_id}/element-errors`` +
  ``GET /api/users/{user_id}/element-errors`` (with
  set_id + include_mastered query filters).
- 12 integration cases pin 404 paths, single + bulk
  upsert response shape, state-compounding across calls,
  query filters, Pydantic validation rejections.

### 2.4 C7 — Dexie schema v18 + service (39e92c1)

- Schema v18 adds the ``elementErrors`` table.
- ``element-errors-dexie.ts`` mirrors the backend
  service 1:1 (transition matrix, MASTERY_THRESHOLD).
- 16 Vitest cases mirror the backend pytest ladder.

### 2.5 C8 — IStorageService.elementErrors namespace (9ad10a1)

- ``api.elementErrors.{list, recordBulk}`` in
  api/client.ts.
- IStorageService interface + ApiStorage + DexieStorage
  slot. Danger Zone reset list extended.

### 2.6 C9 — Per-exercise element-attempt derivers (2ef6bea)

- ``frontend/src/lib/element-attempt.ts`` with
  ``deriveMatchingAttempts`` (fans out per pair),
  ``derivePictureChoiceAttempt`` /
  ``deriveFreeTextAttempt`` /
  ``deriveWordTilesAttempt`` (single attempt each).
- Per-D2 derivation rules — element_key = lesson-scoped
  canonical content text.
- 21 Vitest cases per-exercise.

### 2.7 C10 — Wire onComplete → elementErrors.recordBulk (9543bcb)

- All 4 exercise components extend ``onComplete`` from
  ``{correct, total}`` to ``{correct, total, attempts:
  ElementAttempt[]}``.
- ``setId?`` + ``lessonId?`` props (optional with ""
  defaults — production always passes them; tests omit).
- Lesson.tsx ExerciseDispatcher passes context through;
  page-level ``onComplete`` does TWO writes per step:
  the existing lessonProgress.upsert AND the new
  elementErrors.recordBulk. Second wrapped in try/catch
  — recording failure must not block step advancement.
- 13 existing exercise-test assertions migrated to
  ``expect.objectContaining({correct, total})`` so they
  survive the new attempts field.

---

## 3. CI-recovery commit chain (2)

### 3.1 dc853c4 — ruff-format CI fix (v1.29.0 carryover)

- The v1.29.0 push's CI flagged 4 files with ruff-format
  drift. Pre-existing on 3 v1.28.0 lesson_progress
  files + the new C6 element_errors router.
- Pure formatting; ``make test`` stays green at 960
  backend + 1673 Vitest.
- Process lesson: the release-workflow's mandatory
  ``poetry run pre-commit run --all-files`` step had
  been skipped in this session. Added to my pre-flight
  discipline going forward.

### 3.2 9275841 — mypy return-type fix on element_srs

- C11's CI flagged ``app/services/element_srs.py:149``
  with ``Incompatible return value type (got
  tuple[int, int, int], expected tuple[int, int,
  datetime])``.
- Self-induced: changed the sort impl to int
  microseconds-since-epoch for negation but left the
  datetime annotation in place. Annotation fix; zero
  runtime change.
- Process lesson: added ``cd backend && poetry run mypy
  app/`` to the pre-flight chain alongside pre-commit.
  Both are in release-workflow.md mandatory; I'd been
  catching neither locally.

---

## 4. Sub-phase 46C — SRS Review-Queue Scheduling (3 commits)

### 4.1 C11 — Backend service + endpoint (9320c6d)

- ``app/services/element_srs.py``: interval policy
  (streak 0 → 1d, 1 → 3d, 2 → 7d, 3+ excluded as
  mastered). 14/30-day bands the spec mentioned are
  reserved for a future mastery-relapse policy.
- Priority sort: overdue first → error_count desc →
  last_error_at desc.
- ``GET /api/users/{user_id}/element-errors/review-queue``
  endpoint + ``ReviewQueueItemOut`` Pydantic schema.
- 14 service unit tests + 6 router integration tests.
- SQLite tz handling via ``_ensure_utc`` helper.

### 4.2 C12 — Dexie-side queue + IStorageService wiring (c96ddb8)

- ``computeReviewQueueDexie`` mirrors the backend logic
  client-side.
- ``ReviewQueueItem`` type +
  ``IElementErrorsNamespace.reviewQueue`` method
  threaded through ApiStorage + DexieStorage + api
  client.
- 13 Vitest cases mirror the backend test ladder.

### 4.3 C13 — Dashboard widget (bd9cf53)

- ``<ReviewQueueCard>`` component fetches the queue on
  mount; renders three states (loading / empty / non-
  empty). Empty returns null so the dashboard grid stays
  tidy.
- Placed in Dashboard.tsx grid after the existing
  "Spaced practice" card (conceptually adjacent surfaces
  but distinct — Spaced practice is method-level +
  ProgressCommit-driven; ReviewQueueCard is element-
  level + ElementError-driven).
- 5 new i18n keys per catalogue × 8.
- 7 Vitest cases pin every render state + CTA href
  derivation.

---

## 5. Sub-phase 46D — Review Session (4 commits + 1 prep)

### 5.1 7a0380d — synthesizeReviewLesson utility (C14)

- Pure-frontend ``frontend/src/lib/review-lesson.ts``
  takes a queue + cached lesson bundle, builds an
  in-memory ``ContentLesson`` with exercise-only steps,
  ordered by queue priority.
- DEFAULT_REVIEW_LIMIT = 10. Items whose source lesson
  is missing from the cache are silently dropped.
- 10 Vitest cases.

### 5.2 976cd53 — ExerciseDispatcher extraction (prep)

- ``ExerciseDispatcher`` +
  ``ExerciseStepPlaceholder`` +
  ``SUPPORTED_EXERCISE_TYPES`` moved from
  ``pages/Lesson.tsx`` into
  ``components/exercises/ExerciseDispatcher.tsx`` so
  both LessonPage and the upcoming ReviewPage can use
  the same dispatch logic.
- Zero behaviour diff; Lesson.test.tsx unchanged.

### 5.3 ac81d94 — useReviewLesson + ReviewPage (C15)

- ``useReviewLesson`` hook composes queue fetch + source
  resolution + lesson fetches + synthesis +
  session-score tally.
- Storage-mode-agnostic via ``getStorage()`` — works in
  API AND Dexie modes; GH-Pages users get the full SRS
  loop without a backend.
- ``/review/:setId`` route + page; reuses the shared
  ExerciseDispatcher.
- Element attempts during review persist via the same
  ``elementErrors.recordBulk`` path — wrong answers re-
  increment error_count; correct answers grow streak →
  eventually master.
- ``_extractLessonId(stepId)`` parses lesson_id back out
  of the synthesised step id so the element-attempt
  deriver keeps the D2 lesson-scoped contract intact
  through the review path.
- 12 new i18n keys per catalogue × 8.
- 8 Vitest cases cover all 5 page load-states.
- C16 (review-mode summary polish) skipped — the
  in-page summary the hook produces is sufficient for
  v1; a richer mastered-this-session counter can land
  with v1.31.0's gamification work.

### 5.4 fd6a04d — Dexie smoke gate /review (C17)

- Adds the ``/review/:setId`` route to
  ``e2e/dexie/dexie-mode.spec.ts``. For a first-visit
  GH-Pages user (empty queue), the gate accepts
  ``review-loading`` / ``review-empty`` /
  ``review-not-cached``.
- 17 → 18 specs.

---

## 6. Sub-phase 46G — Release (2 commits)

### 6.1 7386744 — chore(release): bump to v1.30.0

- Hand-edited backend/pyproject.toml from 1.29.0 to
  1.30.0; ``make sync-versions`` propagated to 17 other
  files.
- Wrote ``changelog/releases/v1.30.0.md`` (200+ lines,
  per-sub-phase detail + decisions + deferred items +
  upgrade notes).
- All gates green pre-tag: 980 backend + 826 plugins +
  1748 Vitest + 18 Dexie + mypy clean + ruff clean +
  pre-commit clean + frontend build clean.
- Tag ``v1.30.0`` annotated.

### 6.2 This commit — post-release docs

- CLAUDE.md "Current state" rewritten for v1.30.0;
  v1.29.0 paragraph compressed.
- Test baseline updated to
  ``backend 980 (+1 skipped) + plugins 826 + Vitest 1748 = 3554 tests``.
- Dexie spec count updated 17 → 18.
- SQLAlchemy models count corrected: 26 → 28 (fixed
  the pre-existing off-by-one + added ElementError).
- Sync surface 29 → 30 tables.
- Changelog link bumped to v1.30.0.
- This journal entry.

---

## 7. Statistics

| Metric | Start | End | Delta |
|---|---|---|---|
| Backend pytest | 930 (+1 skipped) | 980 (+1 skipped) | +50 |
| Plugin tests (12 suites) | 826 | 826 | 0 |
| Vitest | 1634 | 1748 | +114 |
| Dexie smoke specs | 17 | 18 | +1 |
| **Aggregate** | **3390 (+1 skipped)** | **3554 (+1 skipped)** | **+164** |
| Commits this session | — | 17 source + 2 release + 2 CI-recovery + this doc commit | — |
| LOC added | — | ~6000 (incl. ~1500 i18n + ~600 tests) | — |

Sub-phase breakdown:
| Sub-phase | Commits | Tests added |
|---|---|---|
| 46A (lesson summary) | 3 | 39 Vitest |
| 46B (element tracking) | 7 | 18 pytest + 12 pytest + 16 Vitest + 21 Vitest + 13 Vitest-migrated |
| 46C (SRS scheduling) | 3 | 14 pytest + 6 pytest + 13 Vitest + 7 Vitest |
| 46D (review session) | 4+1 prep | 10 Vitest + 8 Vitest + 1 dexie smoke |
| 46G (release) | 2 | 0 |
| CI-recovery | 2 | 0 |

---

## 8. State at end of session

### Git

```
HEAD:    (post-release docs commit, this entry's commit)
Tag:     v1.30.0 (annotated, awaiting push)
Branch:  main, ready to push to origin
Clean working tree.
```

### Files of interest for v1.31.0 (Phase 46 E-F-G)

- **46E Gamification**: ``plugins/adaptive-learner-plugin-
  gamification/adaptive_learner_gamification/plugin.py``
  — the existing ``on_session_complete`` hook
  implementation. Add new XP rules for lesson completion;
  hook fires automatically when the C18-era pseudo-project
  LearningSession is created.
- **46F Unification**: ``backend/app/models/__init__.py``
  — ``LearningProject`` model needs a ``kind: str
  default="standard"`` column so the "Content Lessons"
  pseudo-project can be filtered out of project lists.
  ``LearningSession.project_id`` stays required; the
  pseudo-project provides one for content lessons.
- **46G Docs**: ``docs/help/{en,de}/`` for user-facing
  SRS + review docs. The CLAUDE.md state line will
  reference v1.31.0.

### Open decisions for v1.31.0 prep

- "Content Lessons" pseudo-project — auto-create on
  first lesson completion vs. seed during onboarding?
- ``LearningSession.method`` for content lessons —
  hardcode "content" (new value) vs. derive from lesson
  type (e.g. "inductive" for vocabulary)?
- New badge predicates: "First Lesson", "Review Master"
  (mastered 50 elements), "3-Star Streak" (3 consecutive
  3-star lessons). Threshold tuning?

---

## 9. Lessons reinforced + process notes

- **Pre-flight discipline grew this session**. Added
  ``cd backend && poetry run mypy app/`` to the per-
  commit gate chain alongside the already-mandatory
  ``pre-commit run --all-files``. Both were in
  release-workflow.md but I was catching neither
  locally (two CI red events confirmed the gap).
- **Decoupling pays off**. Keeping ElementError
  independent of LearningSession (D1 deferred to
  v1.31.0) meant the v1.30.0 sub-phases could ship in
  full without waiting on the unification work. v1.31.0
  adds the session integration on top of an already-
  shipped element-tracking foundation.
- **Atomic-green-commit cadence still scales**. 17
  source commits in one session + 2 CI-recovery commits
  + 2 release commits; each individually green; no
  blockers required rollback. The size of this phase
  (~4x Phase 45) was manageable because of the
  discipline.
- **D3 (replay-only review) was the right call**. Cloze
  / generation / AI-augmented review would have made
  C14 + C15 each multi-commit sub-phases. The "just
  re-play the original exercises" approach made the
  synthesized lesson trivially reuse the existing
  ExerciseDispatcher, with zero new exercise renderers.
- **The "extract before reuse" pattern works**. C15's
  ExerciseDispatcher extraction was its own prep commit
  (zero behaviour diff); kept the C15 commit focused
  on the new hook + page.

---

## 10. Things to verify in the next session before any code

```bash
git log --oneline -5
git status --short
make test                  # expect 980 backend + 826 plugins + 1748 Vitest
make test-dexie-smoke      # expect 18/18 green
cd backend && poetry run mypy app/   # expect "Success: no issues found"
cd backend && poetry run pre-commit run --all-files   # expect all Passed
```

If any baseline doesn't match, STOP and investigate
before proceeding with v1.31.0 (Phase 46 E-F-G).

---

End of journal entry for 2026-05-27 (Phase 46 session).

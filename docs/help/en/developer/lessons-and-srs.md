# Lessons + SRS internals

This page documents how the v1.27.0–v1.31.0 content-lesson +
SRS feature stack is wired across the backend, frontend, and
two plugins. For the user-facing overview see
[`user-guide/lessons.md`](../user-guide/lessons.md).

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────┐
│ Frontend: lesson viewer + review session                 │
│   pages/Lesson.tsx  ──→  ExerciseDispatcher  ──→  one of │
│   pages/Review.tsx           ↓               4 exercise  │
│                              ↓               components  │
│                              ↓                           │
│                   recordStepResult                       │
│                              ↓                           │
│                  elementErrors.recordBulk                │
│                              ↓                           │
└──────────────────────────────────────────────────────────┘
                              ↓
                   IStorageService boundary
                              ↓
   ┌─────────────────────┐      ┌─────────────────────────┐
   │ ApiStorage          │      │ DexieStorage            │
   │                     │      │                         │
   │ POST /api/users/    │      │ element-errors-dexie.ts │
   │   {id}/element-     │      │   mirrors the backend   │
   │   errors            │      │   service 1:1 against   │
   │                     │      │   IndexedDB             │
   └─────────────────────┘      └─────────────────────────┘
            ↓
   ┌──────────────────────────────────────────────────────┐
   │ Backend                                              │
   │                                                      │
   │  app/services/element_errors.py                      │
   │    - upsert transition matrix                        │
   │    - MASTERY_THRESHOLD = 3                           │
   │                                                      │
   │  app/services/element_srs.py                         │
   │    - 1d/3d/7d band scheduler                         │
   │    - overdue → error_count → last_error_at sort      │
   │                                                      │
   │  app/services/lesson_progress.py                     │
   │    - upsert_progress with mark_completed flip        │
   │      triggers lesson_session_unification             │
   │                                                      │
   │  app/services/lesson_session_unification.py          │
   │    - find_or_create_content_pseudo_project (lazy)    │
   │    - record_lesson_completion_session                │
   │    - fires on_session_complete via manager._pm.hook  │
   └──────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────────────────────┐
            │ Gamification plugin             │
            │   on_session_complete dispatch  │
            │     method == "content"  →      │
            │       award_xp_for_lesson_      │
            │       session (lesson formula)  │
            │     else →                      │
            │       award_xp_for_session      │
            │       (chat formula, unchanged) │
            │   badge_service.evaluate_user   │
            │     → 4 new lesson predicates   │
            └─────────────────────────────────┘
```

---

## Element-level error tracking (v1.30.0 / Phase 46B)

### Model

``app/models/__init__.py:ElementError`` with a composite
UNIQUE constraint on
``(user_id, set_id, lesson_id, exercise_id, element_key)``.
Lesson-scoped element keys per decision **D2** - the same
word in two different lessons is two rows.

```python
class ElementError(Base):
    user_id: str           # FK → users.id (CASCADE)
    set_id: str            # content set id (string, not FK)
    lesson_id: str         # content lesson id (string, not FK)
    exercise_id: str       # exercise id within the lesson
    element_key: str       # the specific word/pair/phrase
    element_type: str      # "vocabulary" | "grammar_rule"
    user_answer: str
    correct_answer: str
    error_count: int       # incremented on each wrong attempt
    correct_streak: int    # incremented on correct, reset on wrong
    last_error_at: datetime | None
    last_attempt_at: datetime
    mastered: bool         # True iff correct_streak ≥ 3
    mastered_at: datetime | None
```

Decoupled from ``learning_sessions`` (no FK) by design -
content lessons reference content set / lesson IDs by string,
not via a relational join. This means the table survives
cache evictions independent of any session row.

### Upsert transition matrix

``app/services/element_errors.py:upsert_element_error`` is
the only mutator. Behaviour:

| Trigger | Action |
|---|---|
| First sighting (correct) | INSERT row, ``correct_streak=1`` |
| First sighting (wrong) | INSERT row, ``error_count=1`` |
| Existing row, correct attempt | ``correct_streak += 1``; flip ``mastered=True`` iff streak reaches ``MASTERY_THRESHOLD`` (3) |
| Existing row, wrong attempt on a non-mastered row | ``error_count += 1``, ``correct_streak = 0`` |
| Existing row, wrong attempt on a **mastered** row | demote: ``mastered=False``, ``mastered_at=None``, ``correct_streak=0``, ``error_count += 1`` |

The mastery threshold is a code-level constant
(``MASTERY_THRESHOLD = 3``); per decision **D4** it is
intrinsic to the SRS semantics, not a config knob.

### Dexie mirror

``frontend/src/storage/element-errors-dexie.ts`` mirrors the
backend service 1:1 against IndexedDB. The contract on
``IElementErrorsNamespace`` is identical across both storage
implementations, so the dexie-mode release gate
(``make test-dexie-smoke``) catches any drift.

---

## SRS scheduling (v1.30.0 / Phase 46C)

### Interval policy

``app/services/element_srs.py:next_review_due_at`` projects a
non-mastered row's next review:

| ``correct_streak`` | Interval |
|---|---|
| 0 | 1 day after ``last_attempt_at`` |
| 1 | 3 days |
| 2 | 7 days |
| ≥ 3 | mastered - excluded from the queue |

### Priority sort

The review-queue endpoint sorts by:

1. **Overdue first** (``next_review_due_at < now`` ranks
   above ``next_review_due_at > now``)
2. **Error count descending** (more errors = higher
   priority)
3. **Last error first** (most recent failure ranks above
   older failures, microsecond resolution via
   ``-last_error_at.timestamp_us``)

The tuple is keyed by ``_sort_key`` returning
``tuple[int, int, int]`` (the v1.30.0 CI hotfix
``9275841`` pinned the mypy annotation after a refactor
from datetime to integer microseconds).

### Endpoint

``GET /api/users/{user_id}/element-errors/review-queue``
returns the prioritised queue. Dexie-side equivalent:
``computeReviewQueueDexie`` in
``element-errors-dexie.ts``. The Dashboard
``<ReviewQueueCard>`` widget calls one or the other
depending on the configured storage mode and renders the
count + overdue badge + a CTA to the review session.

---

## LessonProgress ↔ LearningSession unification (v1.31.0 / Phase 46F)

### The decision

The v1.30.0 ``ElementError`` work intentionally decoupled
itself from ``LearningSession``. v1.31.0's Phase 46F adds
the unification layer: every content-lesson completion
now writes a ``LearningSession`` row so the existing
gamification + tracking + streak machinery picks it up
without any new hooks.

Three decisions drive the shape:

- **D1 (lazy pseudo-project)**: a "Content Lessons"
  ``LearningProject`` with ``kind="content"`` is auto-
  created on first lesson completion (never seeded
  during onboarding). One per user.
- **D2 (``method="content"`` 7th value)**: added to the
  set of valid ``LearningSession.method`` values
  specifically for the unification path. The other six
  methods (deductive / inductive / error_based /
  dialogic / contextual / ai_adaptive) cover chat
  sessions unchanged.
- **D5 (reuse, don't extend)**: no new hookspec.
  ``record_lesson_completion_session`` fires the
  existing ``on_session_complete`` hook via
  ``manager._pm.hook``. The gamification + tracking
  plugins' existing handlers run as if the lesson were
  a chat session, with dispatch on ``method``.

### Schema change

```python
# app/models/__init__.py - Phase 46F.1
LEARNING_PROJECT_KIND_STANDARD = "standard"
LEARNING_PROJECT_KIND_CONTENT = "content"

class LearningProject(Base):
    ...
    kind: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=LEARNING_PROJECT_KIND_STANDARD,
        server_default=LEARNING_PROJECT_KIND_STANDARD,
    )
```

Alembic ``0020_learning_project_kind`` adds the column via
``batch_alter_table`` + ``add_column`` with
``server_default="standard"`` so existing rows back-fill
cleanly on SQLite. Sync surface picks up the column so the
round-trip through ``ApiStorage`` ↔ ``DexieStorage`` works
in both directions.

### Unification helper

``app/services/lesson_session_unification.py`` has two
public functions:

- ``find_or_create_content_pseudo_project(db, user_id)`` -
  idempotent lookup; creates only on miss.
- ``record_lesson_completion_session(db, *, user_id,
  lesson_progress_id, score_correct, score_total)`` -
  writes the ``LearningSession`` row, commits, then fires
  ``on_session_complete``.

Both are invoked from
``app/services/lesson_progress.py:upsert_progress`` when
the row flips from ``in_progress`` to ``completed``. The
helper's own DB writes propagate exceptions (real DB
problem), but the hook-fire path wraps subscriber
exceptions per the
``_fire_on_session_complete`` pattern from the session
plugin's ``routes.py`` - a gamification crash cannot
roll back the lesson the user already saw on the summary
screen.

### Frontend filter

``frontend/src/lib/learning-project.ts`` exposes
``isStandardProject`` + ``filterStandardProjects``. Three
consumers apply the filter:

- ``DashboardFilterBar.tsx`` (the dashboard project picker)
- ``ExportSection.tsx`` (export picker)
- ``Anki.tsx`` (Anki project dropdown)

The backend endpoint intentionally still exposes the
pseudo-project so a future "all activity" admin view can
opt in. The filter is a UI-policy decision, not data
hiding.

---

## Lesson-formula XP rule (v1.31.0 / Phase 46E.1)

``adaptive_learner_gamification.xp_service`` gains:

- ``compute_stars(correct, total)`` - 0-3 from a score, with
  bands at 50 % / 75 % / 90 %. Mirrors the frontend's
  ``computeStars`` in ``lib/lesson-summary.ts`` so both
  sides project the same star rating.
- ``calculate_lesson_session_xp(*, stars, first_attempt,
  streak_days)`` - pure calculator. 30 base + 10/star +
  20 first-attempt-3-star + same +25 %/day streak
  multiplier (capped at 7) as the chat formula.
- ``_is_first_attempt(db, lesson_progress_id)`` - reads
  ``LessonProgress.step_results`` JSON and returns True iff
  every step row has ``attempts == 1``.
- ``award_xp_for_lesson_session(db, *, session)`` -
  persistence wrapper that resolves user_id from the
  project FK and applies the formula.

Dispatch happens in ``GamificationPlugin.on_session_complete``
based on ``session["method"]``. Chat methods stay on
``award_xp_for_session``. Content method routes to the
lesson formula. The session payload from the unification
helper carries the lesson-specific keys
(``lesson_progress_id``, ``score_correct``,
``score_total``); chat-session payloads do not, so the
lesson XP wrapper would degrade gracefully if the dispatch
ever leaked - but the regression-pin test in
``backend/tests/test_lesson_session_unification.py``
asserts the exact lesson award (100 XP for a 4/4
first-attempt completion + first-day streak) so a leak
would surface immediately.

---

## Lesson badges (v1.31.0 / Phase 46E.2)

Four new predicates added to
``adaptive_learner_gamification.badge_service._EVALUATORS``:

| Key | Predicate | Helper |
|---|---|---|
| ``first_lesson`` | ``_completed_lesson_count >= 1`` | counts ``LessonProgress.status="completed"`` (not via LearningSession - the lesson row is authoritative) |
| ``lessons_10`` | ``_completed_lesson_count >= 10`` | same |
| ``three_star_streak`` | ``_last_n_lessons_all_three_star(n=3)`` | reads the user's last 3 completed ``LessonProgress`` by ``completed_at`` desc; projects each via ``xp_service.compute_stars`` |
| ``review_master`` | ``_mastered_elements_count >= 50`` | counts ``ElementError.mastered=True`` |

Catalog count: **24 → 28** (+1 getting_started + 1
consistency + 2 depth). The existing ``every yaml badge has
an evaluator`` symmetry test (in
``backend/tests/test_gamification_badges_integration.py``)
catches drift between the two lists.

---

## Storage-mode caveats

The element-tracking + SRS chain works identically in
**both** storage modes - the ``IElementErrorsNamespace``
contract is mode-agnostic and the dexie-mode release gate
(18 specs incl. the ``/review`` route) blocks any regression.

The lesson-session unification + gamification side effects
are **API-mode only**. In Dexie mode the lesson completion
still writes ``LessonProgress``, still records
``ElementError`` rows, and still drives the review queue -
but the ``LearningSession`` write + ``on_session_complete``
hook never fire (no backend, no hookable). Dexie-mode users
get the full review loop; the XP / badge awards from the
chat-session path still work, but lesson completions don't
yet contribute to that total.

A future unification of the gamification side effects into
``DexieStorage`` (so a Dexie-mode user's lesson completion
also awards XP locally) is a deliberate non-goal for
v1.31.0 - it would either duplicate the formula
implementation in TypeScript or require a service-worker
shim of the on_session_complete hook. Both are larger
refactors than the v1.31.0 scope allows.

---

## Where to look next

- ``backend/app/services/element_errors.py`` - the upsert
  transition matrix.
- ``backend/app/services/element_srs.py`` - the scheduler.
- ``backend/app/services/lesson_session_unification.py`` -
  the pseudo-project + hook fire.
- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py`` -
  ``calculate_lesson_session_xp`` + dispatch.
- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/badge_service.py`` -
  the four new predicates.
- ``frontend/src/lib/learning-project.ts`` - the
  pseudo-project filter helper.
- ``e2e/dexie/dexie-mode.spec.ts`` - the release gate that
  prevents Dexie-mode regressions (lessons spec at
  ``/lesson/...``, review spec at ``/review/...``).

---

## Token-diff + cloze + correction round (v1.35.0 / Phase 52)

Three layered additions that turn passive replay into active
learning:

**Token-diff + DiffHighlight** - Free-text and word-tiles
wrong answers now render `<DiffHighlight tokens={tokenDiff(
input, canonical)} />` inline below the result paragraph.
The lesson summary's per-exercise breakdown shows the same
diff for free-text + word-tiles when the v1.35.0+ stored
`user_answer` is available (older rows fall back to the
canonical-only line). Algorithm in
`frontend/src/lib/exercises/token-diff.ts` - pure word-
level LCS, NFC normalized, case + accent sensitive.

**Cloze exercise type (schema 1.1)** - fifth ExerciseType:
fill-in-the-blank with visible `___` markers. Two render
modes: `type` (default, `<input>`) and `select`
(`<select>` with options from `distractors`). Per-blank SRS
fan-out via `deriveClozeAttempts` - one ElementAttempt per
blank, so per-blank mastery tracking lights up cleanly.
Renderer at
`frontend/src/components/exercises/ClozeExercise.tsx`;
schema in
`plugins/adaptive-learner-plugin-content-loader/
adaptive_learner_content_loader/schema.py`.

**Cloze generator** - `generateClozeFromError(error,
sourceExercise, sourceCard)` synthesises a cloze step from
an ElementError. Algorithm:

1. If `sourceCard.token_roles` has an entry whose
   `token === error.correct_answer`, blank that token in
   `sourceCard.front`.
2. Otherwise, if `sourceCard.front` literally contains
   `error.correct_answer` exactly once, blank it.
3. Otherwise, if the source is free_text and its prompt
   contains the answer exactly once, blank it.
4. Otherwise return null - caller falls back to replay.

Deterministic: same inputs → byte-identical output. No AI,
no randomness, no async. Distractors carry
`error.user_answer` first (when different from correct),
then `sourceExercise.distractors` filtered + deduped. Code
at `frontend/src/lib/exercises/cloze-generator.ts`.

**Lesson-end correction round** -
`<CorrectionBlock />` mounts inside `LessonSummary` between
the score / breakdown and the action buttons. On mount, it
reads ElementError rows for the just-finished lesson,
generates a cloze for each non-mastered failure (cap 5),
and walks the user through them. Each completed cloze
writes fresh ElementAttempt rows against the same
element_key the original failure was recorded against, so
SRS streak + mastery advances. Self-hides on perfect score
/ no errors / no cloze constructable. Code at
`frontend/src/components/exercises/CorrectionBlock.tsx`.

**Cloze in review sessions (Phase 52G)** -
`synthesizeReviewLesson`'s per-item branch
(`_buildReviewStep`) now picks:

- free_text or word_tiles source → try cloze, fall back to
  replay
- matching, picture_choice, cloze → always replay

Decision criteria documented in
`frontend/src/lib/review-lesson.ts`. Replay step ids start
with `review-`; generated cloze step ids start with
`review-cloze-` for traceability.

**Token-roles on cards (Phase 52I)** - optional
`token_roles: list[{token, role}]` annotation on Card with
a closed enum of grammatical roles (article / verb / noun
/ adjective / preposition / gender_marker /
tense_marker). The generator uses these to pick a
semantically-meaningful blank instead of relying on
substring matching. Adding a role is a minor
schema_version bump - keep the enum closed.

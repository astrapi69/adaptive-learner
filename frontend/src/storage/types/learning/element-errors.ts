/**
 * Per-element SRS attempts/errors + namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */


/** #603 Smart Review Queue — one recorded attempt in the per-element
 *  history ring buffer (last 10 kept). */
export interface AttemptRecord {
  correct: boolean;
  hint_used?: boolean;
  at: string;
}

export interface ElementAttempt {
  set_id: string;
  lesson_id: string;
  exercise_id: string;
  element_key: string;
  /** EXP-018 / Phase 62 — concrete drill direction this attempt
   *  belongs to. A recorded attempt is always one of the two
   *  concrete directions (the exercise-level ``"both"`` /
   *  ``"random"`` are resolved before recording). Omitted =
   *  receptive (``"target_to_source"``), the pre-62 default. */
  direction?: "source_to_target" | "target_to_source";
  element_type?: string;
  user_answer?: string;
  correct_answer?: string;
  correct: boolean;
  /** #594 Hint Economy — true when the learner revealed a hint before
   *  answering this element. Shortens the SRS review interval (a
   *  hint-assisted answer is weaker) and feeds the "answers with hint"
   *  statistic. Omitted = no hint used (the default). */
  hint_used?: boolean;
  /** #1040 Exam-Mode SRS boost (Phase 2 of #1007) — true when this attempt
   *  was made in exam mode. A correct exam answer is stronger retention
   *  evidence, so the SRS layer lengthens the review interval (the inverse
   *  of {@link hint_used}). The recorder stores the boost only when the
   *  attempt is also correct. Omitted = not exam mode (the default). */
  exam?: boolean;
}

/**
 * Server-side element-error payload. Identical shape on both
 * ApiStorage and DexieStorage so the review-queue UI in
 * Phase 46C can render either source uniformly.
 */
export interface ElementError {
  id: string;
  user_id: string;
  /** EXP-051 / #2125 — the Durchgang (run/pass) this row belongs to.
   *  Present from the backend and DexieStorage; optional in the type so
   *  pre-EXP-051 fixtures still type-check (absent = run 1). */
  run_id?: number;
  set_id: string;
  lesson_id: string;
  exercise_id: string;
  element_key: string;
  /** EXP-018 / Phase 62 — drill direction this row tracks. Always
   *  present from the backend and DexieStorage (defaulted to
   *  ``"target_to_source"``); optional in the type so pre-62 test
   *  fixtures that predate the field still type-check. */
  direction?: string;
  element_type: string;
  user_answer: string;
  correct_answer: string;
  error_count: number;
  correct_streak: number;
  last_error_at: string | null;
  last_attempt_at: string;
  mastered: boolean;
  mastered_at: string | null;
  /** #594 Hint Economy — whether the MOST RECENT attempt on this element
   *  used a hint. Drives the shortened SRS interval. */
  hint_used?: boolean;
  /** #594 Hint Economy — lifetime count of attempts on this element that
   *  were answered with a hint revealed. Feeds the "answers with hint"
   *  statistic. Monotonic. */
  hint_used_count?: number;
  /** #1040 Exam-Mode SRS boost — whether the MOST RECENT attempt was a
   *  correct exam answer. Lengthens the SRS review interval. */
  last_attempt_exam?: boolean;
  /** #603 Smart Review Queue — total attempts (correct or wrong). */
  attempt_count?: number;
  /** #603 Smart Review Queue — the last 10 attempts (ring buffer). */
  attempt_history?: AttemptRecord[];
  /** #2188 — author-declared retirement: set = archived (out of scheduling
   *  + due counts, history kept). Null/absent = active. */
  retired_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One Durchgang (run/pass) of a content set (EXP-051 / #2125). Mirrors
 * the backend ``SetRunOut`` schema. ``closed_at`` is null for the active
 * run; earlier runs are an immutable archive for the Fehlerhistorie.
 */
export interface SetRun {
  id: string;
  user_id: string;
  set_id: string;
  run_id: number;
  content_version_at_start?: string | null;
  started_at: string;
  closed_at: string | null;
}

/**
 * One row of the SRS review queue (Phase 46C / P-129).
 * Mirrors the backend ``ReviewQueueItemOut`` schema 1:1.
 */
export interface ReviewQueueItem {
  id: string;
  user_id: string;
  set_id: string;
  lesson_id: string;
  exercise_id: string;
  element_key: string;
  /** EXP-018 / Phase 62 — drill direction of this queue item.
   *  The same element can appear twice (once per direction).
   *  Always present at runtime; optional for pre-62 fixtures. */
  direction?: string;
  element_type: string;
  user_answer: string;
  correct_answer: string;
  error_count: number;
  correct_streak: number;
  last_error_at: string | null;
  last_attempt_at: string;
  suggested_review_at: string;
  overdue: boolean;
  /** #603 Smart Review Queue — total attempts + the last-10 ring buffer,
   *  so the review UI can show the element's trajectory. */
  attempt_count?: number;
  attempt_history?: AttemptRecord[];
}

/**
 * Element-error namespace on IStorageService. ApiStorage
 * delegates to /api/users/{user_id}/element-errors;
 * DexieStorage runs the transition matrix + SRS scheduling
 * client-side via ``element-errors-dexie.ts``.
 */
/** One #2161 recovery re-key: rewrite an orphaned ``element_key`` from ``old``
 *  to ``new`` for a specific (set, lesson, exercise). */
export interface ElementKeyRemap {
  set_id: string;
  lesson_id: string;
  exercise_id: string;
  old: string;
  new: string;
}

/** One #2130 stable_id key-switch remap: rewrite ``exercise_id`` from ``old``
 *  (the authored slug the rows were recorded under) to ``new`` (the
 *  exercise's ``stable_id``) for a specific (set, lesson). */
export interface ExerciseIdRemap {
  set_id: string;
  lesson_id: string;
  old: string;
  new: string;
}

export interface IElementErrorsNamespace {
  list(
    userId: string,
    opts?: {
      setId?: string;
      includeMastered?: boolean;
      includeRetired?: boolean;
      /** EXP-051 / #2125 — the Durchgang to read. Omit for each set's
       *  ACTIVE run (current state); pass a run number for a specific past
       *  run (the Fehlerhistorie). */
      runId?: number;
    },
  ): Promise<ElementError[]>;
  recordBulk(userId: string, attempts: readonly ElementAttempt[]): Promise<ElementError[]>;
  /** EXP-051 / #2125 — start a new Durchgang of a set ("Set erneut
   *  durcharbeiten"). Atomically closes the active run and opens the next:
   *  the prior run's rows stay frozen for the Fehlerhistorie, new attempts
   *  write fresh rows under the new run (cold SRS scheduling). Works in
   *  both storage modes. Returns the newly opened run. */
  startRun(
    userId: string,
    setId: string,
    opts?: { contentVersion?: string },
  ): Promise<SetRun>;
  /** EXP-051 / #2125 — list every Durchgang of a set, oldest first. The
   *  active run has ``closed_at = null``. The Fehlerhistorie enumerates
   *  runs here, then reads each run's rows via ``list(..., { runId })``. */
  listRuns(userId: string, setId: string): Promise<SetRun[]>;
  /** #2161 one-off recovery: rewrite orphaned element_key old -> new for the
   *  given remaps. Idempotent and no double-map (a target row that already
   *  exists is skipped, never collapsed). One call is atomic (all-or-nothing);
   *  the caller passes ONE set's remaps per call. Returns the counts. Works in
   *  both storage modes. */
  remapKeys(
    userId: string,
    remaps: readonly ElementKeyRemap[],
  ): Promise<{ applied: number; skipped: number }>;
  /** #2130 stable_id key switch: rewrite ``exercise_id`` old -> new for every
   *  row of the exercise (all element_keys + both directions). Idempotent and
   *  no double-map (a target row that already exists is skipped). One call is
   *  atomic (all-or-nothing); the caller passes ONE set's remaps per call.
   *  Returns the counts. Works in both storage modes. */
  remapExerciseIds(
    userId: string,
    remaps: readonly ExerciseIdRemap[],
  ): Promise<{ applied: number; skipped: number }>;
  /** #2188 — archive the learner's rows for identities the author retired
   *  via the set manifest's ``retired_ids``. Idempotent; archived rows keep
   *  their history but leave the default list + review queue. Works in both
   *  storage modes. Returns the count of rows newly archived. */
  archiveRetired(
    userId: string,
    setId: string,
    retiredIds: readonly string[],
  ): Promise<{ archived: number }>;
  /** Projected review queue: active (non-mastered) elements with
   *  computed suggested_review_at + overdue flag, sorted by urgency
   *  (overdue → weakness tier → error frequency → oldest error first,
   *  #603). ``limit`` caps the list (a review session passes 20); omit
   *  for the full queue (the "N due" count). */
  reviewQueue(
    userId: string,
    opts?: { setId?: string; limit?: number },
  ): Promise<ReviewQueueItem[]>;
}

// EXP-010 / Phase 56 — daily missions. ``getDaily`` assigns the
// day's missions on first call (deterministic) and re-evaluates
// live progress on every call; ``regenerate`` reshuffles today's
// set (Settings reset). Both work in API + Dexie mode.

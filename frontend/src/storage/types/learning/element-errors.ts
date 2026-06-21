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
}

/**
 * Server-side element-error payload. Identical shape on both
 * ApiStorage and DexieStorage so the review-queue UI in
 * Phase 46C can render either source uniformly.
 */
export interface ElementError {
  id: string;
  user_id: string;
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
  /** #603 Smart Review Queue — total attempts (correct or wrong). */
  attempt_count?: number;
  /** #603 Smart Review Queue — the last 10 attempts (ring buffer). */
  attempt_history?: AttemptRecord[];
  created_at: string;
  updated_at: string;
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
export interface IElementErrorsNamespace {
  list(
    userId: string,
    opts?: { setId?: string; includeMastered?: boolean },
  ): Promise<ElementError[]>;
  recordBulk(userId: string, attempts: readonly ElementAttempt[]): Promise<ElementError[]>;
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

/**
 * Lesson progress rows + namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */


export type RawAnswer =
  | { kind: "matching"; matches: [number, number][] }
  | { kind: "picture_choice"; selected: number }
  | { kind: "free_text"; input: string }
  | { kind: "word_tiles"; placed: number[] }
  | { kind: "cloze"; inputs: string[] };

export interface LessonStepResult {
  step_id: string;
  correct: number;
  total: number;
  attempts?: number;
  /** Phase 52C / v1.35.0 — the user's text-form answer for the
   *  step, when applicable. Free-text + word-tiles populate
   *  it; matching + picture-choice leave it undefined. Powers
   *  the lesson-summary token-diff display. */
  user_answer?: string | null;
  /** BUG P1 / Problem 2 — the raw user answer, persisted so a
   *  revisited (locked) step re-renders the exact post-check
   *  visual instead of a fresh re-answerable exercise. */
  raw_answer?: RawAnswer | null;
  /** #594 Hint Economy — true when the learner revealed a hint on this
   *  step before answering. Counted in the lesson summary's "hints
   *  used" line. */
  hint_used?: boolean;
}

export interface LessonProgressUpsertBody {
  source: string;
  set_id: string;
  lesson_filename: string;
  step_result?: LessonStepResult;
  time_spent_seconds_delta?: number;
  /** BUG #41 — the step index the user is currently on, so a paused
   *  lesson resumes at the exact step. Omitting it leaves the stored
   *  value unchanged. */
  current_step?: number;
  mark_completed?: boolean;
  /** Phase 63A — flip the row to ``paused`` and stamp
   *  ``paused_at``. ``step_results`` stay intact for the resume. */
  mark_paused?: boolean;
  /** Phase 63A — flip the row to ``abandoned`` and stamp
   *  ``abandoned_at``. ``step_results`` are cleared; ElementErrors
   *  from completed steps stay in their own table. */
  mark_abandoned?: boolean;
  /** Phase 63C — flip a ``paused`` row back to ``in_progress`` and
   *  clear ``paused_at`` so the viewer can resume from the saved
   *  ``step_results``. */
  mark_resumed?: boolean;
  /** Phase 63C — discard ``step_results`` + score and reset
   *  ``status`` to ``in_progress`` from any prior state. Used by
   *  the resume-dialog "Start Over" path. */
  mark_restarted?: boolean;
}

/**
 * One stored step result inside ``LessonProgress.step_results``.
 * Mirrors what the backend service writes per step.
 */
export interface LessonStepResultStored {
  correct: number;
  total: number;
  attempts: number;
  completed_at: string;
  /** Phase 52C / v1.35.0 — see ``LessonStepResult.user_answer``.
   *  Old rows without this field surface as ``undefined`` and the
   *  summary falls back to the canonical-answer-only line. */
  user_answer?: string | null;
  /** BUG P1 / Problem 2 — see ``LessonStepResult.raw_answer``.
   *  Old rows (completed before this shipped) lack it; the
   *  viewer falls back to a compact "completed" panel for those
   *  on revisit instead of an exact reconstruction. */
  raw_answer?: RawAnswer | null;
  /** #594 Hint Economy — see ``LessonStepResult.hint_used``. */
  hint_used?: boolean;
}

/**
 * One completed-attempt entry in ``LessonProgress.attempt_history``
 * (#983). ``errors`` is derived in the UI as ``total - correct``.
 */
export interface LessonAttempt {
  /** ISO-8601 completion timestamp. */
  at: string;
  correct: number;
  total: number;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  source: string;
  set_id: string;
  lesson_filename: string;
  /** Phase 63A — lifecycle widened from in_progress|completed. */
  status: "in_progress" | "paused" | "abandoned" | "completed";
  /** Map of step_id → result. Parsed JSON; never a string. */
  step_results: Record<string, LessonStepResultStored>;
  score_correct: number;
  score_total: number;
  time_spent_seconds: number;
  /** BUG #41 — the step index the user is currently on; drives
   *  resume-at-paused-step. Always emitted by both storage backends
   *  (defaults to 0); optional on the wire type so pre-feature
   *  fixtures/rows that omit it still type-check. Read with `?? 0`. */
  current_step?: number;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  /** Phase 63A — set on pause, cleared on resume + completion. */
  paused_at: string | null;
  /** Phase 63A — set on abandon, cleared on completion. */
  abandoned_at: string | null;
  /** #983 — lesson retry tracking. Number of COMPLETED attempts.
   *  Optional on the wire so pre-feature fixtures/rows type-check;
   *  read with `?? 0`. */
  attempts?: number;
  /** #983 — the highest-percentage attempt's raw score, so progress
   *  surfaces can show the BEST result, not the last. Read with `?? 0`. */
  best_score_correct?: number;
  best_score_total?: number;
  /** #983 — completed-attempt history, oldest first. Powers the
   *  improvement comparison after a retry. Read with `?? []`. */
  attempt_history?: LessonAttempt[];
}

/**
 * Per-user × per-lesson progress tracking. Parallel to the
 * session-plugin's ``ITrackingNamespace`` (sessions stay
 * separate from content-loader lessons in v1.28.0; Phase 46
 * unifies them when SRS lands).
 */
export interface ILessonProgressNamespace {
  list(userId: string): Promise<LessonProgress[]>;
  get(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
  ): Promise<LessonProgress | null>;
  upsert(userId: string, body: LessonProgressUpsertBody): Promise<LessonProgress>;
}

/**
 * One element attempt — the unit the recording endpoint
 * consumes. Multiple attempts per exercise submit for
 * matching (one per pair); single attempt per submit for
 * picture-choice / free-text / word-tiles. The exercise-side
 * deriver (C9) builds these from ``(exercise, userInput)``.
 *
 * Phase 46B / EXP-007 / P-129.
 */

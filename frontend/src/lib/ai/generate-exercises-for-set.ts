/**
 * AIX-06 (EXP-036) — batch exercise generation for a whole set.
 *
 * AIX-02 generates exercises for ONE lesson. A set with 8-12 theory-only
 * lessons forces the user to click through each. This orchestrator runs
 * the per-lesson generation SEQUENTIALLY across every theory-only lesson
 * in a set (sequential, not parallel, for token budget + provider rate
 * limits), reporting progress, skipping a lesson that errors, and
 * honouring an ``AbortSignal`` (already-generated lessons are kept).
 *
 * Storage-mode-agnostic + testable: all I/O is injected via
 * {@link SetBatchDeps} (load the set's lessons, generate for one lesson
 * through the AIX-01..04 pipeline, persist the result). The concrete
 * deps live in ``set-batch-deps.ts``; tests pass mocks.
 *
 * Library-grade: pure orchestration, no app-state / network imports.
 */

import type { ContentLessonExercise } from "../../storage/types";
import type { TheoryStep } from "./exercise-generation-prompt";

/** One lesson of a set, reduced to what the batch needs. */
export interface BatchLesson {
  /** The lesson id. */
  id: string;
  /** The cached filename (``lessons/{filename}``), for the save step. */
  filename: string;
  /** Display title (for progress / logs). */
  title: string;
  /** The lesson's theory steps (prose context for the AI). */
  theorySteps: TheoryStep[];
  /** How many exercises the lesson already has (0 = a candidate). */
  exerciseCount: number;
}

/** Injected I/O for the batch run. */
export interface SetBatchDeps {
  /** Load every lesson of the set, reduced to {@link BatchLesson}. */
  loadLessons: () => Promise<BatchLesson[]>;
  /** Generate + map exercises for one lesson (AIX-01..04 pipeline). */
  generateForLesson: (
    lesson: BatchLesson,
    signal?: AbortSignal,
  ) => Promise<ContentLessonExercise[]>;
  /** Persist the generated exercises onto the lesson. */
  saveLessonExercises: (
    lesson: BatchLesson,
    exercises: ContentLessonExercise[],
  ) => Promise<void>;
}

/** Options for {@link generateExercisesForSet}. */
export interface BatchOptions {
  deps: SetBatchDeps;
  /** Fired as each candidate lesson starts: ``(current, total)``. */
  onProgress?: (current: number, total: number) => void;
  /** Abort the run between lessons (already-saved lessons are kept). */
  signal?: AbortSignal;
}

/** Outcome of a batch run. */
export interface SetBatchResult {
  setId: string;
  /** Candidate lessons (those with 0 exercises). */
  total: number;
  /** Lessons that gained exercises. */
  succeeded: number;
  /** Lessons skipped (error or no usable exercises). */
  skipped: number;
  /** Total exercises added across the set. */
  generated: number;
  /** True when the run was aborted before finishing. */
  cancelled: boolean;
}

/** ~input + ~output tokens per lesson (EXP-036 §AIX-06 cost estimate). */
const EST_INPUT_TOKENS = 2000;
const EST_OUTPUT_TOKENS = 1000;

/** Rough token estimate for generating exercises for ``lessonCount`` lessons. */
export function estimateBatchTokens(lessonCount: number): number {
  return Math.max(0, lessonCount) * (EST_INPUT_TOKENS + EST_OUTPUT_TOKENS);
}

/**
 * Generate exercises for every theory-only lesson in a set, sequentially.
 *
 * @param setId - The set being processed (traceability).
 * @param options - Injected deps + progress + abort.
 * @returns Counts of candidates / succeeded / skipped / generated, and
 *          whether the run was cancelled.
 */
export async function generateExercisesForSet(
  setId: string,
  options: BatchOptions,
): Promise<SetBatchResult> {
  const { deps, onProgress, signal } = options;
  const lessons = await deps.loadLessons();
  const candidates = lessons.filter((lesson) => lesson.exerciseCount === 0);
  const result: SetBatchResult = {
    setId,
    total: candidates.length,
    succeeded: 0,
    skipped: 0,
    generated: 0,
    cancelled: false,
  };

  for (let index = 0; index < candidates.length; index++) {
    if (signal?.aborted) {
      result.cancelled = true;
      break;
    }
    const lesson = candidates[index];
    onProgress?.(index + 1, candidates.length);
    try {
      const exercises = await deps.generateForLesson(lesson, signal);
      if (exercises.length === 0) {
        result.skipped += 1;
        continue;
      }
      await deps.saveLessonExercises(lesson, exercises);
      result.succeeded += 1;
      result.generated += exercises.length;
    } catch {
      // A single lesson's failure must not abort the whole batch.
      result.skipped += 1;
    }
  }

  return result;
}

/**
 * Lesson summary utilities (Phase 46A / EXP-002 / 4A).
 *
 * Pure helpers consumed by the expanded ``LessonSummary``
 * component (commit C2). Split out so the same logic can be
 * unit-tested in isolation AND reused by the upcoming
 * review-mode summary (commit C16) without coupling to the
 * Lesson page.
 *
 * Star bands per the Phase 46 spec:
 *
 *    0–49%   → 0 stars
 *    50–74%  → 1 star
 *    75–89%  → 2 stars
 *    90–100% → 3 stars
 *
 * Per-exercise breakdown reads ``LessonProgress.step_results``
 * keyed by step id; theory steps are skipped (they don't
 * score). Unattempted exercise steps surface as ``attempted:
 * false`` so the UI can render a neutral "not attempted" row
 * rather than misleading 0/0 numbers.
 */

import type {
    ContentLesson,
    ContentLessonExercise,
    LessonProgress,
} from "../storage/types";

export type StarRating = 0 | 1 | 2 | 3;

export interface ExerciseBreakdownEntry {
    stepId: string;
    title: string;
    exerciseType: ContentLessonExercise["type"];
    /** True when the user has a recorded step_result for this step. */
    attempted: boolean;
    /** Per-step score from progress.step_results, or 0/0 when
     *  unattempted. */
    correct: number;
    total: number;
    /** True iff ``attempted`` AND ``correct === total`` AND
     *  ``total > 0`` (perfect score on this step). The
     *  ``correct === total`` check alone would incorrectly
     *  flag an unattempted 0/0 row as "perfect". */
    fullyCorrect: boolean;
    /** Canonical answer derived from exercise content. Always
     *  present so the UI can decide when to reveal it
     *  (typically on wrong/partial answers). Empty string when
     *  the cached exercise is missing its type-specific
     *  content (defensive). */
    canonicalAnswer: string;
    /** Phase 52C / v1.35.0 — the user's text-form answer for
     *  the step, read from ``step_results[stepId].user_answer``.
     *  Null when the exercise type does not carry a text answer
     *  (matching / picture-choice) OR when the lesson predates
     *  v1.35.0 (no user_answer was stored). The summary renders
     *  ``<DiffHighlight />`` when present, falls back to the
     *  canonical-only line otherwise. */
    userAnswer: string | null;
}

/** Map a raw correct/total pair to the 0–3 star rating per
 *  the Phase 46 bands. Returns 0 when ``total <= 0`` (no
 *  scored exercises — e.g. a theory-only lesson). */
export function computeStars(correct: number, total: number): StarRating {
    if (total <= 0) return 0;
    const pct = (correct / total) * 100;
    if (pct >= 90) return 3;
    if (pct >= 75) return 2;
    if (pct >= 50) return 1;
    return 0;
}

/** Derive the canonical answer text for an exercise. The
 *  shape is type-specific:
 *
 *    matching       → "left ↔ right, left ↔ right, ..."
 *    picture_choice → the correct image's label
 *    free_text      → ``exercise.accept[0]`` (canonical first)
 *    word_tiles     → ``exercise.tiles.join(" ")``
 *
 *  Returns "" when the type-specific content is missing
 *  (defensive — the schema validator already rejects this
 *  upstream, but cached payloads should never crash the UI). */
export function deriveCanonicalAnswer(
    exercise: ContentLessonExercise,
): string {
    switch (exercise.type) {
        case "matching": {
            const pairs = exercise.pairs ?? [];
            return pairs
                .map((p) => `${p.left} ↔ ${p.right}`)
                .join(", ");
        }
        case "picture_choice": {
            const correct = (exercise.images ?? []).find(
                (img) => img.is_correct === "true",
            );
            return correct?.label ?? "";
        }
        case "free_text": {
            const accept = exercise.accept ?? [];
            return accept[0] ?? "";
        }
        case "word_tiles": {
            const tiles = exercise.tiles ?? [];
            return tiles.join(" ");
        }
    }
}

/** Walk a lesson's exercise steps and produce a per-step
 *  breakdown using the user's recorded ``step_results``.
 *  Theory steps are skipped. Order matches the lesson's step
 *  sequence so the UI renders them in encounter order. */
export function buildExerciseBreakdown(
    lesson: ContentLesson,
    progress: LessonProgress | null,
): ExerciseBreakdownEntry[] {
    const stepResults = progress?.step_results ?? {};
    const entries: ExerciseBreakdownEntry[] = [];
    for (const step of lesson.steps) {
        if (step.type !== "exercise" || !step.exercise) continue;
        const stepResult = stepResults[step.id];
        const attempted = stepResult !== undefined;
        const correct = stepResult?.correct ?? 0;
        const total = stepResult?.total ?? 0;
        entries.push({
            stepId: step.id,
            title: step.title ?? step.exercise.prompt,
            exerciseType: step.exercise.type,
            attempted,
            correct,
            total,
            fullyCorrect: attempted && total > 0 && correct === total,
            canonicalAnswer: deriveCanonicalAnswer(step.exercise),
            userAnswer: stepResult?.user_answer ?? null,
        });
    }
    return entries;
}

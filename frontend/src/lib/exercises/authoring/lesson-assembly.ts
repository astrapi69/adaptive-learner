/**
 * Assembly of exercises into a ``ContentLesson`` — the generic authoring
 * layer of the exercise kit. Two concerns live here:
 *
 *  - {@link appendExercisesToLesson} (AIX-02): wrap generated exercises as
 *    steps and append them to an existing lesson, re-validating the result.
 *  - {@link buildExtensionLesson} (#1852): assemble a fresh lesson from
 *    wizard-authored extension exercises, setting ``requires_extensions``.
 *
 * Both are pure + return new objects (inputs never mutated). Schema
 * validation is delegated to ``validateGeneratedLesson`` (the shared
 * lesson-schema check); the ``SaveUserSetInput`` storage contract is
 * deliberately NOT here — it lives app-side in
 * ``lib/content/lesson/user-set-input.ts``.
 *
 * @example
 * const lesson = buildExtensionLesson({meta, exercises});
 * const withAi = appendExercisesToLesson(baseLesson, aiExercises);
 */

import {
    slugify,
    validateGeneratedLesson,
} from "../../content/analysis/analysis-to-lesson";
import type {LessonMeta} from "../../content/lesson/lesson-draft";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
} from "../../../storage/types";

/** Major version every wizard-authored extension is pinned to today. The
 *  exercise ``type`` stays bare (``ext:al-categorization``); only
 *  ``requires_extensions`` carries the ``@1`` suffix. */
const EXTENSION_VERSION = 1;

export interface ExtensionLessonInput {
    meta: LessonMeta;
    exercises: ContentLessonExercise[];
}

/** Wrap an exercise as a slug-safe ``exercise`` step. */
function exerciseStep(exercise: ContentLessonExercise): ContentLessonStep {
    return {
        id: `step-${exercise.id}`,
        type: "exercise",
        title: null,
        body: null,
        exercise,
    };
}

/**
 * Return a copy of ``lesson`` with ``exercises`` appended as exercise steps.
 * When ``exercises`` is empty the original lesson is returned unchanged.
 * Throws (via {@link validateGeneratedLesson}) if the merged lesson would be
 * schema-invalid.
 *
 * @param lesson - The base lesson (theory steps, possibly some exercises).
 * @param exercises - Generated exercises to append.
 * @returns A new, validated lesson.
 */
export function appendExercisesToLesson(
    lesson: ContentLesson,
    exercises: ContentLessonExercise[],
): ContentLesson {
    if (exercises.length === 0) return lesson;
    const merged: ContentLesson = {
        ...lesson,
        steps: [...lesson.steps, ...exercises.map(exerciseStep)],
    };
    validateGeneratedLesson(merged);
    return merged;
}

/** Distinct ``requires_extensions`` entries (versioned) for the exercises
 *  used, in first-seen order. */
export function requiredExtensionsFor(
    exercises: ContentLessonExercise[],
): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ex of exercises) {
        const entry = `${ex.type}@${EXTENSION_VERSION}`;
        if (!seen.has(entry)) {
            seen.add(entry);
            out.push(entry);
        }
    }
    return out;
}

function estimateMinutes(exercises: number): number {
    return Math.max(1, Math.round(1 + exercises * 1.5));
}

/**
 * Assemble a valid ``ContentLesson`` carrying ``requires_extensions``.
 * Throws (via ``validateGeneratedLesson``) on a schema violation OR an
 * unsupported declared extension, so the caller surfaces it before saving.
 *
 * @example
 * const lesson = buildExtensionLesson({meta, exercises});
 */
export function buildExtensionLesson(
    input: ExtensionLessonInput,
): ContentLesson {
    const {meta, exercises} = input;
    const introBody = meta.description.trim() || meta.title.trim();
    const steps: ContentLessonStep[] = [
        {id: "theory-intro", type: "theory", title: null, body: introBody},
    ];
    exercises.forEach((exercise, i) => {
        steps.push({
            id: `step-ex-${i + 1}-${exercise.id}`,
            type: "exercise",
            title: null,
            body: null,
            exercise,
        });
    });

    const lesson: ContentLesson = {
        id: slugify(meta.title) || "lesson",
        title: meta.title.trim(),
        description: meta.description.trim() || null,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        estimated_minutes: estimateMinutes(exercises.length),
        cards: [],
        steps,
        requires_extensions: requiredExtensionsFor(exercises),
        contributed_by: meta.author.trim() || null,
        contributed_at: meta.author.trim() ? new Date().toISOString() : null,
    };

    validateGeneratedLesson(lesson);
    return lesson;
}

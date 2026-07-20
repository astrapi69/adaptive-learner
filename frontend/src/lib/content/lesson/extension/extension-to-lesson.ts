/**
 * Build a ``ContentLesson`` from the extension-authoring wizard (#1852).
 *
 * Mirrors {@link buildBookLesson} (one intro theory step + one exercise
 * step per authored exercise), with the one thing no other builder does:
 * it SETS ``requires_extensions`` — the versioned ``ext:al-...@1`` form —
 * for every distinct extension type used, so a strict consumer's load guard
 * (E-EXT-UNSUPPORTED) accepts the lesson instead of refusing it.
 */

import {slugify, validateGeneratedLesson} from "../../analysis/analysis-to-lesson";
import type {LessonMeta} from "../lesson-draft";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    SaveUserSetInput,
} from "../../../../storage/types";

/** Major version every wizard-authored extension is pinned to today. The
 *  exercise ``type`` stays bare (``ext:al-categorization``); only
 *  ``requires_extensions`` carries the ``@1`` suffix. */
const EXTENSION_VERSION = 1;

export interface ExtensionLessonInput {
    meta: LessonMeta;
    exercises: ContentLessonExercise[];
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

/** Stable slug-safe set id (re-saving with the same title overwrites). */
export function extensionSetId(meta: LessonMeta): string {
    return `created-${slugify(meta.title) || "lesson"}`;
}

/** Wrap a built extension lesson in the ``SaveUserSetInput`` that persists
 *  it to "My Lessons". */
export function buildExtensionUserSetInput(
    input: ExtensionLessonInput,
    lesson: ContentLesson,
): SaveUserSetInput {
    const {meta} = input;
    return {
        set_id: extensionSetId(meta),
        title: meta.title.trim(),
        title_native: meta.titleNative.trim() || meta.title.trim(),
        language: meta.targetLanguage,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        level: meta.level,
        origin: "imported",
        description: meta.description.trim() || null,
        lessons: [lesson],
    };
}

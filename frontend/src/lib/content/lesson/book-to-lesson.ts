/**
 * #1743 — build a knowledge lesson from AI-rephrased book theory + AI
 * exercises.
 *
 * The book-text wizard path produces two AI outputs — reformulated theory
 * steps ({@link generateTheoryFromText}) and exercises generated from them
 * ({@link generateExercises} + {@link cardsToExercises}) — and this module
 * assembles them into a schema-v1.x ``ContentLesson`` (the SAME format
 * every other lesson uses; the viewer renders it unmodified).
 *
 * Two things distinguish it from the manual ``draft-to-lesson`` path:
 *   1. The theory steps are the AI's reformulated prose (multiple steps),
 *      not a single title/description intro.
 *   2. It is the FIRST app code to WRITE ``theory_ref`` (#709): each
 *      exercise step is linked to the theory step it practises, computed
 *      with the SHIPPED runtime resolver ({@link findRelatedTheoryIndex})
 *      so the write side and the read side can never diverge.
 *
 * Deterministic given its inputs; the AI calls happen upstream.
 */

import {slugify, validateGeneratedLesson} from "../analysis/analysis-to-lesson";
import {findRelatedTheoryIndex} from "../../lesson/theory-link";
import type {LessonMeta} from "./lesson-draft";
import type {TheoryStep} from "../../ai/generation/exercise-generation-prompt";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ContentSetBook,
    SaveUserSetInput,
} from "../../../storage/types";

/** The book-metadata a user can attach in the wizard, written to
 *  ``sets[].book`` (#769). */
export type BookMeta = ContentSetBook;

export interface BookLessonInput {
    meta: LessonMeta;
    /** AI-reformulated theory steps (from {@link generateTheoryFromText}). */
    theorySteps: TheoryStep[];
    /** AI-generated exercises (from {@link cardsToExercises}). */
    exercises: ContentLessonExercise[];
}

function estimateMinutes(theory: number, exercises: number): number {
    // ~1 min reading per theory step + ~1.5 min per exercise.
    return Math.max(1, Math.round(theory + exercises * 1.5));
}

/**
 * Assemble a valid ``ContentLesson`` from reformulated theory steps +
 * exercises, writing ``theory_ref`` on each exercise step. Throws (via
 * ``validateGeneratedLesson``) on a schema violation so the caller can
 * surface it before saving.
 */
export function buildBookLesson(input: BookLessonInput): ContentLesson {
    const {meta, theorySteps, exercises} = input;

    // The AI theory steps are slug-safe re-ided so the lesson schema
    // (``[a-z0-9-]`` ids) accepts them regardless of what the parser
    // produced.
    const steps: ContentLessonStep[] = theorySteps.map((theory, i) => ({
        id: `theory-${i + 1}`,
        type: "theory",
        title: theory.title ?? null,
        body: theory.body ?? "",
    }));
    exercises.forEach((exercise, i) => {
        steps.push({
            id: `step-ex-${i + 1}-${exercise.id}`,
            type: "exercise",
            title: null,
            body: null,
            exercise,
        });
    });

    // #709 — write ``theory_ref`` using the SHIPPED read-side resolver so
    // the link the viewer computes at runtime is baked in at author time.
    // The book flow has no manual cards, so overlap is driven by the
    // exercise prompt against each theory step's text.
    const cards: ContentLesson["cards"] = [];
    steps.forEach((step, index) => {
        if (step.type !== "exercise") return;
        const theoryIndex = findRelatedTheoryIndex(steps, cards, index);
        if (theoryIndex !== null) {
            step.theory_ref = steps[theoryIndex].id;
        }
    });

    const lesson: ContentLesson = {
        id: slugify(meta.title) || "lesson",
        title: meta.title.trim(),
        description: meta.description.trim() || null,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        estimated_minutes: estimateMinutes(theorySteps.length, exercises.length),
        cards,
        steps,
        contributed_by: meta.author.trim() || null,
        contributed_at: meta.author.trim() ? new Date().toISOString() : null,
    };

    validateGeneratedLesson(lesson);
    return lesson;
}

/** Normalise the wizard's raw book fields into a {@link BookMeta}, or
 *  ``null`` when no title is given (no book block — legitimate for a
 *  non-book knowledge lesson). Optional blank fields collapse to null. */
export function normalizeBook(
    book: Partial<BookMeta> | null | undefined,
): BookMeta | null {
    const title = book?.title?.trim();
    if (!title) return null;
    const trimOrNull = (v: string | null | undefined): string | null => {
        const trimmed = v?.trim();
        return trimmed ? trimmed : null;
    };
    return {
        title,
        author: trimOrNull(book?.author),
        url: trimOrNull(book?.url),
        asin: trimOrNull(book?.asin),
    };
}

/** Stable slug-safe set id for a book lesson. Re-saving with the same
 *  title overwrites (matches ``saveUserSet`` semantics). */
export function bookSetId(meta: LessonMeta): string {
    return `created-${slugify(meta.title) || "lesson"}`;
}

/**
 * Wrap a built book lesson in the ``SaveUserSetInput`` that persists it to
 * "My Lessons", carrying the optional ``book`` block (#769) into
 * ``sets[].book``.
 */
export function buildBookUserSetInput(
    input: BookLessonInput,
    lesson: ContentLesson,
    book: BookMeta | null,
): SaveUserSetInput {
    const {meta} = input;
    return {
        set_id: bookSetId(meta),
        title: meta.title.trim(),
        title_native: meta.titleNative.trim() || meta.title.trim(),
        language: meta.targetLanguage,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        level: meta.level,
        origin: "imported",
        description: meta.description.trim() || null,
        book,
        lessons: [lesson],
    };
}

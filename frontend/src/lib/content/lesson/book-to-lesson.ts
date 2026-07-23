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
import type {GeneratedBookLesson} from "../../ai/generation/generate-book-lessons";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ContentSetBook,
    SaveUserSetInput,
} from "../../../storage/types";

export type {GeneratedBookLesson};

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
 * Assemble a single valid ``ContentLesson`` from reformulated theory steps
 * + exercises with an EXPLICIT lesson title (the set metadata supplies the
 * languages / level / author / description). ``usedIds`` guarantees a
 * unique slug id across a batch of lessons sharing one set. Throws (via
 * ``validateGeneratedLesson``) on a schema violation.
 */
function assembleBookLesson(
    meta: LessonMeta,
    title: string,
    theorySteps: TheoryStep[],
    exercises: ContentLessonExercise[],
    usedIds: Set<string>,
): ContentLesson {
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

    // An empty entry title falls back to the set title (the single paste
    // path passes "" so the lesson title/id track ``meta.title`` even if it
    // was edited after generation — preserving the #1743 id).
    const resolvedTitle = title.trim() || meta.title.trim();
    const lesson: ContentLesson = {
        id: uniqueLessonId(resolvedTitle, usedIds),
        title: resolvedTitle,
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

/** Slug-safe lesson id derived from a title, disambiguated against ids
 *  already used in the same set (``-2``, ``-3``, …). */
function uniqueLessonId(title: string, usedIds: Set<string>): string {
    const base = slugify(title) || "lesson";
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
        id = `${base}-${n}`;
        n += 1;
    }
    usedIds.add(id);
    return id;
}

/**
 * Assemble a valid ``ContentLesson`` from reformulated theory steps +
 * exercises, using ``meta.title`` as the lesson title. Throws on a schema
 * violation so the caller can surface it before saving.
 */
export function buildBookLesson(input: BookLessonInput): ContentLesson {
    const {meta, theorySteps, exercises} = input;
    return assembleBookLesson(
        meta,
        meta.title,
        theorySteps,
        exercises,
        new Set(),
    );
}

/**
 * #1949 — assemble N standalone lessons (one per generated section) that
 * share one set. Each lesson carries its own title (the section title);
 * ids are made unique within the set. Order is preserved.
 */
export function buildBookLessons(
    meta: LessonMeta,
    generated: GeneratedBookLesson[],
): ContentLesson[] {
    const usedIds = new Set<string>();
    return generated.map((entry) =>
        assembleBookLesson(
            meta,
            entry.title,
            entry.theorySteps,
            entry.exercises,
            usedIds,
        ),
    );
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
 * #1949 — wrap one or more built book lessons in the ``SaveUserSetInput``
 * that persists them to "My Lessons" as a single set, carrying the optional
 * ``book`` block (#769) into ``sets[].book``. The set title comes from the
 * wizard metadata; the individual lesson titles are already baked into each
 * ``ContentLesson``.
 */
export function buildBookLessonsUserSetInput(
    meta: LessonMeta,
    lessons: ContentLesson[],
    book: BookMeta | null,
): SaveUserSetInput {
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
        lessons,
    };
}

/**
 * Wrap a single built book lesson in the ``SaveUserSetInput`` that persists
 * it to "My Lessons". Thin wrapper over {@link buildBookLessonsUserSetInput}
 * (the single path is the one-lesson case of the batch path).
 */
export function buildBookUserSetInput(
    input: BookLessonInput,
    lesson: ContentLesson,
    book: BookMeta | null,
): SaveUserSetInput {
    return buildBookLessonsUserSetInput(input.meta, [lesson], book);
}

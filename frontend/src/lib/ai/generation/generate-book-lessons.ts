/**
 * #1949 — batch lesson generation for the book-file wizard path.
 *
 * The #1743 single path turns ONE pasted chunk into ONE lesson (theory +
 * exercises). This module reuses that exact chunk->lesson pipeline in a
 * loop so the user can select several detected sections and generate one
 * standalone lesson PER section in a single run — the binding design
 * decision (short, focused micro-learning units mapped 1:1 to the book's
 * author-set chapter boundaries), not one giant lesson.
 *
 * {@link generateBookLessonContent} is the single-chunk step shared by the
 * single and batch paths (no second generation logic). The batch loop
 * ({@link generateBookLessonsBatch}) is fault-tolerant: a per-section
 * failure is recorded and the remaining sections continue, so one bad
 * chapter never loses the whole run.
 *
 * Library-grade: the AI engines are injected; no app-state imports.
 */

import {generateExercises as defaultGenerate} from "./generate-exercises";
import {generateTheoryFromText as defaultGenerateTheory} from "./generate-theory-from-text";
import {cardsToExercises} from "./cards-to-exercises";
import {setTypeCoverage, type SetTypeCoverage} from "./set-type-coverage";
import type {AiProvider} from "./generate-exercises";
import type {TheoryStep} from "./exercise-generation-prompt";
import type {ContentLessonExercise} from "../../../storage/types";

/** One generated lesson's raw content, ready to assemble into a
 *  ``ContentLesson`` (see ``buildBookLessons``). */
export interface GeneratedBookLesson {
    /** The lesson title (the section title in batch mode). */
    title: string;
    theorySteps: TheoryStep[];
    exercises: ContentLessonExercise[];
}

/** One section fed to the batch: a title + its plain text. */
export interface BatchSectionInput {
    title: string;
    text: string;
}

/** Progress tick emitted before each section is generated. */
export interface BatchProgress {
    /** 1-based index of the section currently being generated. */
    current: number;
    /** Total sections in the batch. */
    total: number;
    /** Title of the section currently being generated. */
    title: string;
}

/** A section that failed to generate, with a user-readable reason. */
export interface BatchFailure {
    title: string;
    error: string;
}

/** Outcome of a batch run: the successfully generated lessons (in input
 *  order) plus the per-section failures. */
export interface BatchResult {
    lessons: GeneratedBookLesson[];
    failures: BatchFailure[];
    /** #2356 — distinct exercise types across the WHOLE set (not per lesson),
     *  and whether the set clears the variety target. Answers "does this
     *  23-lesson set carry more than four types?". */
    typeCoverage: SetTypeCoverage;
}

/** Why a single-chunk generation could not produce a lesson. */
export type BookGenerationReason = "theory" | "exercises" | "too_long";

/** Thrown by {@link generateBookLessonContent} when the AI returns no
 *  usable theory or no usable exercises (a transport/auth error from the
 *  provider propagates unchanged). */
export class BookGenerationError extends Error {
    reason: BookGenerationReason;
    constructor(reason: BookGenerationReason, message: string) {
        super(message);
        this.name = "BookGenerationError";
        this.reason = reason;
    }
}

/** Injectable AI engines (default to the real ones; overridden in tests). */
export interface BookGenerationEngines {
    generateTheory?: typeof defaultGenerateTheory;
    generate?: typeof defaultGenerate;
}

/** Options shared by the single-chunk and batch generators. */
export interface BookGenerationOptions {
    /** Target language for the theory + exercises. */
    language?: string;
    /** Localized cloze prompt for {@link cardsToExercises}. */
    clozePrompt: string;
    /** Optional per-section hard char cap (oversized -> failure, no AI call). */
    maxSectionChars?: number;
    /** #2356 — whether image assets are available. The book-text path is
     *  Markdown-only, so it defaults to ``false`` and ``picture_choice`` is not
     *  offered (the model cannot supply image sources). */
    hasAssets?: boolean;
}

/**
 * Generate ONE lesson's content (theory steps + exercises) from a text
 * chunk. This is the shared single-chunk step; the single wizard path and
 * the batch loop both call it, so there is exactly one generation pipeline.
 *
 * @throws BookGenerationError - when the AI returns no theory or no
 *         exercises. Any provider transport/auth error propagates as-is.
 */
export async function generateBookLessonContent(
    text: string,
    provider: AiProvider,
    options: BookGenerationOptions,
    engines: BookGenerationEngines = {},
): Promise<{theorySteps: TheoryStep[]; exercises: ContentLessonExercise[]}> {
    const generateTheory = engines.generateTheory ?? defaultGenerateTheory;
    const generate = engines.generate ?? defaultGenerate;

    const theory = await generateTheory(text, provider, {
        language: options.language,
    });
    if (theory.steps.length === 0) {
        throw new BookGenerationError(
            "theory",
            "The AI returned no usable theory.",
        );
    }
    const generated = await generate(theory.steps, provider, {
        language: options.language,
        // Book text is Markdown-only: no images, so picture_choice is not offered.
        hasAssets: options.hasAssets ?? false,
    });
    const {exercises} = cardsToExercises(generated.cards, {
        clozePrompt: options.clozePrompt,
    });
    if (exercises.length === 0) {
        throw new BookGenerationError(
            "exercises",
            "No usable exercises were generated.",
        );
    }
    return {theorySteps: theory.steps, exercises};
}

/** Hooks for a batch run: progress reporting + engine seams. */
export interface BatchHooks extends BookGenerationEngines {
    onProgress?: (progress: BatchProgress) => void;
    /** Convenience: pass the engine seams under one key. */
    engines?: BookGenerationEngines;
    /** Optional per-section hard char cap. */
    maxSectionChars?: number;
}

/**
 * Generate one lesson per section, in INPUT order (the caller passes
 * sections in document order). Fault-tolerant: a section that throws is
 * recorded in ``failures`` and the loop continues.
 */
export async function generateBookLessonsBatch(
    sections: BatchSectionInput[],
    provider: AiProvider,
    options: BookGenerationOptions,
    hooks: BatchHooks = {},
): Promise<BatchResult> {
    const engines: BookGenerationEngines = hooks.engines ?? {
        generateTheory: hooks.generateTheory,
        generate: hooks.generate,
    };
    const cap = hooks.maxSectionChars ?? options.maxSectionChars;
    const lessons: GeneratedBookLesson[] = [];
    const failures: BatchFailure[] = [];

    for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        hooks.onProgress?.({
            current: i + 1,
            total: sections.length,
            title: section.title,
        });
        if (cap !== undefined && section.text.length > cap) {
            failures.push({
                title: section.title,
                error: `Section too long (max ${cap} characters).`,
            });
            continue;
        }
        try {
            const {theorySteps, exercises} = await generateBookLessonContent(
                section.text,
                provider,
                options,
                engines,
            );
            lessons.push({title: section.title, theorySteps, exercises});
        } catch (err) {
            failures.push({
                title: section.title,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    // #2356 — measure type variety across the WHOLE set, not per lesson.
    const typeCoverage = setTypeCoverage(lessons.map((lesson) => lesson.exercises));
    return {lessons, failures, typeCoverage};
}

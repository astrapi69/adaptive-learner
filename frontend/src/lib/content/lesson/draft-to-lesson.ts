/**
 * Draft → lesson conversion for the Lesson Creator (Phase 65D).
 *
 * Turns the wizard's {meta, cards, exercises} into a schema-v1.2
 * ``ContentLesson`` (the SAME format every other lesson uses — no
 * special "created" shape) plus the ``SaveUserSetInput`` that
 * persists it to "My Lessons" via ``saveUserSet``. Deterministic;
 * validated against the same invariants as the analysis generator.
 */

import {slugify, validateGeneratedLesson} from "../analysis/analysis-to-lesson";
import type {LessonCardDraft, LessonMeta} from "./lesson-draft";
import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonStep,
    ContentLessonExercise,
    SaveUserSetInput,
} from "../../../storage/types";

export interface DraftLessonInput {
    meta: LessonMeta;
    cards: LessonCardDraft[];
    exercises: ContentLessonExercise[];
}

function estimateMinutes(theory: number, exercises: number): number {
    // ~1 min reading per theory step + ~1.5 min per exercise.
    return Math.max(1, Math.round(theory + exercises * 1.5));
}

/** Build a valid ContentLesson from the draft. Throws (via
 *  ``validateGeneratedLesson``) on a schema violation so the caller
 *  can surface it before saving. */
export function buildLessonFromDraft(input: DraftLessonInput): ContentLesson {
    const {meta, cards, exercises} = input;
    const lessonCards: ContentLessonCard[] = cards.map((c) => ({
        id: c.id,
        front: c.front.trim(),
        back: c.back.trim(),
        notes: c.notes.trim() || null,
        image: c.image.trim() || null,
        tags: [],
    }));

    const steps: ContentLessonStep[] = [];
    // A theory body is required; the intro guarantees a non-empty one.
    const introBody =
        `# ${meta.title.trim()}` +
        (meta.description.trim() ? `\n\n${meta.description.trim()}` : "");
    steps.push({
        id: "theory-intro",
        type: "theory",
        title: meta.title.trim(),
        body: introBody,
    });
    exercises.forEach((ex, i) => {
        steps.push({
            id: `step-ex-${i}-${ex.id}`,
            type: "exercise",
            title: null,
            body: null,
            exercise: ex,
        });
    });

    const lesson: ContentLesson = {
        id: slugify(meta.title) || "lesson",
        title: meta.title.trim(),
        description: meta.description.trim() || null,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        estimated_minutes: estimateMinutes(1, exercises.length),
        cards: lessonCards,
        steps,
        contributed_by: meta.author.trim() || null,
        contributed_at: meta.author.trim() ? new Date().toISOString() : null,
    };

    validateGeneratedLesson(lesson);
    return lesson;
}

/** Stable slug-safe set id for a user-created lesson. Re-saving with
 *  the same title overwrites (matches ``saveUserSet`` semantics). */
export function draftSetId(meta: LessonMeta): string {
    return `created-${slugify(meta.title) || "lesson"}`;
}

/** Wrap a built lesson in the ``SaveUserSetInput`` that persists it to
 *  "My Lessons" via ``saveUserSet`` (origin ``"imported"``, since a
 *  hand-authored lesson has no analysis/adaptive origin in the enum). */
export function buildUserSetInput(
    input: DraftLessonInput,
    lesson: ContentLesson,
): SaveUserSetInput {
    const {meta} = input;
    return {
        set_id: draftSetId(meta),
        title: meta.title.trim(),
        title_native: meta.titleNative.trim() || meta.title.trim(),
        language: meta.targetLanguage,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        level: meta.level,
        // No "manual" origin in the enum; a hand-authored lesson is
        // closest to "imported" (authored outside an analysis/adaptive
        // flow). The viewer + sharing treat all user sets identically.
        origin: "imported",
        description: meta.description.trim() || null,
        lessons: [lesson],
    };
}

export interface DraftValidationChecks {
    hasTitle: boolean;
    enoughCards: boolean;
    enoughExercises: boolean;
    enoughTypes: boolean;
    schemaValid: boolean;
    /** The structural validator's reason when ``schemaValid`` is false
     *  (#1722 — e.g. ``/cards/0/back must NOT have fewer than 1
     *  characters``); ``null`` when the structure is valid. Detail for
     *  the checklist + console, NOT part of the boolean aggregate. */
    schemaError: string | null;
}

/** The boolean check keys {@link allChecksPass} aggregates (everything
 *  except the ``schemaError`` detail field). */
const BOOLEAN_CHECK_KEYS = [
    "hasTitle",
    "languagePair",
    "enoughCards",
    "enoughExercises",
    "enoughTypes",
    "schemaValid",
] as const;

export const MIN_CARDS_FOR_SAVE = 4;
export const MIN_EXERCISES_FOR_SAVE = 5;
export const MIN_TYPES_FOR_SAVE = 2;

/** The engine schema's ``Card.front``/``Card.back`` ``maxLength`` (#1722).
 *  The card inputs cap at this so a hand-typed side can never fail the
 *  ajv structure check on length. */
export const CARD_SIDE_MAX_LENGTH = 500;

/** Run the save-readiness checks for the Step-4 checklist. */
export function checkDraft(input: DraftLessonInput): DraftValidationChecks {
    const {meta, cards, exercises} = input;
    const types = new Set(exercises.map((e) => e.type));
    let schemaValid: boolean;
    let schemaError: string | null = null;
    try {
        buildLessonFromDraft(input);
        schemaValid = true;
    } catch (err) {
        schemaValid = false;
        schemaError = err instanceof Error ? err.message : String(err);
        // #1722 — a bare ✗ is not actionable; keep the precise validator
        // reason available in the dev console alongside the checklist.
        console.error("create-lesson: draft structure invalid:", schemaError);
    }
    return {
        hasTitle: meta.title.trim().length > 0,
        // #1715 — a same-language pair is legitimate for knowledge-domain
        // lessons (e.g. the ki-einsteiger set: de -> de), so it is no
        // longer a save gate. Same/differing languages are surfaced as a
        // non-blocking hint in Step 1, mirroring SaveOfflineLessonModal.
        enoughCards: cards.length >= MIN_CARDS_FOR_SAVE,
        enoughExercises: exercises.length >= MIN_EXERCISES_FOR_SAVE,
        enoughTypes: types.size >= MIN_TYPES_FOR_SAVE,
        schemaValid,
        schemaError,
    };
}

/** True iff every save-readiness check passed (the draft is saveable). */
export function allChecksPass(checks: DraftValidationChecks): boolean {
    return BOOLEAN_CHECK_KEYS.every((key) => checks[key]);
}

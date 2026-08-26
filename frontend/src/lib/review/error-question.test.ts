/**
 * questionForError tests (#2757).
 *
 * Pins that the "Why you missed these" question resolver derives the
 * ASKED text per exercise type from the lesson content — never the raw
 * ``element_key`` (which may be an opaque stable_id since engine#91) —
 * and returns null when the source exercise cannot be resolved.
 */

import {describe, expect, it} from "vitest";

import {questionForError} from "./error-question";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ElementError,
} from "../../storage/types";

function makeError(over: Partial<ElementError>): ElementError {
    return {
        id: "e1",
        user_id: "u1",
        set_id: "es-a1",
        lesson_id: "01.json",
        exercise_id: "ex-1",
        element_key: "gracias",
        element_type: "vocabulary",
        user_answer: "grasias",
        correct_answer: "gracias",
        error_count: 1,
        correct_streak: 0,
        last_error_at: null,
        last_attempt_at: "2026-08-10T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-08-10T00:00:00Z",
        updated_at: "2026-08-10T00:00:00Z",
        ...over,
    };
}

function makeLesson(
    exercise: ContentLessonExercise,
    stepTitle: string | null = null,
): ContentLesson {
    const step: ContentLessonStep = {
        id: `step-${exercise.id}`,
        type: "exercise",
        title: stepTitle,
        exercise,
    };
    return {
        id: "01.json",
        title: "Lesson 1",
        description: null,
        estimated_minutes: 10,
        cards: [],
        steps: [step],
    };
}

describe("questionForError", () => {
    it("free_text: returns the exercise prompt", () => {
        const lesson = makeLesson({
            id: "ex-1",
            type: "free_text",
            prompt: "Translate: thank you",
            accept: ["gracias"],
            card_ids: [],
            distractors: [],
        });
        const err = makeError({exercise_id: "ex-1", element_key: "gracias"});
        expect(questionForError(lesson, err)).toBe("Translate: thank you");
    });

    it("free_text: falls back to the step title when the prompt is empty", () => {
        const lesson = makeLesson(
            {
                id: "ex-1",
                type: "free_text",
                prompt: "",
                accept: ["gracias"],
                card_ids: [],
                distractors: [],
            },
            "Say thanks",
        );
        const err = makeError({exercise_id: "ex-1", element_key: "gracias"});
        expect(questionForError(lesson, err)).toBe("Say thanks");
    });

    it("matching: returns the asked pair's left term for a canonical-text element_key", () => {
        const lesson = makeLesson({
            id: "ex-1",
            type: "matching",
            prompt: "Match the pairs",
            pairs: [
                {left: "merci", right: "danke"},
                {left: "bonjour", right: "hallo"},
            ],
            card_ids: [],
            distractors: [],
        });
        const err = makeError({
            exercise_id: "ex-1",
            element_key: "bonjour",
            correct_answer: "hallo",
        });
        expect(questionForError(lesson, err)).toBe("bonjour");
    });

    it("matching: resolves an opaque stable_id element_key to the pair's left term, never showing the id", () => {
        const lesson = makeLesson({
            id: "ex-1",
            type: "matching",
            prompt: "Match the pairs",
            pairs: [
                {left: "merci", right: "danke", stable_id: "pair-x1"},
                {left: "bonjour", right: "hallo", stable_id: "pair-x2"},
            ],
            card_ids: [],
            distractors: [],
        });
        const err = makeError({
            exercise_id: "ex-1",
            element_key: "pair-x2",
            correct_answer: "hallo",
        });
        expect(questionForError(lesson, err)).toBe("bonjour");
    });

    it("cloze: returns the sentence with the blank", () => {
        const lesson = makeLesson({
            id: "ex-1",
            type: "cloze",
            prompt: "Fill in the blank",
            sentence: "Je vois ___ chat.",
            cloze_mode: "type",
            blanks: [{accept: ["le"]}],
            card_ids: [],
            distractors: [],
        });
        const err = makeError({exercise_id: "ex-1", element_key: "le"});
        expect(questionForError(lesson, err)).toBe("Je vois ___ chat.");
    });

    it("multiple_choice: returns the exercise prompt", () => {
        const lesson = makeLesson({
            id: "ex-1",
            type: "multiple_choice",
            prompt: "Which article fits 'gato'?",
            options: [
                {text: "el", correct: true},
                {text: "la", correct: false},
            ],
            card_ids: [],
            distractors: [],
        });
        const err = makeError({exercise_id: "ex-1", element_key: "el"});
        expect(questionForError(lesson, err)).toBe("Which article fits 'gato'?");
    });

    it("resolves the exercise under its stable_id row key (#2130)", () => {
        const lesson = makeLesson({
            id: "ex-1",
            stable_id: "stbl-9",
            type: "free_text",
            prompt: "Translate: thank you",
            accept: ["gracias"],
            card_ids: [],
            distractors: [],
        });
        const err = makeError({exercise_id: "stbl-9", element_key: "gracias"});
        expect(questionForError(lesson, err)).toBe("Translate: thank you");
    });

    it("reading comprehension (ext): returns the matching sub-question's prompt", () => {
        const lesson = makeLesson({
            id: "ex-1",
            type: "ext:al-reading-comprehension",
            prompt: "Read the passage",
            card_ids: [],
            distractors: [],
            ext_payload: {
                passage: "Anna geht zur Schule.",
                questions: [
                    {
                        prompt: "Wohin geht Anna?",
                        type: "free_text",
                        accept: ["zur Schule"],
                    },
                ],
            },
        } as unknown as ContentLessonExercise);
        const err = makeError({
            exercise_id: "ex-1",
            element_key: "zur Schule",
        });
        expect(questionForError(lesson, err)).toBe("Wohin geht Anna?");
    });

    it("returns null when the error's exercise is not in the lesson (evicted content)", () => {
        const lesson = makeLesson({
            id: "ex-other",
            type: "free_text",
            prompt: "Translate: hello",
            accept: ["hola"],
            card_ids: [],
            distractors: [],
        });
        const err = makeError({exercise_id: "ex-gone", element_key: "hola"});
        expect(questionForError(lesson, err)).toBeNull();
    });

    it("returns null when nothing askable exists (no prompt, no title)", () => {
        const lesson = makeLesson({
            id: "ex-1",
            type: "free_text",
            prompt: "",
            accept: ["gracias"],
            card_ids: [],
            distractors: [],
        });
        const err = makeError({exercise_id: "ex-1", element_key: "gracias"});
        expect(questionForError(lesson, err)).toBeNull();
    });
});

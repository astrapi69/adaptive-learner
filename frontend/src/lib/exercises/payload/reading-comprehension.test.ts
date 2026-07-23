import {describe, expect, it} from "vitest";

import {
    READING_COMPREHENSION_EXT_TYPE,
    asReadingComprehensionPayload,
    canonicalAnswer,
    readingComprehensionPayloadErrors,
} from "./reading-comprehension";
import type {ContentLessonExercise} from "../../../storage/types";

/**
 * Engine-half core for the adopted extension ``ext:al-reading-comprehension``
 * (#1579, third adoption). Payload mirrors the engine example
 * ``ext:ref-reading-comprehension``: a shared ``passage`` bound to
 * ``questions`` that reuse the core multiple_choice / free_text shapes.
 */

const exerciseWith = (payload: unknown): ContentLessonExercise =>
    ({
        id: "ex-rc-01",
        type: READING_COMPREHENSION_EXT_TYPE,
        prompt: "Lies den Text und beantworte die Fragen.",
        card_ids: [],
        distractors: [],
        ext_payload: payload,
    }) as unknown as ContentLessonExercise;

const PASSAGE = "Rex lief in den Garten und bellte den Briefträger an.";
const wellFormed = {
    passage: PASSAGE,
    questions: [
        {
            prompt: "Wohin lief Rex?",
            type: "multiple_choice",
            options: [
                {text: "In den Garten", correct: true},
                {text: "Auf die Straße"},
            ],
        },
        {prompt: "Wie hieß der Hund?", type: "free_text", accept: ["Rex"]},
    ],
};

describe("asReadingComprehensionPayload", () => {
    it("reads a well-formed payload", () => {
        const payload = asReadingComprehensionPayload(exerciseWith(wellFormed));
        expect(payload).not.toBeNull();
        expect(payload?.questions).toHaveLength(2);
    });

    it("returns null for malformed shapes", () => {
        expect(asReadingComprehensionPayload(exerciseWith(undefined))).toBeNull();
        expect(
            asReadingComprehensionPayload(exerciseWith({passage: 5, questions: []})),
        ).toBeNull();
        expect(
            asReadingComprehensionPayload(
                exerciseWith({passage: PASSAGE, questions: "x"}),
            ),
        ).toBeNull();
        expect(
            asReadingComprehensionPayload(
                exerciseWith({passage: PASSAGE, questions: [{type: "free_text"}]}),
            ),
        ).toBeNull();
    });
});

describe("readingComprehensionPayloadErrors (engine half)", () => {
    it("accepts the well-formed payload (happy path)", () => {
        expect(readingComprehensionPayloadErrors(exerciseWith(wellFormed))).toEqual(
            [],
        );
    });

    it("rejects a malformed shape with a single error", () => {
        const shapeErrors = readingComprehensionPayloadErrors(
            exerciseWith({passage: PASSAGE}),
        );
        expect(shapeErrors).toHaveLength(1);
        expect(shapeErrors[0]).toContain("questions");
    });

    it("requires a non-empty passage and at least one question", () => {
        expect(
            readingComprehensionPayloadErrors(
                exerciseWith({passage: "  ", questions: wellFormed.questions}),
            ).join(" "),
        ).toContain("non-empty passage");

        expect(
            readingComprehensionPayloadErrors(
                exerciseWith({passage: PASSAGE, questions: []}),
            ).join(" "),
        ).toContain("at least 1 question");
    });

    it("requires a non-empty prompt and a known question type", () => {
        expect(
            readingComprehensionPayloadErrors(
                exerciseWith({
                    passage: PASSAGE,
                    questions: [{prompt: " ", type: "free_text", accept: ["x"]}],
                }),
            ).join(" "),
        ).toContain("non-empty prompt");

        expect(
            readingComprehensionPayloadErrors(
                exerciseWith({
                    passage: PASSAGE,
                    questions: [{prompt: "Was?", type: "essay", accept: ["x"]}],
                }),
            ).join(" "),
        ).toContain("multiple_choice or free_text");
    });

    it("enforces multiple_choice and free_text sub-question rules", () => {
        expect(
            readingComprehensionPayloadErrors(
                exerciseWith({
                    passage: PASSAGE,
                    questions: [
                        {prompt: "Wo?", type: "multiple_choice", options: [{text: "A", correct: true}]},
                    ],
                }),
            ).join(" "),
        ).toContain("2 options");

        expect(
            readingComprehensionPayloadErrors(
                exerciseWith({
                    passage: PASSAGE,
                    questions: [
                        {prompt: "Wo?", type: "multiple_choice", options: [{text: "A"}, {text: "B"}]},
                    ],
                }),
            ).join(" "),
        ).toContain("2 options");

        expect(
            readingComprehensionPayloadErrors(
                exerciseWith({
                    passage: PASSAGE,
                    questions: [{prompt: "Wer?", type: "free_text", accept: []}],
                }),
            ).join(" "),
        ).toContain("accept");
    });

    it("boundary: a passage with a single multiple_choice question is valid", () => {
        expect(
            readingComprehensionPayloadErrors(
                exerciseWith({
                    passage: PASSAGE,
                    questions: [
                        {prompt: "Wo?", type: "multiple_choice", options: [{text: "Garten", correct: true}, {text: "Strasse"}]},
                    ],
                }),
            ),
        ).toEqual([]);
    });
});

describe("canonicalAnswer", () => {
    it("returns the first correct option for multiple_choice and accept[0] for free_text", () => {
        const payload = asReadingComprehensionPayload(exerciseWith(wellFormed))!;
        expect(canonicalAnswer(payload.questions[0]!)).toBe("In den Garten");
        expect(canonicalAnswer(payload.questions[1]!)).toBe("Rex");
    });

    it("returns an empty string when there is no canonical answer", () => {
        expect(canonicalAnswer({prompt: "x", type: "free_text", accept: []})).toBe("");
        expect(canonicalAnswer({prompt: "x", type: "multiple_choice", options: []})).toBe("");
    });
});

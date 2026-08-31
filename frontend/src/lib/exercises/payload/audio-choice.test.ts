/**
 * Payload-validation tests for ``ext:al-audio-choice`` — the app-side
 * mirror of the engine ``E-EXT-REFAUDIOCHOICE-*`` rules (learn-content-engine
 * ``ext:ref-audio-choice``).
 */

import {describe, expect, it} from "vitest";

import {
    asAudioChoicePayload,
    audioChoicePayloadErrors,
    AUDIO_CHOICE_EXT_TYPE,
    correctAudioChoiceOption,
} from "./audio-choice";
import type {ContentLessonExercise} from "../../../storage/types";

function _exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-audio-choice",
        type: AUDIO_CHOICE_EXT_TYPE,
        prompt: "Pick the word that fills the gap.",
        card_ids: [],
        distractors: [],
        ext_payload: payload as ContentLessonExercise["ext_payload"],
        ...overrides,
    };
}

const validPayload = {
    sentence: "Je ___ ici.",
    options: [
        {audio: "assets/audio/suis.mp3", is_correct: "true"},
        {audio: "assets/audio/es.mp3"},
    ],
};

describe("audioChoicePayloadErrors", () => {
    it("accepts a well-formed payload", () => {
        expect(audioChoicePayloadErrors(_exercise(validPayload))).toEqual([]);
    });

    it("rejects a missing ext_payload (SHAPE)", () => {
        const errors = audioChoicePayloadErrors(_exercise(undefined));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ext_payload");
    });

    it("rejects fewer than 2 options (SHAPE)", () => {
        const errors = audioChoicePayloadErrors(
            _exercise({sentence: "Je ___ ici.", options: [{audio: "a.mp3", is_correct: "true"}]}),
        );
        expect(errors[0]).toContain("ext_payload");
    });

    it("rejects a sentence without the gap marker (SENTENCE)", () => {
        const errors = audioChoicePayloadErrors(
            _exercise({...validPayload, sentence: "Je suis ici."}),
        );
        expect(errors.some((e) => e.includes("sentence"))).toBe(true);
    });

    it("rejects an empty option audio (AUDIO)", () => {
        const errors = audioChoicePayloadErrors(
            _exercise({
                sentence: "Je ___ ici.",
                options: [{audio: "  ", is_correct: "true"}, {audio: "es.mp3"}],
            }),
        );
        expect(errors.some((e) => e.includes("audio"))).toBe(true);
    });

    it("rejects zero correct options (CORRECT)", () => {
        const errors = audioChoicePayloadErrors(
            _exercise({sentence: "Je ___ ici.", options: [{audio: "a.mp3"}, {audio: "b.mp3"}]}),
        );
        expect(errors.some((e) => e.includes("is_correct"))).toBe(true);
    });

    it("rejects more than one correct option (CORRECT)", () => {
        const errors = audioChoicePayloadErrors(
            _exercise({
                sentence: "Je ___ ici.",
                options: [
                    {audio: "a.mp3", is_correct: "true"},
                    {audio: "b.mp3", is_correct: "true"},
                ],
            }),
        );
        expect(errors.some((e) => e.includes("is_correct"))).toBe(true);
    });
});

describe("asAudioChoicePayload", () => {
    it("returns the payload when shaped right", () => {
        expect(asAudioChoicePayload(_exercise(validPayload))).toEqual(validPayload);
    });

    it("returns null when malformed", () => {
        expect(asAudioChoicePayload(_exercise({sentence: "x"}))).toBeNull();
        expect(asAudioChoicePayload(_exercise(undefined))).toBeNull();
    });
});

describe("correctAudioChoiceOption", () => {
    it("returns the audio of the single correct option", () => {
        expect(correctAudioChoiceOption(_exercise(validPayload))).toBe("assets/audio/suis.mp3");
    });

    it("is empty when the payload is malformed or has no correct option", () => {
        expect(correctAudioChoiceOption(_exercise(undefined))).toBe("");
        expect(
            correctAudioChoiceOption(
                _exercise({sentence: "Je ___ ici.", options: [{audio: "a.mp3"}, {audio: "b.mp3"}]}),
            ),
        ).toBe("");
    });
});

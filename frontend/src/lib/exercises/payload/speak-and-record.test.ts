/**
 * Payload-validation tests for ``ext:al-speak-and-record`` (engine#68 idea
 * 3) - the app-side mirror of the engine ``E-EXT-REFSPEAKRECORD-*`` rules.
 * No grading tests: this extension is deliberately ungraded, there is no
 * ``grade*``/``canonical*`` helper to test.
 */

import {describe, expect, it} from "vitest";

import {
    asSpeakAndRecordPayload,
    speakAndRecordPayloadErrors,
    SPEAK_AND_RECORD_EXT_TYPE,
} from "./speak-and-record";
import type {ContentLessonExercise} from "../../../storage/types";

function _exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-speak",
        type: SPEAK_AND_RECORD_EXT_TYPE,
        prompt: "Listen, reveal the text, then record yourself saying it.",
        card_ids: [],
        distractors: [],
        ext_payload: payload as ContentLessonExercise["ext_payload"],
        ...overrides,
    };
}

describe("speakAndRecordPayloadErrors (engine#68 idea 3)", () => {
    it("accepts a well-formed payload with authored audio", () => {
        const ex = _exercise({sentence: "Je suis ici.", audio: "assets/audio/s1.mp3"});
        expect(speakAndRecordPayloadErrors(ex)).toEqual([]);
    });

    it("accepts a well-formed payload without audio (TTS fallback)", () => {
        const ex = _exercise({sentence: "Je suis ici."});
        expect(speakAndRecordPayloadErrors(ex)).toEqual([]);
    });

    it("rejects a missing ext_payload (SHAPE)", () => {
        const ex = _exercise(undefined);
        expect(speakAndRecordPayloadErrors(ex)).toHaveLength(1);
        expect(speakAndRecordPayloadErrors(ex)[0]).toContain("ext_payload");
    });

    it("rejects a non-string sentence (SHAPE)", () => {
        const ex = _exercise({sentence: 42});
        expect(speakAndRecordPayloadErrors(ex)[0]).toContain("ext_payload");
    });

    it("rejects a non-string audio (SHAPE)", () => {
        const ex = _exercise({sentence: "Je suis ici.", audio: 42});
        expect(speakAndRecordPayloadErrors(ex)[0]).toContain("ext_payload");
    });

    it("rejects a blank sentence (SENTENCE)", () => {
        const ex = _exercise({sentence: "   "});
        const errors = speakAndRecordPayloadErrors(ex);
        expect(errors.some((e) => e.includes("sentence"))).toBe(true);
    });
});

describe("asSpeakAndRecordPayload", () => {
    it("returns the payload when shaped right, audio included", () => {
        const ex = _exercise({sentence: "Salut.", audio: "a.mp3"});
        expect(asSpeakAndRecordPayload(ex)).toEqual({sentence: "Salut.", audio: "a.mp3"});
    });

    it("returns the payload with audio undefined when absent", () => {
        const ex = _exercise({sentence: "Salut."});
        expect(asSpeakAndRecordPayload(ex)).toEqual({sentence: "Salut.", audio: undefined});
    });

    it("returns null when malformed", () => {
        expect(asSpeakAndRecordPayload(_exercise({audio: "a.mp3"}))).toBeNull();
        expect(asSpeakAndRecordPayload(_exercise(undefined))).toBeNull();
    });
});

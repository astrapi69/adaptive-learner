/**
 * Payload-validation tests for ``ext:al-dictation`` (#1881) — the app-side
 * mirror of the engine ``E-EXT-REFDICT-*`` rules.
 */

import {describe, expect, it} from "vitest";

import {
    asDictationPayload,
    canonicalDictationAnswer,
    dictationPayloadErrors,
    DICTATION_EXT_TYPE,
} from "./dictation";
import type {ContentLessonExercise} from "../../../storage/types";

function _exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-dictation",
        type: DICTATION_EXT_TYPE,
        prompt: "Listen and write what you hear.",
        card_ids: [],
        distractors: [],
        ext_payload: payload as ContentLessonExercise["ext_payload"],
        ...overrides,
    };
}

describe("dictationPayloadErrors (#1881)", () => {
    it("accepts a well-formed payload", () => {
        const ex = _exercise({audio: "assets/audio/s1.mp3", accept: ["Bonjour"]});
        expect(dictationPayloadErrors(ex)).toEqual([]);
    });

    it("rejects a missing ext_payload (SHAPE)", () => {
        const ex = _exercise(undefined);
        expect(dictationPayloadErrors(ex)).toHaveLength(1);
        expect(dictationPayloadErrors(ex)[0]).toContain("ext_payload");
    });

    it("rejects a non-string audio (SHAPE)", () => {
        const ex = _exercise({audio: 42, accept: ["x"]});
        expect(dictationPayloadErrors(ex)[0]).toContain("ext_payload");
    });

    it("rejects a non-array / non-string accept (SHAPE)", () => {
        expect(dictationPayloadErrors(_exercise({audio: "a.mp3", accept: "x"}))[0]).toContain(
            "ext_payload",
        );
        expect(dictationPayloadErrors(_exercise({audio: "a.mp3", accept: [1, 2]}))[0]).toContain(
            "ext_payload",
        );
    });

    it("rejects an empty audio string (AUDIO)", () => {
        const ex = _exercise({audio: "   ", accept: ["Bonjour"]});
        const errors = dictationPayloadErrors(ex);
        expect(errors.some((e) => e.includes("audio"))).toBe(true);
    });

    it("rejects an accept list with no non-empty entry (ACCEPT)", () => {
        const ex = _exercise({audio: "assets/audio/s1.mp3", accept: ["", "  "]});
        const errors = dictationPayloadErrors(ex);
        expect(errors.some((e) => e.includes("accept"))).toBe(true);
    });

    it("reports BOTH audio + accept when both are empty", () => {
        const ex = _exercise({audio: "", accept: []});
        expect(dictationPayloadErrors(ex)).toHaveLength(2);
    });
});

describe("asDictationPayload", () => {
    it("returns the payload when shaped right", () => {
        const ex = _exercise({audio: "a.mp3", accept: ["x", "y"]});
        expect(asDictationPayload(ex)).toEqual({audio: "a.mp3", accept: ["x", "y"]});
    });

    it("returns null when malformed", () => {
        expect(asDictationPayload(_exercise({accept: ["x"]}))).toBeNull();
        expect(asDictationPayload(_exercise(undefined))).toBeNull();
    });
});

describe("canonicalDictationAnswer", () => {
    it("is the first non-empty accept entry", () => {
        expect(
            canonicalDictationAnswer(_exercise({audio: "a.mp3", accept: ["  ", "Bonjour", "Salut"]})),
        ).toBe("Bonjour");
    });

    it("is empty when the payload is malformed", () => {
        expect(canonicalDictationAnswer(_exercise(undefined))).toBe("");
    });
});

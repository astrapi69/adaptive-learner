/**
 * Payload-validation tests for ``ext:al-audio-tiles`` — the app-side mirror
 * of the engine ``E-EXT-REFAUDIOTILES-*`` rules (learn-content-engine
 * ``ext:ref-audio-tiles``).
 */

import {describe, expect, it} from "vitest";

import {
    asAudioTilesPayload,
    audioTilesPayloadErrors,
    AUDIO_TILES_EXT_TYPE,
} from "./audio-tiles";
import type {ContentLessonExercise} from "../../../storage/types";

function _exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-audio-tiles",
        type: AUDIO_TILES_EXT_TYPE,
        prompt: "Listen, then build the translation.",
        card_ids: [],
        distractors: [],
        ext_payload: payload as ContentLessonExercise["ext_payload"],
        ...overrides,
    };
}

const validPayload = {
    audio: "assets/audio/je-suis-ici.mp3",
    tiles: ["Je", "suis", "ici"],
};

describe("audioTilesPayloadErrors", () => {
    it("accepts a well-formed payload", () => {
        expect(audioTilesPayloadErrors(_exercise(validPayload))).toEqual([]);
    });

    it("accepts a well-formed payload with accept_orderings", () => {
        expect(
            audioTilesPayloadErrors(
                _exercise({...validPayload, accept_orderings: [[0, 1, 2]]}),
            ),
        ).toEqual([]);
    });

    it("rejects a missing ext_payload (SHAPE)", () => {
        const errors = audioTilesPayloadErrors(_exercise(undefined));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ext_payload");
    });

    it("rejects a non-string audio (SHAPE)", () => {
        expect(audioTilesPayloadErrors(_exercise({audio: 1, tiles: ["a", "b"]}))[0]).toContain(
            "ext_payload",
        );
    });

    it("rejects an empty audio string (AUDIO)", () => {
        const errors = audioTilesPayloadErrors(_exercise({...validPayload, audio: "   "}));
        expect(errors.some((e) => e.includes("audio"))).toBe(true);
    });

    it("rejects fewer than 2 tiles (TILES)", () => {
        const errors = audioTilesPayloadErrors(_exercise({...validPayload, tiles: ["Je"]}));
        expect(errors.some((e) => e.includes("tiles"))).toBe(true);
    });

    it("rejects an accept_orderings entry that is not a permutation (ORDERINGS)", () => {
        const errors = audioTilesPayloadErrors(
            _exercise({...validPayload, accept_orderings: [[0, 0, 2]]}),
        );
        expect(errors.some((e) => e.includes("accept_orderings"))).toBe(true);
    });

    it("rejects an accept_orderings entry of the wrong length (ORDERINGS)", () => {
        const errors = audioTilesPayloadErrors(
            _exercise({...validPayload, accept_orderings: [[0, 1]]}),
        );
        expect(errors.some((e) => e.includes("accept_orderings"))).toBe(true);
    });
});

describe("asAudioTilesPayload", () => {
    it("returns the payload when shaped right", () => {
        expect(asAudioTilesPayload(_exercise(validPayload))).toEqual({
            audio: validPayload.audio,
            tiles: validPayload.tiles,
            accept_orderings: undefined,
        });
    });

    it("returns null when malformed", () => {
        expect(asAudioTilesPayload(_exercise({audio: "a.mp3"}))).toBeNull();
        expect(asAudioTilesPayload(_exercise(undefined))).toBeNull();
    });
});

/**
 * Payload-validation tests for ``ext:al-image-description`` (#2095) — the
 * app-side mirror of the engine ``ext:ref-image-description`` ``{src, accept}``
 * rules (learn-content-engine v0.15.0, PR #89). Sixth adoption; modelled on
 * the dictation payload (#1881).
 */

import {describe, expect, it} from "vitest";

import {
    asImageDescriptionPayload,
    canonicalImageDescriptionAnswer,
    imageDescriptionPayloadErrors,
    IMAGE_DESCRIPTION_EXT_TYPE,
} from "./image-description";
import type {ContentLessonExercise} from "../../../storage/types";

function _exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-image-description",
        type: IMAGE_DESCRIPTION_EXT_TYPE,
        prompt: "Describe what you see.",
        card_ids: [],
        distractors: [],
        ext_payload: payload as ContentLessonExercise["ext_payload"],
        ...overrides,
    };
}

describe("imageDescriptionPayloadErrors (#2095)", () => {
    it("accepts a well-formed payload (asset path)", () => {
        const ex = _exercise({image: "assets/img/cat.png", accept: ["a cat"]});
        expect(imageDescriptionPayloadErrors(ex)).toEqual([]);
    });

    it("accepts a well-formed payload (embedded data URI)", () => {
        const ex = _exercise({
            image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            accept: ["a cat", "cat"],
        });
        expect(imageDescriptionPayloadErrors(ex)).toEqual([]);
    });

    it("rejects a missing ext_payload (SHAPE)", () => {
        const ex = _exercise(undefined);
        expect(imageDescriptionPayloadErrors(ex)).toHaveLength(1);
        expect(imageDescriptionPayloadErrors(ex)[0]).toContain("ext_payload");
    });

    it("rejects a non-string image (SHAPE)", () => {
        const ex = _exercise({image: 42, accept: ["x"]});
        expect(imageDescriptionPayloadErrors(ex)[0]).toContain("ext_payload");
    });

    it("rejects a non-array / non-string accept (SHAPE)", () => {
        expect(
            imageDescriptionPayloadErrors(_exercise({image: "a.png", accept: "x"}))[0],
        ).toContain("ext_payload");
        expect(
            imageDescriptionPayloadErrors(_exercise({image: "a.png", accept: [1, 2]}))[0],
        ).toContain("ext_payload");
    });

    it("rejects an empty image string (IMAGE)", () => {
        const ex = _exercise({image: "   ", accept: ["a cat"]});
        const errors = imageDescriptionPayloadErrors(ex);
        expect(errors.some((e) => e.includes("image"))).toBe(true);
    });

    it("rejects an accept list with no non-empty entry (ACCEPT)", () => {
        const ex = _exercise({image: "assets/img/cat.png", accept: ["", "  "]});
        const errors = imageDescriptionPayloadErrors(ex);
        expect(errors.some((e) => e.includes("accept"))).toBe(true);
    });

    it("reports BOTH image + accept when both are empty", () => {
        const ex = _exercise({image: "", accept: []});
        expect(imageDescriptionPayloadErrors(ex)).toHaveLength(2);
    });

    it("rejects a remote http(s) URL image (offline-first)", () => {
        const ex = _exercise({
            image: "https://example.com/cat.png",
            accept: ["a cat"],
        });
        const errors = imageDescriptionPayloadErrors(ex);
        expect(errors.some((e) => e.includes("image"))).toBe(true);
    });
});

describe("asImageDescriptionPayload", () => {
    it("returns the payload when shaped right", () => {
        const ex = _exercise({image: "a.png", accept: ["x", "y"]});
        expect(asImageDescriptionPayload(ex)).toEqual({
            image: "a.png",
            accept: ["x", "y"],
        });
    });

    it("returns null when malformed", () => {
        expect(asImageDescriptionPayload(_exercise({accept: ["x"]}))).toBeNull();
        expect(asImageDescriptionPayload(_exercise(undefined))).toBeNull();
    });
});

describe("canonicalImageDescriptionAnswer", () => {
    it("is the first non-empty accept entry", () => {
        expect(
            canonicalImageDescriptionAnswer(
                _exercise({image: "a.png", accept: ["  ", "a cat", "cat"]}),
            ),
        ).toBe("a cat");
    });

    it("is empty when the payload is malformed", () => {
        expect(canonicalImageDescriptionAnswer(_exercise(undefined))).toBe("");
    });
});

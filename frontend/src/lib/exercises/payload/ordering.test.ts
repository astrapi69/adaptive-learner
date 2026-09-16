/**
 * Payload-validation tests for ``ext:al-ordering`` (#3110) — the app-side
 * mirror of the engine's ``ext:ref-ordering`` reference rules.
 */

import {describe, expect, it} from "vitest";

import {
    asOrderingPayload,
    canonicalOrderingSequence,
    orderingPayloadErrors,
    ORDERING_EXT_TYPE,
} from "./ordering";
import type {ContentLessonExercise} from "../../../storage/types";

function _exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-ordering",
        type: ORDERING_EXT_TYPE,
        prompt: "Put the steps in order.",
        card_ids: [],
        distractors: [],
        ext_payload: payload as ContentLessonExercise["ext_payload"],
        ...overrides,
    };
}

describe("orderingPayloadErrors (#3110)", () => {
    it("accepts a well-formed payload", () => {
        const ex = _exercise({items: ["Engage clutch", "Select gear", "Release clutch"]});
        expect(orderingPayloadErrors(ex)).toEqual([]);
    });

    it("rejects a missing ext_payload (SHAPE)", () => {
        const ex = _exercise(undefined);
        expect(orderingPayloadErrors(ex)).toHaveLength(1);
        expect(orderingPayloadErrors(ex)[0]).toContain("ext_payload");
    });

    it("rejects a non-array items (SHAPE)", () => {
        expect(orderingPayloadErrors(_exercise({items: "a"}))[0]).toContain("ext_payload");
    });

    it("rejects a non-string entry in items (SHAPE)", () => {
        expect(orderingPayloadErrors(_exercise({items: ["a", 2]}))[0]).toContain("ext_payload");
    });

    it("rejects fewer than 2 items (COUNT)", () => {
        const errors = orderingPayloadErrors(_exercise({items: ["only one"]}));
        expect(errors.some((e) => e.includes("at least 2"))).toBe(true);
    });

    it("rejects an empty item (ITEM)", () => {
        const errors = orderingPayloadErrors(_exercise({items: ["a", "  ", "c"]}));
        expect(errors.some((e) => e.includes("non-empty"))).toBe(true);
    });

    it("rejects duplicate items (DUPLICATE) — a duplicate makes the order ambiguous", () => {
        const errors = orderingPayloadErrors(_exercise({items: ["a", "b", "a"]}));
        expect(errors.some((e) => e.includes("unique") || e.includes("duplicate"))).toBe(true);
    });
});

describe("asOrderingPayload", () => {
    it("returns the payload when shaped right", () => {
        const ex = _exercise({items: ["a", "b"]});
        expect(asOrderingPayload(ex)).toEqual({items: ["a", "b"]});
    });

    it("returns null when malformed", () => {
        expect(asOrderingPayload(_exercise(undefined))).toBeNull();
        expect(asOrderingPayload(_exercise({items: "a"}))).toBeNull();
    });
});

describe("canonicalOrderingSequence", () => {
    it("is the items joined by a space", () => {
        expect(
            canonicalOrderingSequence(_exercise({items: ["Engage clutch", "Select gear"]})),
        ).toBe("Engage clutch Select gear");
    });

    it("is empty when the payload is malformed", () => {
        expect(canonicalOrderingSequence(_exercise(undefined))).toBe("");
    });
});

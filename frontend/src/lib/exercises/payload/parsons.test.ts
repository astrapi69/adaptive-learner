/**
 * Payload-validation tests for ``ext:al-parsons`` (#3110) — the app-side
 * mirror of the engine's ``ext:ref-parsons`` reference rules.
 */

import {describe, expect, it} from "vitest";

import {
    asParsonsPayload,
    canonicalParsonsSequence,
    parsonsPayloadErrors,
    PARSONS_EXT_TYPE,
} from "./parsons";
import type {ContentLessonExercise} from "../../../storage/types";

function _exercise(
    payload: unknown,
    overrides: Partial<ContentLessonExercise> = {},
): ContentLessonExercise {
    return {
        id: "ex-parsons",
        type: PARSONS_EXT_TYPE,
        prompt: "Arrange the code lines.",
        card_ids: [],
        distractors: [],
        ext_payload: payload as ContentLessonExercise["ext_payload"],
        ...overrides,
    };
}

const LINES = [
    {code: "def greet(name):", indent: 0},
    {code: "print(f'Hello {name}')", indent: 1},
];

describe("parsonsPayloadErrors (#3110)", () => {
    it("accepts a well-formed payload", () => {
        expect(parsonsPayloadErrors(_exercise({lines: LINES}))).toEqual([]);
    });

    it("accepts a well-formed payload with a language", () => {
        expect(
            parsonsPayloadErrors(_exercise({lines: LINES, language: "python"})),
        ).toEqual([]);
    });

    it("rejects a missing ext_payload (SHAPE)", () => {
        const errors = parsonsPayloadErrors(_exercise(undefined));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ext_payload");
    });

    it("rejects a non-array lines (SHAPE)", () => {
        expect(parsonsPayloadErrors(_exercise({lines: "a"}))[0]).toContain("ext_payload");
    });

    it("rejects a line missing code (SHAPE)", () => {
        expect(
            parsonsPayloadErrors(_exercise({lines: [{indent: 0}, LINES[1]]}))[0],
        ).toContain("ext_payload");
    });

    it("rejects a non-numeric indent (SHAPE)", () => {
        expect(
            parsonsPayloadErrors(
                _exercise({lines: [{code: "x", indent: "a"}, LINES[1]]}),
            )[0],
        ).toContain("ext_payload");
    });

    it("rejects a negative indent (SHAPE)", () => {
        expect(
            parsonsPayloadErrors(
                _exercise({lines: [{code: "x", indent: -1}, LINES[1]]}),
            )[0],
        ).toContain("ext_payload");
    });

    it("rejects a non-string language (SHAPE)", () => {
        expect(
            parsonsPayloadErrors(_exercise({lines: LINES, language: 42}))[0],
        ).toContain("ext_payload");
    });

    it("rejects fewer than 2 lines (COUNT)", () => {
        const errors = parsonsPayloadErrors(_exercise({lines: [LINES[0]]}));
        expect(errors.some((e) => e.includes("at least 2"))).toBe(true);
    });

    it("rejects an empty code line (LINE)", () => {
        const errors = parsonsPayloadErrors(
            _exercise({lines: [{code: "  ", indent: 0}, LINES[1]]}),
        );
        expect(errors.some((e) => e.includes("non-empty"))).toBe(true);
    });

    it("accepts repeated code lines by design (identified by position, not text)", () => {
        const repeated = [
            {code: "pass", indent: 1},
            {code: "pass", indent: 1},
        ];
        expect(parsonsPayloadErrors(_exercise({lines: repeated}))).toEqual([]);
    });
});

describe("asParsonsPayload", () => {
    it("returns the payload when shaped right", () => {
        expect(asParsonsPayload(_exercise({lines: LINES}))).toEqual({
            lines: LINES,
            language: undefined,
        });
    });

    it("carries an authored language through", () => {
        expect(asParsonsPayload(_exercise({lines: LINES, language: "python"}))).toEqual({
            lines: LINES,
            language: "python",
        });
    });

    it("returns null when malformed", () => {
        expect(asParsonsPayload(_exercise(undefined))).toBeNull();
        expect(asParsonsPayload(_exercise({lines: "a"}))).toBeNull();
    });
});

describe("canonicalParsonsSequence", () => {
    it("is the code lines joined by a newline", () => {
        expect(canonicalParsonsSequence(_exercise({lines: LINES}))).toBe(
            "def greet(name):\nprint(f'Hello {name}')",
        );
    });

    it("is empty when the payload is malformed", () => {
        expect(canonicalParsonsSequence(_exercise(undefined))).toBe("");
    });
});

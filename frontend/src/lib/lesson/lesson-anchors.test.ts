/**
 * Tests for lesson theory-anchor rewriting + step lookup
 * (Phase 44 / EXP-002 / P-108).
 */

import {describe, expect, it} from "vitest";

import {
    LESSON_STEP_ANCHOR_PREFIX,
    findStepById,
    parseStepAnchor,
    rewriteAnchors,
} from "./lesson-anchors";
import type {ContentLesson} from "../../storage/types";

function _lesson(overrides: Partial<ContentLesson> = {}): ContentLesson {
    return {
        id: "01-greetings",
        title: "Greetings",
        estimated_minutes: 10,
        cards: [],
        steps: [
            {
                id: "intro",
                type: "theory",
                body: "# Intro\n\nBasic greetings.",
            },
            {
                id: "step-formality",
                type: "theory",
                body: "## Formality\n\nFormal vs informal.",
            },
            {
                id: "ex-1",
                type: "exercise",
            },
        ],
        ...overrides,
    };
}

describe("rewriteAnchors", () => {
    it("rewrites theory.md#step-id when the target exists", () => {
        const out = rewriteAnchors(
            "See [the next step](theory.md#step-formality).",
            _lesson(),
        );
        expect(out).toContain(
            `(${LESSON_STEP_ANCHOR_PREFIX}step-formality)`,
        );
    });

    it("leaves unknown step-id targets verbatim", () => {
        const out = rewriteAnchors(
            "See [missing](theory.md#nonexistent).",
            _lesson(),
        );
        expect(out).toContain("(theory.md#nonexistent)");
    });

    it("rewrites bare #step-id only when target exists", () => {
        const known = rewriteAnchors("Go to (#ex-1).", _lesson());
        expect(known).toContain(`(${LESSON_STEP_ANCHOR_PREFIX}ex-1)`);
        const unknown = rewriteAnchors("Toc (#table-of-contents).", _lesson());
        expect(unknown).toContain("(#table-of-contents)");
    });

    it("supports ./ and / prefix variants", () => {
        const out1 = rewriteAnchors("[x](./theory.md#intro)", _lesson());
        expect(out1).toContain(`(${LESSON_STEP_ANCHOR_PREFIX}intro)`);
        const out2 = rewriteAnchors("[x](/theory.md#intro)", _lesson());
        expect(out2).toContain(`(${LESSON_STEP_ANCHOR_PREFIX}intro)`);
    });

    it("leaves non-anchor text untouched", () => {
        const body =
            "Lorem ipsum [external](https://example.com) and `code`.";
        const out = rewriteAnchors(body, _lesson());
        expect(out).toBe(body);
    });

    it("handles multiple anchors in one body", () => {
        const body =
            "First [a](theory.md#intro), then [b](theory.md#step-formality).";
        const out = rewriteAnchors(body, _lesson());
        expect(out).toContain(`(${LESSON_STEP_ANCHOR_PREFIX}intro)`);
        expect(out).toContain(
            `(${LESSON_STEP_ANCHOR_PREFIX}step-formality)`,
        );
    });
});

describe("parseStepAnchor", () => {
    it("returns the step id for in-lesson anchors", () => {
        expect(
            parseStepAnchor(`${LESSON_STEP_ANCHOR_PREFIX}intro`),
        ).toBe("intro");
        expect(
            parseStepAnchor(
                `http://localhost/${LESSON_STEP_ANCHOR_PREFIX}intro`,
            ),
        ).toBe("intro");
    });

    it("returns null for external + non-anchor hrefs", () => {
        expect(parseStepAnchor("https://example.com")).toBeNull();
        expect(parseStepAnchor("#toc")).toBeNull();
        expect(parseStepAnchor("")).toBeNull();
    });
});

describe("findStepById", () => {
    it("returns step + index for known ids", () => {
        const result = findStepById(_lesson(), "step-formality");
        expect(result).not.toBeNull();
        expect(result?.index).toBe(1);
        expect(result?.step.id).toBe("step-formality");
    });

    it("returns null for unknown ids", () => {
        expect(findStepById(_lesson(), "no-such-step")).toBeNull();
    });
});

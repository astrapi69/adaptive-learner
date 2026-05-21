/**
 * Tests for the TipTap content (de)serialiser (Phase 27A).
 *
 * The backward-compatibility contract is the load-bearing
 * thing here: every stored row from before Phase 27 (plain
 * text) MUST round-trip through ``parseEditorContent`` ->
 * editor -> ``serializeEditorContent`` without breaking.
 */

import {describe, expect, it} from "vitest";

import {
    isEmptyDoc,
    isLegacyPlainText,
    parseEditorContent,
    serializeEditorContent,
} from "./content-utils";

describe("parseEditorContent", () => {
    it("returns null for null / undefined / empty / whitespace", () => {
        expect(parseEditorContent(null)).toBeNull();
        expect(parseEditorContent(undefined)).toBeNull();
        expect(parseEditorContent("")).toBeNull();
        expect(parseEditorContent("   \n  ")).toBeNull();
    });

    it("parses a serialised TipTap doc back to JSON", () => {
        const doc = {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{type: "text", text: "Hello"}],
                },
            ],
        };
        const stored = JSON.stringify(doc);
        const parsed = parseEditorContent(stored);
        expect(parsed).toEqual(doc);
    });

    it("wraps legacy plain text as paragraph nodes", () => {
        const parsed = parseEditorContent("Just a note.");
        expect(parsed).toEqual({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{type: "text", text: "Just a note."}],
                },
            ],
        });
    });

    it("wraps multi-line legacy text as one paragraph per line", () => {
        const parsed = parseEditorContent("Line one\nLine two");
        expect(parsed).toEqual({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{type: "text", text: "Line one"}],
                },
                {
                    type: "paragraph",
                    content: [{type: "text", text: "Line two"}],
                },
            ],
        });
    });

    it("treats invalid JSON as legacy text", () => {
        const parsed = parseEditorContent('{"type":"doc",broken');
        expect(parsed?.type).toBe("doc");
        const firstPara = (parsed?.content ?? [])[0];
        expect(firstPara?.type).toBe("paragraph");
        const text = (firstPara?.content ?? [])[0]?.text;
        expect(text).toContain("broken");
    });

    it("treats a JSON object that is not a TipTap doc as legacy text", () => {
        const parsed = parseEditorContent('{"some":"object"}');
        expect(parsed?.type).toBe("doc");
        const first = (parsed?.content ?? [])[0];
        expect(first?.type).toBe("paragraph");
    });
});

describe("serializeEditorContent", () => {
    it("returns null for null input", () => {
        expect(serializeEditorContent(null)).toBeNull();
    });

    it("returns null for a single-empty-paragraph doc", () => {
        const empty = {type: "doc", content: [{type: "paragraph"}]};
        expect(serializeEditorContent(empty)).toBeNull();
    });

    it("returns null for a doc that contains only whitespace text", () => {
        const ws = {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{type: "text", text: "   "}],
                },
            ],
        };
        expect(serializeEditorContent(ws)).toBeNull();
    });

    it("returns the JSON string for a non-empty doc", () => {
        const doc = {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{type: "text", text: "Body"}],
                },
            ],
        };
        const out = serializeEditorContent(doc);
        expect(out).not.toBeNull();
        expect(JSON.parse(out!)).toEqual(doc);
    });
});

describe("isEmptyDoc", () => {
    it("recognises an empty paragraph", () => {
        expect(isEmptyDoc({type: "doc", content: [{type: "paragraph"}]})).toBe(true);
    });

    it("recognises a doc with only whitespace", () => {
        expect(
            isEmptyDoc({
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [{type: "text", text: "  "}],
                    },
                ],
            }),
        ).toBe(true);
    });

    it("returns false for a doc with real text", () => {
        expect(
            isEmptyDoc({
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [{type: "text", text: "Hello"}],
                    },
                ],
            }),
        ).toBe(false);
    });
});

describe("isLegacyPlainText", () => {
    it("returns false for null / empty", () => {
        expect(isLegacyPlainText(null)).toBe(false);
        expect(isLegacyPlainText("")).toBe(false);
    });

    it("returns true for plain text", () => {
        expect(isLegacyPlainText("Just a sentence.")).toBe(true);
    });

    it("returns false for serialised TipTap JSON", () => {
        const doc = JSON.stringify({type: "doc", content: []});
        expect(isLegacyPlainText(doc)).toBe(false);
    });

    it("returns true for JSON that is not a TipTap doc", () => {
        expect(isLegacyPlainText('{"foo":"bar"}')).toBe(true);
    });

    it("returns true for unparseable JSON-ish text", () => {
        expect(isLegacyPlainText("{broken")).toBe(true);
    });
});

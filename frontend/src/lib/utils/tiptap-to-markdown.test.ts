/**
 * Tests for the TipTap-to-Markdown converter (Phase 27E).
 *
 * Two contracts:
 *
 *   1. Legacy plain-text rows (written before v1.14.0) survive
 *      the converter unchanged.
 *   2. Serialised TipTap JSON rows produce sensible Markdown
 *      for every node + mark type we ship in Phase 27.
 */

import {describe, expect, it} from "vitest";

import {renderStoredContent} from "./tiptap-to-markdown";

function doc(...content: unknown[]): string {
    return JSON.stringify({type: "doc", content});
}

describe("renderStoredContent", () => {
    it("returns empty string for null / empty input", () => {
        expect(renderStoredContent(null)).toBe("");
        expect(renderStoredContent("")).toBe("");
        expect(renderStoredContent("   ")).toBe("");
    });

    it("returns plain text verbatim (legacy v1.13.0 and earlier rows)", () => {
        expect(renderStoredContent("Hello there.")).toBe("Hello there.");
        expect(renderStoredContent("Line one\nLine two")).toBe(
            "Line one\nLine two",
        );
    });

    it("returns the original string for non-TipTap JSON objects", () => {
        const input = '{"some":"object","not":"a doc"}';
        expect(renderStoredContent(input)).toBe(input);
    });

    it("returns the original string for invalid JSON", () => {
        const input = '{"type":"doc","broken';
        expect(renderStoredContent(input)).toBe(input);
    });

    it("renders a paragraph with bold + italic + code marks", () => {
        const json = doc({
            type: "paragraph",
            content: [
                {type: "text", text: "Hello "},
                {
                    type: "text",
                    text: "world",
                    marks: [{type: "bold"}],
                },
                {type: "text", text: " and "},
                {
                    type: "text",
                    text: "code",
                    marks: [{type: "code"}],
                },
                {type: "text", text: " and "},
                {
                    type: "text",
                    text: "italics",
                    marks: [{type: "italic"}],
                },
            ],
        });
        expect(renderStoredContent(json)).toBe(
            "Hello **world** and `code` and *italics*",
        );
    });

    it("renders heading levels 1-6 with the matching # prefix", () => {
        for (const level of [1, 2, 3, 4, 5, 6]) {
            const json = doc({
                type: "heading",
                attrs: {level},
                content: [{type: "text", text: `Title ${level}`}],
            });
            expect(renderStoredContent(json)).toBe(
                `${"#".repeat(level)} Title ${level}`,
            );
        }
    });

    it("renders a bullet list with nested items", () => {
        const json = doc({
            type: "bulletList",
            content: [
                {
                    type: "listItem",
                    content: [
                        {
                            type: "paragraph",
                            content: [{type: "text", text: "First"}],
                        },
                    ],
                },
                {
                    type: "listItem",
                    content: [
                        {
                            type: "paragraph",
                            content: [{type: "text", text: "Second"}],
                        },
                    ],
                },
            ],
        });
        expect(renderStoredContent(json)).toBe("- First\n- Second");
    });

    it("renders an ordered list with sequential numbers", () => {
        const json = doc({
            type: "orderedList",
            content: [
                {
                    type: "listItem",
                    content: [
                        {
                            type: "paragraph",
                            content: [{type: "text", text: "Step A"}],
                        },
                    ],
                },
                {
                    type: "listItem",
                    content: [
                        {
                            type: "paragraph",
                            content: [{type: "text", text: "Step B"}],
                        },
                    ],
                },
            ],
        });
        expect(renderStoredContent(json)).toBe("1. Step A\n2. Step B");
    });

    it("renders a task list with checked + unchecked items", () => {
        const json = doc({
            type: "taskList",
            content: [
                {
                    type: "taskItem",
                    attrs: {checked: true},
                    content: [
                        {
                            type: "paragraph",
                            content: [{type: "text", text: "Done"}],
                        },
                    ],
                },
                {
                    type: "taskItem",
                    attrs: {checked: false},
                    content: [
                        {
                            type: "paragraph",
                            content: [{type: "text", text: "Pending"}],
                        },
                    ],
                },
            ],
        });
        expect(renderStoredContent(json)).toBe(
            "- [x] Done\n- [ ] Pending",
        );
    });

    it("renders a code block with language fence", () => {
        const json = doc({
            type: "codeBlock",
            attrs: {language: "python"},
            content: [{type: "text", text: "print('hi')"}],
        });
        expect(renderStoredContent(json)).toBe(
            "```python\nprint('hi')\n```",
        );
    });

    it("renders a code block without language when null", () => {
        const json = doc({
            type: "codeBlock",
            attrs: {language: null},
            content: [{type: "text", text: "raw"}],
        });
        expect(renderStoredContent(json)).toBe("```\nraw\n```");
    });

    it("renders a blockquote with multi-line content", () => {
        const json = doc({
            type: "blockquote",
            content: [
                {
                    type: "paragraph",
                    content: [{type: "text", text: "Cited line"}],
                },
            ],
        });
        expect(renderStoredContent(json)).toBe("> Cited line");
    });

    it("renders a link mark as [text](url)", () => {
        const json = doc({
            type: "paragraph",
            content: [
                {type: "text", text: "Visit "},
                {
                    type: "text",
                    text: "Anthropic",
                    marks: [
                        {
                            type: "link",
                            attrs: {href: "https://anthropic.com"},
                        },
                    ],
                },
                {type: "text", text: "."},
            ],
        });
        expect(renderStoredContent(json)).toBe(
            "Visit [Anthropic](https://anthropic.com).",
        );
    });

    it("renders a horizontal rule", () => {
        const json = doc(
            {
                type: "paragraph",
                content: [{type: "text", text: "Before"}],
            },
            {type: "horizontalRule"},
            {
                type: "paragraph",
                content: [{type: "text", text: "After"}],
            },
        );
        expect(renderStoredContent(json)).toBe(
            "Before\n\n---\n\nAfter",
        );
    });

    it("renders an image at the block level", () => {
        const json = doc({
            type: "image",
            attrs: {
                src: "https://example.com/x.png",
                alt: "Example",
                title: "Hover text",
            },
        });
        expect(renderStoredContent(json)).toBe(
            '![Example](https://example.com/x.png "Hover text")',
        );
    });

    it("renders a 2-column GFM table with header + body row", () => {
        const json = doc({
            type: "table",
            content: [
                {
                    type: "tableRow",
                    content: [
                        {
                            type: "tableHeader",
                            content: [
                                {
                                    type: "paragraph",
                                    content: [{type: "text", text: "Name"}],
                                },
                            ],
                        },
                        {
                            type: "tableHeader",
                            content: [
                                {
                                    type: "paragraph",
                                    content: [{type: "text", text: "Age"}],
                                },
                            ],
                        },
                    ],
                },
                {
                    type: "tableRow",
                    content: [
                        {
                            type: "tableCell",
                            content: [
                                {
                                    type: "paragraph",
                                    content: [{type: "text", text: "Ada"}],
                                },
                            ],
                        },
                        {
                            type: "tableCell",
                            content: [
                                {
                                    type: "paragraph",
                                    content: [{type: "text", text: "36"}],
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        expect(renderStoredContent(json)).toBe(
            "| Name | Age |\n| --- | --- |\n| Ada | 36 |",
        );
    });

    it("renders unknown nodes by skipping them silently", () => {
        const json = doc(
            {
                type: "paragraph",
                content: [{type: "text", text: "Real text"}],
            },
            {type: "someFutureNode", content: []},
        );
        expect(renderStoredContent(json)).toBe("Real text");
    });

    it("renders a hard break as two-space + newline", () => {
        const json = doc({
            type: "paragraph",
            content: [
                {type: "text", text: "Line one"},
                {type: "hardBreak"},
                {type: "text", text: "Line two"},
            ],
        });
        expect(renderStoredContent(json)).toBe(
            "Line one  \nLine two",
        );
    });

    it("renders underline / highlight / sub / sup with HTML or GFM fallbacks", () => {
        const json = doc({
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "u",
                    marks: [{type: "underline"}],
                },
                {type: "text", text: " "},
                {
                    type: "text",
                    text: "h",
                    marks: [{type: "highlight"}],
                },
                {type: "text", text: " "},
                {
                    type: "text",
                    text: "s",
                    marks: [{type: "subscript"}],
                },
                {type: "text", text: " "},
                {
                    type: "text",
                    text: "S",
                    marks: [{type: "superscript"}],
                },
            ],
        });
        expect(renderStoredContent(json)).toBe(
            "<u>u</u> ==h== <sub>s</sub> <sup>S</sup>",
        );
    });
});

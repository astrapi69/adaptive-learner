/**
 * Tests for browser-side PDF generation (Phase 16C).
 *
 * The actual ``window.print()`` invocation is platform-specific
 * and can't be smoke-tested in happy-dom (no print dialog).
 * What we DO verify: ``markdownToPrintHtml`` produces a complete
 * HTML document with the right title, the print CSS, and the
 * rendered body.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {buildPrintHtml, markdownToPrintHtml, openPrintWindow} from "./pdf-generator";

describe("buildPrintHtml", () => {
    it("wraps the body in a doctype + print CSS + title", () => {
        const html = buildPrintHtml("<p>hi</p>", "Test Title");
        expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
        expect(html).toContain("<title>Test Title</title>");
        expect(html).toContain("<p>hi</p>");
        expect(html).toContain("@page");
        expect(html).toContain("body");
    });

    it("escapes HTML in the title", () => {
        const html = buildPrintHtml("body", "Has <script>");
        expect(html).toContain("Has &lt;script&gt;");
        expect(html).not.toContain("Has <script>");
    });
});

describe("markdownToPrintHtml", () => {
    it("converts markdown into the wrapped print HTML", () => {
        const html = markdownToPrintHtml(
            "# Header\n\nA paragraph.",
            "Doc",
        );
        expect(html).toContain("<h1>Header</h1>");
        expect(html).toContain("<p>A paragraph.</p>");
        expect(html).toContain("<title>Doc</title>");
    });
});

describe("openPrintWindow", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    it("attaches a hidden iframe and triggers print", async () => {
        const printSpy = vi.fn();
        // Spy on HTMLIFrameElement.contentWindow.print indirectly:
        // happy-dom's contentWindow is a Window, replacing print
        // on the iframe's contentWindow before openPrintWindow uses
        // it is simplest.
        const origCreateElement = document.createElement.bind(document);
        const createSpy = vi
            .spyOn(document, "createElement")
            .mockImplementation((tag: string) => {
                const el = origCreateElement(tag);
                if (tag === "iframe") {
                    Object.defineProperty(el, "contentWindow", {
                        get() {
                            return {
                                print: printSpy,
                                focus: vi.fn(),
                            };
                        },
                    });
                    Object.defineProperty(el, "contentDocument", {
                        get() {
                            return {
                                open: vi.fn(),
                                write: vi.fn(),
                                close: vi.fn(),
                            };
                        },
                    });
                }
                return el;
            });

        await openPrintWindow("# T\n\nbody", "Title");
        expect(printSpy).toHaveBeenCalledOnce();
        const iframes = document.querySelectorAll("iframe");
        expect(iframes.length).toBeGreaterThanOrEqual(1);
        createSpy.mockRestore();
    });
});

/**
 * #1927 — tests for the TXT/Markdown book parser.
 *
 * Four-test breakdown per tdd.md: reproduction/happy-path (ATX split),
 * adaptive-level fallback, edge (no headings / empty), boundary
 * (preamble before the first heading).
 */
import {describe, expect, it} from "vitest";

import {parseTextOrMarkdown} from "./text-parser";

describe("parseTextOrMarkdown", () => {
    it("splits at level-1 ATX headings and keeps the heading in the text", () => {
        const md = [
            "# Kapitel Eins",
            "",
            "Erster Absatz.",
            "",
            "## Unterthema",
            "",
            "Mehr Text.",
            "",
            "# Kapitel Zwei",
            "",
            "Zweiter Teil.",
        ].join("\n");
        const result = parseTextOrMarkdown(md);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(2);
        expect(result.book.sections[0].title).toBe("Kapitel Eins");
        expect(result.book.sections[0].text).toContain("Kapitel Eins");
        expect(result.book.sections[0].text).toContain("Unterthema");
        expect(result.book.sections[1].title).toBe("Kapitel Zwei");
        expect(result.book.sections[1].text).toContain("Zweiter Teil.");
    });

    it("falls back to deeper heading levels when level 1 yields fewer than 2 sections", () => {
        const md = [
            "# Buchtitel",
            "",
            "## Abschnitt A",
            "Text A.",
            "",
            "## Abschnitt B",
            "Text B.",
        ].join("\n");
        const result = parseTextOrMarkdown(md);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const titles = result.book.sections.map((s) => s.title);
        expect(titles).toContain("Abschnitt A");
        expect(titles).toContain("Abschnitt B");
        expect(result.book.sections.length).toBeGreaterThanOrEqual(2);
    });

    it("returns one whole-text section when no ATX headings exist", () => {
        const txt = "Nur Fliesstext.\n\nOhne jede Ueberschrift.";
        const result = parseTextOrMarkdown(txt, {
            fallbackSectionLabel: "Ganzer Text",
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(1);
        expect(result.book.sections[0].title).toBe("Ganzer Text");
        expect(result.book.sections[0].text).toBe(txt.trim());
    });

    it("keeps a non-empty preamble before the first heading as its own section", () => {
        const md = ["Vorwort ohne Heading.", "", "# Eins", "A.", "", "# Zwei", "B."].join(
            "\n",
        );
        const result = parseTextOrMarkdown(md, {
            fallbackSectionLabel: "Abschnitt {n}",
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(3);
        expect(result.book.sections[0].title).toBe("Abschnitt 1");
        expect(result.book.sections[0].text).toBe("Vorwort ohne Heading.");
    });

    it("rejects empty / whitespace-only input", () => {
        const result = parseTextOrMarkdown("   \n\n  ");
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("no_sections");
    });

    it("exposes charCount per section", () => {
        const result = parseTextOrMarkdown("# T\nBody.");
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections[0].charCount).toBe(
            result.book.sections[0].text.length,
        );
    });
});

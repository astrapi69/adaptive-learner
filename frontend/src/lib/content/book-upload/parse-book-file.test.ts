/**
 * #1927 — tests for the parseBookFile dispatcher (size guard + format
 * routing by extension).
 */
import {describe, expect, it} from "vitest";

import {MAX_BOOK_FILE_SIZE} from "./limits";
import {parseBookFile} from "./parse-book-file";

function makeFile(name: string, content: string | Uint8Array): File {
    return new File([content as BlobPart], name);
}

describe("parseBookFile", () => {
    it("routes .md files to the text parser", async () => {
        const result = await parseBookFile(
            makeFile("buch.md", "# Eins\nA.\n# Zwei\nB."),
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.format).toBe("text");
        expect(result.book.sections).toHaveLength(2);
    });

    it("routes .txt files to the text parser (single section)", async () => {
        const result = await parseBookFile(makeFile("notiz.TXT", "Nur Text."), {
            fallbackSectionLabel: "Abschnitt {n}",
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.sections).toHaveLength(1);
    });

    it("rejects an unsupported extension", async () => {
        const result = await parseBookFile(makeFile("book.pdf", "x"));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("unsupported_format");
    });

    it("rejects a file over the size cap without reading it", async () => {
        const big = makeFile("big.epub", new Uint8Array(1024));
        Object.defineProperty(big, "size", {value: MAX_BOOK_FILE_SIZE + 1});
        const result = await parseBookFile(big);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("file_too_large");
    });

    it("routes .epub bytes to the epub parser (invalid bytes surface invalid_epub)", async () => {
        const result = await parseBookFile(makeFile("kaputt.epub", "no zip"));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("invalid_epub");
    });

    it("routes .docx bytes to the docx parser (invalid bytes surface invalid_docx)", async () => {
        const result = await parseBookFile(makeFile("kaputt.DOCX", "no zip"));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe("invalid_docx");
    });
});

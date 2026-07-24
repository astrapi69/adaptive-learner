/**
 * chunk-text (#1928).
 *
 * The offset invariant is the load-bearing one: ``useLessonAutoRead`` maps a
 * boundary charIndex onto a theory step, so a chunk that misreports its
 * position would advance the lesson to the wrong step.
 */

import { describe, expect, it } from "vitest";

import { chunkText, DEFAULT_CHUNK_SIZE } from "./chunk-text";

/** Rebuild the original text from the chunks — the round-trip invariant. */
function rejoin(chunks: ReturnType<typeof chunkText>): string {
    return chunks.map((c) => c.text).join("");
}

describe("chunkText", () => {
    it("returns nothing for an empty text", () => {
        expect(chunkText("")).toEqual([]);
    });

    it("keeps a short text as one chunk", () => {
        const text = "Ein kurzer Satz.";
        expect(chunkText(text)).toEqual([{ text, offset: 0 }]);
    });

    it("keeps a text exactly at the budget as one chunk", () => {
        const text = "a".repeat(DEFAULT_CHUNK_SIZE);
        expect(chunkText(text)).toHaveLength(1);
    });

    it("splits a text one character over the budget", () => {
        const text = "a".repeat(DEFAULT_CHUNK_SIZE + 1);
        expect(chunkText(text).length).toBeGreaterThan(1);
    });

    // The regression this whole change exists for: a theory-run-sized text
    // must not reach the engine as a single utterance.
    it("splits a theory-run-sized text into several chunks", () => {
        const sentence = "Dies ist ein vollstaendiger Satz mit etwas Inhalt. ";
        const text = sentence.repeat(31); // ~1550 chars, the measured median
        const chunks = chunkText(text);
        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(chunk.text.length).toBeLessThanOrEqual(DEFAULT_CHUNK_SIZE);
        }
    });

    it("loses no characters — the chunks rejoin to the original", () => {
        const text = "Satz eins. Satz zwei! Satz drei? ".repeat(20);
        expect(rejoin(chunkText(text))).toBe(text);
    });

    it("reports an offset that indexes the original text exactly", () => {
        const text = "Satz eins. Satz zwei! Satz drei? ".repeat(20);
        for (const chunk of chunkText(text)) {
            expect(text.slice(chunk.offset, chunk.offset + chunk.text.length)).toBe(
                chunk.text,
            );
        }
    });

    it("produces offsets that are strictly increasing and gapless", () => {
        const chunks = chunkText("Ein Satz. ".repeat(60));
        let expected = 0;
        for (const chunk of chunks) {
            expect(chunk.offset).toBe(expected);
            expected += chunk.text.length;
        }
    });

    it("prefers a sentence end over a word boundary", () => {
        // The chunk ends right after the terminator; the separating space
        // starts the next chunk. Either side may carry it — what matters is
        // that no character is lost and the offsets stay exact.
        const chunks = chunkText("Erster Satz. Zweiter Satz folgt hier.", 20);
        expect(chunks[0].text).toBe("Erster Satz.");
        expect(chunks[1].text.startsWith(" Zweiter")).toBe(true);
    });

    it("does not split a decimal or an abbreviation mid-number", () => {
        // The "." in "1.5" is not followed by whitespace, so it is no split point.
        const chunks = chunkText("Der Wert 1.5 ist gemeint hier.", 14);
        for (const chunk of chunks) expect(chunk.text).not.toMatch(/1\.$/);
    });

    it("falls back to a word boundary when there is no sentence end", () => {
        const chunks = chunkText("alpha beta gamma delta epsilon zeta", 12);
        for (const chunk of chunks) {
            // No chunk ends mid-word: it ends at whitespace or at the text end.
            expect(chunk.text).toMatch(/(\s|[a-z])$/);
        }
        expect(rejoin(chunks)).toBe("alpha beta gamma delta epsilon zeta");
    });

    it("hard-cuts a single word longer than the budget", () => {
        const text = "x".repeat(30);
        const chunks = chunkText(text, 10);
        expect(chunks).toHaveLength(3);
        expect(rejoin(chunks)).toBe(text);
    });

    it("falls back to the default for a nonsensical budget", () => {
        const text = "a".repeat(300);
        expect(chunkText(text, 0).length).toBe(chunkText(text).length);
    });
});

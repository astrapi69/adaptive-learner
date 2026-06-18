import {describe, expect, it} from "vitest";

import {
    ankiFilename,
    cardsToAnkiTsv,
    lessonCardsToAnki,
    type AnkiExportCard,
} from "./anki-export";

const card = (over: Partial<AnkiExportCard>): AnkiExportCard => ({
    front: "front",
    back: "back",
    ...over,
});

/** Strip the BOM and the single trailing newline, keeping field tabs. */
const body = (tsv: string): string =>
    tsv.replace(/^\uFEFF/, "").replace(/\n$/, "");

describe("cardsToAnkiTsv", () => {
    it("starts with a UTF-8 BOM", () => {
        const tsv = cardsToAnkiTsv([card({})]);
        expect(tsv.charCodeAt(0)).toBe(0xfeff);
    });

    it("emits the Anki header directives by default", () => {
        const tsv = cardsToAnkiTsv([card({})]);
        expect(tsv).toContain("#separator:tab");
        expect(tsv).toContain("#html:true");
        expect(tsv).toContain("#tags column:3");
    });

    it("can omit the header directives", () => {
        const tsv = cardsToAnkiTsv([card({})], {header: false});
        expect(tsv).not.toContain("#separator");
    });

    it("renders one tab-separated row per card (front, back, tags)", () => {
        const tsv = cardsToAnkiTsv(
            [card({front: "el perro", back: "the dog", tags: ["es", "a1"]})],
            {header: false},
        );
        const row = body(tsv);
        expect(row).toBe("el perro\tthe dog\tes a1");
    });

    it("preserves accented and non-Latin characters", () => {
        const tsv = cardsToAnkiTsv(
            [card({front: "Tschüß / Grüße", back: "안녕 / さようなら"})],
            {header: false},
        );
        expect(tsv).toContain("Tschüß / Grüße");
        expect(tsv).toContain("안녕 / さようなら");
    });

    it("escapes tabs to spaces and newlines to <br> (one line per card)", () => {
        const tsv = cardsToAnkiTsv(
            [card({front: "line1\nline2", back: "a\tb"})],
            {header: false},
        );
        const row = body(tsv);
        expect(row).toBe("line1<br>line2\ta b\t");
        expect(row).not.toContain("\n");
    });

    it("skips cards with neither front nor back", () => {
        const tsv = cardsToAnkiTsv(
            [card({front: "", back: ""}), card({front: "x", back: "y"})],
            {header: false},
        );
        const rows = body(tsv).split("\n");
        expect(rows).toHaveLength(1);
        expect(rows[0]).toContain("x\ty");
    });

    it("treats tags as optional (empty tag column)", () => {
        const tsv = cardsToAnkiTsv([card({tags: undefined})], {header: false});
        const row = body(tsv);
        expect(row).toBe("front\tback\t");
    });

    it("prepends deck tags and sanitizes whitespace in tags", () => {
        const tsv = cardsToAnkiTsv(
            [card({tags: ["my tag"]})],
            {header: false, deckTags: ["Spanish A1"]},
        );
        const row = body(tsv);
        expect(row.split("\t")[2]).toBe("Spanish_A1 my_tag");
    });
});

describe("lessonCardsToAnki", () => {
    it("maps front/back/tags through", () => {
        const out = lessonCardsToAnki([
            {id: "1", front: "f", back: "b", tags: ["t"]},
        ] as never);
        expect(out).toEqual([{front: "f", back: "b", tags: ["t"]}]);
    });

    it("falls back to a code snippet when back is empty", () => {
        const out = lessonCardsToAnki([
            {id: "1", front: "print?", back: "", tags: [], code_snippet: "print()"},
        ] as never);
        expect(out[0].back).toBe("print()");
    });
});

describe("ankiFilename", () => {
    it("slugifies the title and appends -anki.txt", () => {
        expect(ankiFilename("Spanish A1 — Greetings")).toBe(
            "spanish-a1-greetings-anki.txt",
        );
    });

    it("falls back to deck when the title slugifies to empty", () => {
        expect(ankiFilename("???")).toBe("deck-anki.txt");
    });

    it("strips diacritics for an ASCII-safe filename", () => {
        expect(ankiFilename("Français")).toBe("francais-anki.txt");
    });
});

import {describe, expect, it} from "vitest";

import {parseCsvCards} from "./csv-cards";

describe("parseCsvCards", () => {
    it("parses comma-separated rows", () => {
        const rows = parseCsvCards("Bonjour, Guten Tag, Formal greeting");
        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual({
            front: "Bonjour",
            back: "Guten Tag",
            notes: "Formal greeting",
            valid: true,
        });
    });

    it("parses tab-separated rows", () => {
        const rows = parseCsvCards("Merci\tDanke\tThanks");
        expect(rows[0]).toEqual({
            front: "Merci",
            back: "Danke",
            notes: "Thanks",
            valid: true,
        });
    });

    it("treats notes as optional", () => {
        const rows = parseCsvCards("Oui,Ja");
        expect(rows[0].notes).toBe("");
        expect(rows[0].valid).toBe(true);
    });

    it("flags rows missing front or back as invalid", () => {
        const rows = parseCsvCards("OnlyFront\n,OnlyBack\nGood,Pair");
        expect(rows[0].valid).toBe(false); // missing back
        expect(rows[1].valid).toBe(false); // missing front
        expect(rows[2].valid).toBe(true);
    });

    it("skips a header row", () => {
        const rows = parseCsvCards("front,back,notes\nBonjour,Guten Tag");
        expect(rows).toHaveLength(1);
        expect(rows[0].front).toBe("Bonjour");
    });

    it("strips surrounding quotes and ignores blank lines", () => {
        const rows = parseCsvCards('"Bonjour","Guten Tag"\n\n  \n"Merci","Danke"');
        expect(rows).toHaveLength(2);
        expect(rows[0].front).toBe("Bonjour");
        expect(rows[1].back).toBe("Danke");
    });
});

/**
 * #3072 - token-role suggestions for the card editor.
 *
 * The design decision this file pins: the suggester proposes ONLY closed
 * word classes (article, preposition), because those are finite lists, so
 * a match is a lookup rather than a guess. Open classes (noun, verb,
 * adjective) and the morpheme markers (gender_marker, tense_marker) get
 * NO suggestion at all - there is no parser, and the cloze generator
 * draws a same-role distractor pool from whatever role it finds, so a
 * confidently wrong role is worse than an empty one.
 *
 * The schema constraints are the other half: `token` must be a VERBATIM
 * slice of the card's front (no whitespace normalisation, original
 * casing), a token is annotated once, and a card carries at most ten
 * roles.
 */

import {describe, expect, it} from "vitest";

import {
    isVerbatimSlice,
    MAX_TOKEN_ROLES,
    suggestTokenRoles,
} from "./token-role-suggest";

describe("suggestTokenRoles: closed classes only", () => {
    it("suggests German articles and prepositions from the front", () => {
        const out = suggestTokenRoles("der Hund in dem Garten", "de");
        expect(out).toEqual([
            {token: "der", role: "article"},
            {token: "in", role: "preposition"},
            {token: "dem", role: "article"},
        ]);
    });

    it("suggests nothing for open word classes", () => {
        // "Hund" is a noun and "läuft" a verb; both are open classes.
        const out = suggestTokenRoles("Hund läuft", "de");
        expect(out).toEqual([]);
    });

    it("never proposes gender_marker or tense_marker", () => {
        const fronts = ["der Hund", "the dog", "el perro", "le chien"];
        const langs = ["de", "en", "es", "fr"];
        const roles = fronts.flatMap((f, i) =>
            suggestTokenRoles(f, langs[i]).map((s) => s.role),
        );
        expect(roles).not.toContain("gender_marker");
        expect(roles).not.toContain("tense_marker");
    });
});

describe("suggestTokenRoles: the verbatim-slice contract", () => {
    it("returns the token with its ORIGINAL casing, not the lookup form", () => {
        const out = suggestTokenRoles("Der Hund", "de");
        expect(out).toEqual([{token: "Der", role: "article"}]);
    });

    it("strips surrounding punctuation so the token stays a real slice", () => {
        const front = "Der Hund, in dem Garten.";
        for (const {token} of suggestTokenRoles(front, "de")) {
            expect(front).toContain(token);
        }
    });

    it("every suggested token is a verbatim slice of the front", () => {
        const cases: [string, string][] = [
            ["el perro y la casa", "es"],
            ["the dog on the table", "en"],
            ["le chien dans la maison", "fr"],
            ["il cane con la palla", "it"],
            ["o cão sem a bola", "pt"],
        ];
        for (const [front, lang] of cases) {
            const out = suggestTokenRoles(front, lang);
            expect(out.length).toBeGreaterThan(0);
            for (const {token} of out) expect(front).toContain(token);
        }
    });
});

describe("suggestTokenRoles: ambiguity is not guessed", () => {
    it("skips a word that belongs to two classes in the same language", () => {
        // Portuguese "a" is both the feminine article and the preposition
        // "to". Picking one would be a coin flip, so neither is offered.
        const out = suggestTokenRoles("a bola", "pt");
        expect(out).toEqual([]);
    });

    it("still suggests the unambiguous words around an ambiguous one", () => {
        const out = suggestTokenRoles("a bola sem o cão", "pt");
        expect(out.map((s) => s.token)).toEqual(["sem", "o"]);
    });
});

describe("suggestTokenRoles: language handling", () => {
    it("returns nothing for a language with no list", () => {
        expect(suggestTokenRoles("犬 が 走る", "ja")).toEqual([]);
    });

    it("offers no article for Turkish, which has none", () => {
        // Turkish has no definite article; postpositions still qualify.
        const out = suggestTokenRoles("kitap ile ev", "tr");
        expect(out).toEqual([{token: "ile", role: "preposition"}]);
    });

    it("accepts a region tag and matches on the base language", () => {
        expect(suggestTokenRoles("der Hund", "de-AT")).toEqual([
            {token: "der", role: "article"},
        ]);
    });

    it("matches case-insensitively but reports verbatim", () => {
        expect(suggestTokenRoles("DER Hund", "de")).toEqual([
            {token: "DER", role: "article"},
        ]);
    });
});

describe("suggestTokenRoles: boundaries", () => {
    it("returns an empty list for an empty front", () => {
        expect(suggestTokenRoles("", "de")).toEqual([]);
        expect(suggestTokenRoles("   ", "de")).toEqual([]);
    });

    it("never exceeds the schema's maxItems", () => {
        const front = Array(40).fill("der").join(" und ");
        expect(suggestTokenRoles(front, "de").length).toBeLessThanOrEqual(
            MAX_TOKEN_ROLES,
        );
    });

    it("annotates a repeated token only once", () => {
        const out = suggestTokenRoles("der Hund und der Garten", "de");
        expect(out.filter((s) => s.token === "der")).toHaveLength(1);
    });

    it("pins the schema's cap so a schema bump is noticed here", () => {
        expect(MAX_TOKEN_ROLES).toBe(10);
    });
});

describe("isVerbatimSlice", () => {
    it("accepts a literal substring", () => {
        expect(isVerbatimSlice("Hund", "Der Hund")).toBe(true);
    });

    it("rejects a token that differs in casing", () => {
        expect(isVerbatimSlice("hund", "Der Hund")).toBe(false);
    });

    it("rejects a token absent from the front", () => {
        expect(isVerbatimSlice("Katze", "Der Hund")).toBe(false);
    });

    it("rejects an empty token", () => {
        expect(isVerbatimSlice("", "Der Hund")).toBe(false);
        expect(isVerbatimSlice("   ", "Der Hund")).toBe(false);
    });

    it("accepts a sub-word slice, which the schema allows on purpose", () => {
        // The schema says sub-word morphemes are annotatable.
        expect(isVerbatimSlice("und", "Der Hund")).toBe(true);
    });
});

/**
 * subjectSuggest unit tests (Phase 22F).
 */

import {describe, expect, it} from "vitest";

import {suggestSubjects} from "./subjectSuggest";
import type {Subject} from "../types/domain";

function subj(id: string, name: string, parent: string | null = null): Subject {
    return {
        id,
        parent_id: parent,
        name,
        description: null,
        icon: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    };
}

const tree: Subject[] = [
    subj("lang", "Languages"),
    subj("es", "Spanish", "lang"),
    subj("es-grammar", "Grammar", "es"),
    subj("es-vocab", "Vocabulary", "es"),
    subj("fr", "French", "lang"),
    subj("math", "Mathematics"),
    subj("math-algebra", "Algebra", "math"),
    subj("prog", "Programming"),
    subj("py", "Python", "prog"),
    subj("py-algo", "Algorithms", "py"),
];

describe("suggestSubjects", () => {
    it("returns empty list for empty topic", () => {
        expect(suggestSubjects("", tree)).toEqual([]);
    });

    it("returns empty list for empty subjects", () => {
        expect(suggestSubjects("Spanish Grammar", [])).toEqual([]);
    });

    it("matches 'Spanish Grammar' to the leaf node with the parent path", () => {
        const out = suggestSubjects("Spanish Grammar", tree);
        expect(out.length).toBeGreaterThan(0);
        expect(out[0]?.subject.id).toBe("es-grammar");
        expect(out[0]?.path).toBe("Languages > Spanish > Grammar");
    });

    it("matches 'Python Algorithms' to py-algo with parent path", () => {
        const out = suggestSubjects("Python Algorithms", tree);
        expect(out[0]?.subject.id).toBe("py-algo");
        expect(out[0]?.path).toBe("Programming > Python > Algorithms");
    });

    it("case-insensitive matching", () => {
        const out = suggestSubjects("SPANISH grammar", tree);
        expect(out[0]?.subject.id).toBe("es-grammar");
    });

    it("ranks deeper match higher than ancestor match", () => {
        // "Spanish" alone matches both es and es-vocab via "Spanish".
        // The leaf es should rank above the ancestor lang.
        const out = suggestSubjects("Spanish", tree);
        const top = out[0]?.subject.id;
        expect(top === "es").toBe(true);
    });

    it("respects the limit parameter", () => {
        const out = suggestSubjects("Spanish Grammar Vocabulary Algebra", tree, 2);
        expect(out.length).toBe(2);
    });

    it("returns empty list when nothing matches", () => {
        const out = suggestSubjects("Underwater basket weaving", tree);
        expect(out).toEqual([]);
    });
});

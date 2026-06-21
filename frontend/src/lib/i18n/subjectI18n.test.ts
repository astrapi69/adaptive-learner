/**
 * Tests for the subject-name display i18n helper (#80).
 *
 * Covers the normalization, catalog lookup, fallback for proper nouns
 * / custom subjects, and segment-wise path translation. The catalog
 * itself (subjects.* parity across all 8 langs) is pinned separately in
 * ``data/i18n/taxonomy-keys.test.ts``.
 */

import {describe, expect, it} from "vitest";

import en from "../../data/i18n/en.json";
import {
    subjectNameKey,
    translateSubjectName,
    translateSubjectPath,
} from "./subjectI18n";

const enSubjects = en.subjects as Record<string, string>;

/** A ``t`` that resolves against the bundled EN catalog, like production. */
function enT(key: string, fallback?: string): string {
    const parts = key.split(".");
    let cursor: unknown = en;
    for (const part of parts) {
        if (cursor && typeof cursor === "object" && part in cursor) {
            cursor = (cursor as Record<string, unknown>)[part];
        } else {
            return fallback ?? key;
        }
    }
    return typeof cursor === "string" ? cursor : (fallback ?? key);
}

describe("subjectNameKey", () => {
    it("lowercases and collapses non-alphanumerics to underscores", () => {
        expect(subjectNameKey("Linear Algebra")).toBe("linear_algebra");
        expect(subjectNameKey("Art History")).toBe("art_history");
        expect(subjectNameKey("Social Sciences")).toBe("social_sciences");
    });

    it("trims leading/trailing underscores from symbol-heavy names", () => {
        expect(subjectNameKey("C#")).toBe("c");
        expect(subjectNameKey("C++")).toBe("c");
        expect(subjectNameKey("</>")).toBe("");
    });
});

describe("translateSubjectName", () => {
    it("translates a known category against the catalog", () => {
        expect(translateSubjectName("Mathematics", enT)).toBe(
            enSubjects.mathematics,
        );
        expect(translateSubjectName("Psychology", enT)).toBe(
            enSubjects.psychology,
        );
    });

    it("falls back to the raw name for proper nouns with no key", () => {
        expect(translateSubjectName("Python", enT)).toBe("Python");
        expect(translateSubjectName("React", enT)).toBe("React");
    });

    it("falls back to the raw name for a user-created custom subject", () => {
        expect(translateSubjectName("My Weird Topic", enT)).toBe(
            "My Weird Topic",
        );
    });
});

describe("translateSubjectPath", () => {
    it("translates each segment of a > path independently", () => {
        const out = translateSubjectPath("Languages > Spanish > Grammar", enT);
        expect(out).toBe(
            `${enSubjects.languages} > ${enSubjects.spanish} > ${enSubjects.grammar}`,
        );
    });

    it("keeps untranslatable segments verbatim", () => {
        expect(translateSubjectPath("Programming > Python > Basics", enT)).toBe(
            `${enSubjects.programming} > Python > ${enSubjects.basics}`,
        );
    });
});

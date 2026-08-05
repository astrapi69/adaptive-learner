/**
 * #2384 — internal-vs-validation error classification in ``checkDraft``.
 *
 * When the validator throws an UNEXPECTED error (an app bug — e.g. the
 * ``(0 , T.default) is not a function`` TypeError from a broken bundle
 * import, the concrete symptom of #2288), the author cannot fix it by
 * editing the lesson. ``checkDraft`` must flag it as internal so the
 * review step shows a "this is our bug, please report it" message instead
 * of framing the raw technical string as an invalid lesson structure.
 *
 * The intentional validation path (``generated lesson invalid: <reason>``)
 * is covered in ``draft-to-lesson.test.ts`` with the REAL validator; here
 * ``validateGeneratedLesson`` is mocked to throw a non-prefixed error so
 * the internal branch is exercised deterministically.
 */

import {describe, expect, it, vi} from "vitest";

vi.mock("../analysis/analysis-to-lesson", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../analysis/analysis-to-lesson")>();
    return {
        ...actual,
        validateGeneratedLesson: vi.fn(() => {
            throw new Error("(0 , T.default) is not a function");
        }),
    };
});

import {checkDraft, type DraftLessonInput} from "./draft-to-lesson";
import {generateExercises} from "../../exercises";
import type {LessonMeta} from "./lesson-draft";

const META: LessonMeta = {
    title: "My French Basics",
    titleNative: "Bases du français",
    sourceLanguage: "de",
    targetLanguage: "fr",
    level: "A1",
    description: "A starter lesson.",
    author: "Aster",
    domain: "language",
};

function input(): DraftLessonInput {
    const cards = Array.from({length: 5}, (_u, i) => ({
        id: `c${i}`,
        front: `front-${i}`,
        back: `back-${i}`,
        notes: "",
        image: "",
    }));
    const exercises = generateExercises(
        cards.map((c) => ({id: c.id, front: c.front, back: c.back})),
        {count: 10, types: ["matching", "free_text"], direction: "auto"},
    );
    return {meta: META, cards, exercises};
}

describe("checkDraft internal-error classification (#2384)", () => {
    it("flags an unexpected validator TypeError as internal", () => {
        const checks = checkDraft(input());
        expect(checks.schemaValid).toBe(false);
        expect(checks.schemaErrorIsInternal).toBe(true);
    });

    it("keeps the raw technical message as diagnostic detail", () => {
        const checks = checkDraft(input());
        // The unprefixed message is preserved verbatim so it can ride along
        // in a bug report — it is NOT reworded into a fake content reason.
        expect(checks.schemaError).toBe("(0 , T.default) is not a function");
    });

    it("does not disguise the internal error as a content violation", () => {
        const checks = checkDraft(input());
        // The other content checks still pass — only the schema check fails,
        // and it fails for an internal reason, not because the draft is bad.
        expect(checks.hasTitle).toBe(true);
        expect(checks.languagePair).toBe(true);
        expect(checks.enoughCards).toBe(true);
        expect(checks.schemaError).not.toContain("generated lesson invalid:");
    });
});

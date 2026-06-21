import {beforeEach, describe, expect, it} from "vitest";

import {
    clearLessonDraft,
    draftHasContent,
    loadLessonDraft,
    newCardId,
    saveLessonDraft,
    type LessonDraft,
} from "./lesson-draft";

function draft(overrides: Partial<LessonDraft> = {}): LessonDraft {
    return {
        schema: 1,
        step: 2,
        meta: {
            title: "My Lesson",
            titleNative: "Ma leçon",
            sourceLanguage: "de",
            targetLanguage: "fr",
            level: "A1",
            description: "",
            author: "Aster",
        },
        cards: [
            {id: "c1", front: "Bonjour", back: "Hallo", notes: "", image: ""},
        ],
        updatedAt: "",
        ...overrides,
    };
}

beforeEach(() => localStorage.clear());

describe("lesson-draft", () => {
    it("round-trips save → load", () => {
        saveLessonDraft(draft());
        const loaded = loadLessonDraft();
        expect(loaded?.meta.title).toBe("My Lesson");
        expect(loaded?.cards).toHaveLength(1);
        expect(loaded?.step).toBe(2);
        expect(loaded?.updatedAt).not.toBe(""); // stamped on save
    });

    it("returns null when nothing is stored", () => {
        expect(loadLessonDraft()).toBeNull();
    });

    it("repairs an equal source/target language pair on load", () => {
        // Regression: a stale draft with source === target left Step 1
        // of the Lesson Creator permanently unadvanceable (the
        // same-language guard never cleared, so Weiter silently did
        // nothing). The loader now coerces target to a different code.
        localStorage.setItem(
            "adaptive-learner.lesson-draft",
            JSON.stringify(
                draft({
                    meta: {
                        ...draft().meta,
                        sourceLanguage: "de",
                        targetLanguage: "de",
                    },
                }),
            ),
        );
        const loaded = loadLessonDraft();
        expect(loaded?.meta.sourceLanguage).toBe("de");
        expect(loaded?.meta.targetLanguage).not.toBe("de");
        expect(loaded?.meta.targetLanguage).toBe("en");
    });

    it("repairs an equal en/en pair to a non-en target", () => {
        localStorage.setItem(
            "adaptive-learner.lesson-draft",
            JSON.stringify(
                draft({
                    meta: {
                        ...draft().meta,
                        sourceLanguage: "en",
                        targetLanguage: "en",
                    },
                }),
            ),
        );
        const loaded = loadLessonDraft();
        expect(loaded?.meta.sourceLanguage).toBe("en");
        expect(loaded?.meta.targetLanguage).toBe("fr");
    });

    it("returns null on corrupt JSON", () => {
        localStorage.setItem("adaptive-learner.lesson-draft", "{not json");
        expect(loadLessonDraft()).toBeNull();
    });

    it("clears the draft", () => {
        saveLessonDraft(draft());
        clearLessonDraft();
        expect(loadLessonDraft()).toBeNull();
    });

    it("draftHasContent reflects title / cards", () => {
        expect(draftHasContent(null)).toBe(false);
        expect(
            draftHasContent(
                draft({
                    meta: {...draft().meta, title: ""},
                    cards: [],
                }),
            ),
        ).toBe(false);
        expect(draftHasContent(draft({cards: []}))).toBe(true); // title set
    });

    it("newCardId produces unique ids", () => {
        expect(newCardId()).not.toBe(newCardId());
    });
});

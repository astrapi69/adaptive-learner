import {beforeEach, describe, expect, it} from "vitest";

import {
    clearLessonDraft,
    draftHasContent,
    loadLessonDraft,
    newCardId,
    saveLessonDraft,
    updateMetaField,
    type LessonDraft,
    type LessonMeta,
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
            domain: "language",
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

    // #1716 — a same-language pair is INTENTIONAL for a knowledge domain
    // (single content language), so the loader must NOT repair it away.
    it("keeps an equal pair for a non-language domain (#1716)", () => {
        localStorage.setItem(
            "adaptive-learner.lesson-draft",
            JSON.stringify(
                draft({
                    meta: {
                        ...draft().meta,
                        sourceLanguage: "de",
                        targetLanguage: "de",
                        domain: "knowledge",
                    },
                }),
            ),
        );
        const loaded = loadLessonDraft();
        expect(loaded?.meta.sourceLanguage).toBe("de");
        expect(loaded?.meta.targetLanguage).toBe("de");
        expect(loaded?.meta.domain).toBe("knowledge");
    });

    it("defaults a missing domain to language on load (#1716)", () => {
        const d = draft();
        // Simulate a pre-#1716 draft with no domain field.
        const meta = {...d.meta} as Record<string, unknown>;
        delete meta.domain;
        localStorage.setItem(
            "adaptive-learner.lesson-draft",
            JSON.stringify({...d, meta}),
        );
        const loaded = loadLessonDraft();
        expect(loaded?.meta.domain).toBe("language");
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

    // #1797 — cards can carry additional accepted answers for the
    // free-text generator; they must survive a draft round-trip.
    it("round-trips a card's altAnswers", () => {
        saveLessonDraft(
            draft({
                cards: [
                    {
                        id: "c1",
                        front: "single",
                        back: "Single",
                        notes: "",
                        image: "",
                        altAnswers: ["noch Single", "alleinstehend"],
                    },
                ],
            }),
        );
        const loaded = loadLessonDraft();
        expect(loaded?.cards[0].altAnswers).toEqual([
            "noch Single",
            "alleinstehend",
        ]);
    });

    it("defaults altAnswers to an empty array for legacy cards", () => {
        localStorage.setItem(
            "adaptive-learner.lesson-draft",
            JSON.stringify(
                draft({
                    cards: [
                        {id: "c1", front: "Bonjour", back: "Hallo", notes: "", image: ""},
                    ] as never,
                }),
            ),
        );
        const loaded = loadLessonDraft();
        expect(loaded?.cards[0].altAnswers).toEqual([]);
    });
});

// #1716 — the pair/level sync when the content domain changes.
describe("updateMetaField content-domain sync (#1716)", () => {
    const base: LessonMeta = {
        title: "T",
        titleNative: "",
        sourceLanguage: "de",
        targetLanguage: "fr",
        level: "A2",
        description: "",
        author: "",
        domain: "language",
    };

    it("is pure (does not mutate the input meta)", () => {
        const snapshot = {...base};
        updateMetaField(base, "domain", "psychology");
        expect(base).toEqual(snapshot);
    });

    it("switching into a knowledge domain collapses the pair + clears the level", () => {
        const next = updateMetaField(base, "domain", "psychology");
        expect(next.domain).toBe("psychology");
        expect(next.sourceLanguage).toBe("fr"); // collapsed to the target
        expect(next.targetLanguage).toBe("fr");
        expect(next.level).toBe(""); // level-less
    });

    it("editing the content language mirrors it across the pair (knowledge)", () => {
        const knowledge = updateMetaField(base, "domain", "knowledge");
        const next = updateMetaField(knowledge, "targetLanguage", "en");
        expect(next.sourceLanguage).toBe("en");
        expect(next.targetLanguage).toBe("en");
    });

    it("switching back to language restores a CEFR default when level was cleared", () => {
        const knowledge = updateMetaField(base, "domain", "psychology");
        expect(knowledge.level).toBe("");
        const back = updateMetaField(knowledge, "domain", "language");
        expect(back.level).toBe("A1");
    });

    it("switching back to language keeps a non-empty level as-is", () => {
        // A knowledge lesson where the user picked a CEFR level anyway.
        const withLevel = {...base, domain: "psychology", level: "B1"};
        const back = updateMetaField(withLevel, "domain", "language");
        expect(back.level).toBe("B1");
    });

    it("in the language domain a language edit does NOT touch the other side", () => {
        const next = updateMetaField(base, "targetLanguage", "es");
        expect(next.targetLanguage).toBe("es");
        expect(next.sourceLanguage).toBe("de"); // untouched
    });
});

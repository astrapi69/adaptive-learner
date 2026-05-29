/**
 * Q-117: tests for the praise-phrase picker. The picker must
 * never repeat a phrase within a session until the whole pool
 * has been shown, and must fall back gracefully.
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    getPhrases,
    nextPraise,
    pickPhrase,
    resetPraiseSession,
    type PraiseCategory,
} from "./phrase-picker";

const CATEGORIES: PraiseCategory[] = [
    "correct_answer",
    "lesson_complete",
    "streak_milestone",
    "mastery",
    "improvement",
];

describe("phrase-picker — pools", () => {
    it("every category has phrases in EN and DE", () => {
        for (const category of CATEGORIES) {
            expect(getPhrases(category, "en").length).toBeGreaterThan(0);
            expect(getPhrases(category, "de").length).toBeGreaterThan(0);
        }
    });

    it("falls back to EN for an unknown language", () => {
        const fallback = getPhrases("correct_answer", "xx");
        const en = getPhrases("correct_answer", "en");
        expect(fallback.map((p) => p.key)).toEqual(en.map((p) => p.key));
    });

    it("resolves region codes to the base language", () => {
        const deDe = getPhrases("correct_answer", "de-DE");
        const de = getPhrases("correct_answer", "de");
        expect(deDe.map((p) => p.key)).toEqual(de.map((p) => p.key));
    });

    it("returns a copy so callers cannot mutate the catalog", () => {
        const first = getPhrases("mastery", "en");
        first.pop();
        const second = getPhrases("mastery", "en");
        expect(second.length).toBeGreaterThan(first.length);
    });
});

describe("phrase-picker — pure pickPhrase", () => {
    it("skips used keys", () => {
        const phrases = getPhrases("correct_answer", "en");
        const used = new Set([phrases[0].key]);
        const picked = pickPhrase("correct_answer", "en", used);
        expect(picked).not.toBeNull();
        expect(picked!.key).not.toBe(phrases[0].key);
    });

    it("resets to the first phrase when every key is used", () => {
        const phrases = getPhrases("mastery", "en");
        const used = new Set(phrases.map((p) => p.key));
        const picked = pickPhrase("mastery", "en", used);
        expect(picked!.key).toBe(phrases[0].key);
    });

    it("returns the phrase text matching the key", () => {
        const phrases = getPhrases("lesson_complete", "de");
        const picked = pickPhrase("lesson_complete", "de", new Set());
        const match = phrases.find((p) => p.key === picked!.key);
        expect(picked!.phrase).toBe(match!.text);
    });
});

describe("phrase-picker — stateful nextPraise (Q-117)", () => {
    beforeEach(() => resetPraiseSession());

    it("never repeats a phrase before the whole pool is shown", () => {
        const poolSize = getPhrases("correct_answer", "en").length;
        const seen: string[] = [];
        for (let i = 0; i < poolSize; i++) {
            const picked = nextPraise("correct_answer", "en");
            seen.push(picked!.key);
        }
        // All keys within one full cycle are distinct.
        expect(new Set(seen).size).toBe(poolSize);
    });

    it("never produces the same phrase twice in immediate succession", () => {
        let previous = "";
        for (let i = 0; i < 100; i++) {
            const picked = nextPraise("streak_milestone", "en");
            expect(picked!.key).not.toBe(previous);
            previous = picked!.key;
        }
    });

    it("cycles: after exhausting the pool it starts over with a full set", () => {
        const poolSize = getPhrases("improvement", "en").length;
        const firstCycle: string[] = [];
        for (let i = 0; i < poolSize; i++) {
            firstCycle.push(nextPraise("improvement", "en")!.key);
        }
        const secondCycle: string[] = [];
        for (let i = 0; i < poolSize; i++) {
            secondCycle.push(nextPraise("improvement", "en")!.key);
        }
        expect(new Set(secondCycle).size).toBe(poolSize);
        // The two cycles cover the same key set.
        expect(new Set(secondCycle)).toEqual(new Set(firstCycle));
    });

    it("tracks categories independently", () => {
        const a = nextPraise("correct_answer", "en")!.key;
        const b = nextPraise("mastery", "en")!.key;
        // Picking from mastery does not advance correct_answer.
        const a2 = nextPraise("correct_answer", "en")!.key;
        expect(a2).not.toBe(a);
        expect(b).toBeTruthy();
    });

    it("resetPraiseSession clears tracking", () => {
        const first = nextPraise("lesson_complete", "en")!.key;
        resetPraiseSession();
        const afterReset = nextPraise("lesson_complete", "en")!.key;
        // After reset, the pool starts from the top again.
        expect(afterReset).toBe(first);
    });
});

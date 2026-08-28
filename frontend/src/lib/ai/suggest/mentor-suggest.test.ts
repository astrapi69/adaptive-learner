/**
 * Mentor fix suggester (#2769) — deterministic prompt + reply cleaning
 * against a fake provider (the EXP-050 suggest-helper test pattern).
 */

import {describe, expect, it} from "vitest";

import {buildMentorFixPrompt, suggestMentorFix} from "./mentor-suggest";
import type {ContentLessonExercise} from "../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-1",
    type: "free_text",
    prompt: "Translate merci",
    card_ids: [],
    accept: ["thank you"],
    distractors: [],
};

const INPUT = {
    category: "typo" as const,
    noteText: "Umlaut fehlt im Prompt",
    lessonTitle: "Begrüßungen",
    exercise: EXERCISE,
    language: "de",
};

describe("mentor fix suggester (#2769)", () => {
    it("puts note, category, lesson title, exercise JSON and language into the prompt", () => {
        const prompt = buildMentorFixPrompt(INPUT);
        expect(prompt).toContain("Umlaut fehlt im Prompt");
        expect(prompt).toContain("typo");
        expect(prompt).toContain("Begrüßungen");
        expect(prompt).toContain('"Translate merci"');
        expect(prompt).toContain('"de"');
    });

    it("marks a theory-step note instead of inventing exercise JSON", () => {
        const prompt = buildMentorFixPrompt({...INPUT, exercise: null});
        expect(prompt).toContain("theory step");
        expect(prompt).not.toContain('"Translate merci"');
    });

    it("returns the cleaned reply and strips code fences", async () => {
        const provider = {
            complete: async () => "```\nSchreibe „Übersetze merci“.\n```",
        };
        await expect(suggestMentorFix(provider, INPUT)).resolves.toBe(
            "Schreibe „Übersetze merci“.",
        );
    });

    it("returns an empty string for a whitespace-only reply", async () => {
        const provider = {complete: async () => "   \n  "};
        await expect(suggestMentorFix(provider, INPUT)).resolves.toBe("");
    });
});

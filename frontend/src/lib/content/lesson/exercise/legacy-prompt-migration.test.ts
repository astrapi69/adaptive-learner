/**
 * Tests for the legacy exercise-prompt migration (#1860).
 *
 * The migration only replaces a prompt that is BYTE-IDENTICAL to a known
 * old ``DEFAULT_EXERCISE_PROMPTS`` value — the exact strings #1855 fixed —
 * so a deliberately user-set (or intentionally English) prompt is never
 * overwritten. It reuses the shipped ``localizedExercisePrompts`` (#1857).
 */

import {describe, expect, it} from "vitest";

import {DEFAULT_EXERCISE_PROMPTS} from "../../../exercises";
import {migrateLegacyExercisePrompts} from "./legacy-prompt-migration";
import type {ContentLessonExercise} from "../../../../storage/types";

/** German catalog stub for the localized prompt keys (#1857). */
const deT = (key: string, fallback?: string): string => {
    const de: Record<string, string> = {
        "content.lesson_gen.match_prompt":
            "Ordne jedes Wort seiner Übersetzung zu.",
        "content.lesson_gen.free_prompt": "Übersetze: {word}",
        "content.lesson_gen.cloze_prompt": "Fülle das fehlende Wort ein.",
        "content.lesson_gen.tiles_prompt":
            "Ordne die Wörter zum Satz ({word}).",
        "content.lesson_gen.pic_prompt": "Wähle das Bild für: {word}",
        "content.lesson_gen.mc_prompt": "Wähle die richtige Übersetzung von: {word}",
    };
    return de[key] ?? fallback ?? key;
};

/** English catalog stub: every localized value equals the old default. */
const enT = (_key: string, fallback?: string): string => fallback ?? _key;

function ex(
    type: string,
    prompt: string,
    id = "e1",
): ContentLessonExercise {
    return {id, type, prompt, card_ids: [], distractors: []} as ContentLessonExercise;
}

describe("migrateLegacyExercisePrompts", () => {
    it("migrates a prompt that is exactly the old English default", () => {
        const {exercises, migratedCount} = migrateLegacyExercisePrompts(
            [ex("matching", DEFAULT_EXERCISE_PROMPTS.matching)],
            deT,
        );
        expect(migratedCount).toBe(1);
        expect(exercises[0].prompt).toBe("Ordne jedes Wort seiner Übersetzung zu.");
    });

    it("migrates each core type from its exact default", () => {
        const input = [
            ex("matching", DEFAULT_EXERCISE_PROMPTS.matching, "a"),
            ex("free_text", DEFAULT_EXERCISE_PROMPTS.freeText, "b"),
            ex("cloze", DEFAULT_EXERCISE_PROMPTS.cloze, "c"),
            ex("word_tiles", DEFAULT_EXERCISE_PROMPTS.wordTiles, "d"),
            ex("picture_choice", DEFAULT_EXERCISE_PROMPTS.pictureChoice, "e"),
            ex("multiple_choice", DEFAULT_EXERCISE_PROMPTS.multipleChoice, "f"),
        ];
        const {migratedCount} = migrateLegacyExercisePrompts(input, deT);
        expect(migratedCount).toBe(6);
    });

    it("leaves a user-set divergent prompt untouched (even if English)", () => {
        // Close to, but NOT byte-identical to, the old default.
        const custom = "Match each word to its translation!";
        const {exercises, migratedCount} = migrateLegacyExercisePrompts(
            [ex("matching", custom)],
            deT,
        );
        expect(migratedCount).toBe(0);
        expect(exercises[0].prompt).toBe(custom);
    });

    it("leaves an already-localized prompt untouched", () => {
        const {exercises, migratedCount} = migrateLegacyExercisePrompts(
            [ex("matching", "Ordne jedes Wort seiner Übersetzung zu.")],
            deT,
        );
        expect(migratedCount).toBe(0);
        expect(exercises[0].prompt).toBe(
            "Ordne jedes Wort seiner Übersetzung zu.",
        );
    });

    it("is a no-op when the UI language is English (localized == default)", () => {
        const {exercises, migratedCount} = migrateLegacyExercisePrompts(
            [ex("matching", DEFAULT_EXERCISE_PROMPTS.matching)],
            enT,
        );
        expect(migratedCount).toBe(0);
        expect(exercises[0].prompt).toBe(DEFAULT_EXERCISE_PROMPTS.matching);
    });

    it("never touches a non-core / extension exercise type", () => {
        const {exercises, migratedCount} = migrateLegacyExercisePrompts(
            [ex("ext:al-categorization", DEFAULT_EXERCISE_PROMPTS.matching)],
            deT,
        );
        expect(migratedCount).toBe(0);
        expect(exercises[0].prompt).toBe(DEFAULT_EXERCISE_PROMPTS.matching);
    });

    it("does not mutate the input array or its exercises", () => {
        const input = [ex("matching", DEFAULT_EXERCISE_PROMPTS.matching)];
        const original = input[0];
        migrateLegacyExercisePrompts(input, deT);
        expect(input[0]).toBe(original);
        expect(input[0].prompt).toBe(DEFAULT_EXERCISE_PROMPTS.matching);
    });
});

import {describe, expect, it} from "vitest";

import {
    generateExercises,
    type GeneratorCard,
} from "./exercise-generator";

function cards(n: number, withExample = false, withImage = false): GeneratorCard[] {
    const words = ["chat", "chien", "oiseau", "poisson", "cheval", "lapin"];
    return Array.from({length: n}, (_u, i) => ({
        id: `c${i}`,
        front: words[i % words.length],
        back: `animal-${i}`,
        example: withExample ? `Le ${words[i % words.length]} dort.` : null,
        image: withImage ? `img/${i}.png` : null,
    }));
}

describe("generateExercises", () => {
    it("produces a mix of types from cards with examples", () => {
        const ex = generateExercises(cards(6, true), {
            count: 20,
            types: ["matching", "free_text", "cloze", "word_tiles"],
            direction: "auto",
        });
        const types = new Set(ex.map((e) => e.type));
        expect(types.has("matching")).toBe(true);
        expect(types.has("free_text")).toBe(true);
        expect(types.has("cloze")).toBe(true);
        expect(types.has("word_tiles")).toBe(true);
        // Every exercise is well-formed.
        expect(ex.every((e) => e.id && e.card_ids.length > 0)).toBe(true);
    });

    it("respects the type filter", () => {
        const ex = generateExercises(cards(6), {
            count: 20,
            types: ["matching"],
            direction: "auto",
        });
        expect(ex.length).toBeGreaterThan(0);
        expect(ex.every((e) => e.type === "matching")).toBe(true);
    });

    it("caps at the requested count", () => {
        const ex = generateExercises(cards(6, true), {
            count: 3,
            types: ["matching", "free_text", "cloze", "word_tiles"],
            direction: "auto",
        });
        expect(ex.length).toBeLessThanOrEqual(3);
    });

    it("omits cloze + word_tiles when no examples exist", () => {
        const ex = generateExercises(cards(6, false), {
            count: 20,
            types: ["matching", "free_text", "cloze", "word_tiles"],
            direction: "auto",
        });
        const types = new Set(ex.map((e) => e.type));
        expect(types.has("cloze")).toBe(false);
        expect(types.has("word_tiles")).toBe(false);
        expect(types.has("free_text")).toBe(true);
    });

    it("applies a productive direction to every exercise", () => {
        const ex = generateExercises(cards(6), {
            count: 20,
            types: ["matching", "free_text"],
            direction: "productive",
        });
        expect(ex.every((e) => e.direction === "source_to_target")).toBe(true);
    });

    it("leaves direction null under the auto strategy", () => {
        const ex = generateExercises(cards(6), {
            count: 5,
            types: ["free_text"],
            direction: "auto",
        });
        expect(ex.every((e) => e.direction == null)).toBe(true);
    });

    it("builds picture-choice exercises from images", () => {
        const ex = generateExercises(cards(4, false, true), {
            count: 20,
            types: ["picture_choice"],
            direction: "auto",
        });
        expect(ex.length).toBeGreaterThan(0);
        expect(ex[0].type).toBe("picture_choice");
        expect((ex[0].images?.length ?? 0)).toBeGreaterThanOrEqual(2);
    });
});

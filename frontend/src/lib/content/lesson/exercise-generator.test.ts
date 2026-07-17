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

    // #1763 — uploaded card images are stored as base64 data URIs, which
    // would blow past the picture_choice ``src`` schema cap (maxLength
    // 500) and fail ``validateGeneratedLesson``. They must be excluded
    // from picture-choice generation; short repo paths still feed it.
    it("excludes data-URI card images from picture-choice", () => {
        const dataUri = `data:image/jpeg;base64,${"A".repeat(2000)}`;
        const withDataUris: GeneratorCard[] = [
            {id: "c0", front: "chat", back: "cat", image: dataUri},
            {id: "c1", front: "chien", back: "dog", image: dataUri},
            {id: "c2", front: "oiseau", back: "bird", image: dataUri},
        ];
        const ex = generateExercises(withDataUris, {
            count: 20,
            types: ["picture_choice"],
            direction: "auto",
        });
        expect(ex).toHaveLength(0);
    });

    it("still builds picture-choice from short repo-path images", () => {
        const paths: GeneratorCard[] = [
            {id: "c0", front: "chat", back: "cat", image: "img/chat.png"},
            {id: "c1", front: "chien", back: "dog", image: "img/chien.png"},
        ];
        const ex = generateExercises(paths, {
            count: 20,
            types: ["picture_choice"],
            direction: "auto",
        });
        expect(ex.length).toBeGreaterThan(0);
        expect(ex[0].type).toBe("picture_choice");
        expect(ex[0].images?.every((im) => !im.src.startsWith("data:"))).toBe(true);
    });
});

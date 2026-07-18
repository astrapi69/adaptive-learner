import {describe, expect, it} from "vitest";

import {
    buildFreeText,
    generateExercises,
    type GeneratorCard,
} from "./exercise-generator";
import {isFreeTextCorrect} from "../../../components/exercises/renderers/FreeTextExercise";

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

    // #1763 stored uploaded card images as base64 data URIs but had to
    // EXCLUDE them from picture-choice (the engine's ``src`` cap was 500
    // chars). Engine 0.13.0 / schema 1.8 (#1770) accepts data URIs in
    // ``src`` explicitly - uploaded images now feed picture-choice.
    it("includes data-URI card images in picture-choice (engine 0.13.0)", () => {
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
        expect(ex.length).toBeGreaterThan(0);
        expect(ex[0].type).toBe("picture_choice");
        expect(ex[0].images?.some((im) => im.src === dataUri)).toBe(true);
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

// #1797 — a card can carry additional accepted answers so the wizard can
// author a free-text exercise that accepts more than the single ``back``.
describe("buildFreeText — multiple accepted answers (#1797)", () => {
    it("puts the card back AND its alternatives into accept", () => {
        const ex = buildFreeText(
            [{id: "c0", front: "single", back: "Single", altAnswers: ["noch Single"]}],
            "Translate: {word}",
        );
        expect(ex).toHaveLength(1);
        expect(ex[0].accept).toContain("Single");
        expect(ex[0].accept).toContain("noch Single");
    });

    it("grades every authored variant as correct", () => {
        const ex = buildFreeText(
            [{id: "c0", front: "single", back: "Single", altAnswers: ["noch Single"]}],
            "Translate: {word}",
        );
        const accept = ex[0].accept ?? [];
        expect(isFreeTextCorrect("Single", accept)).toBe(true);
        expect(isFreeTextCorrect("noch Single", accept)).toBe(true);
    });

    it("dedupes and drops blank alternatives, keeping lowercase forms", () => {
        const ex = buildFreeText(
            [
                {
                    id: "c0",
                    front: "hi",
                    back: "Hallo",
                    altAnswers: ["Hallo", "  ", "Servus"],
                },
            ],
            "Translate: {word}",
        );
        const accept = ex[0].accept ?? [];
        // Hallo + hallo + Servus + servus — the duplicate "Hallo" and the
        // blank entry are gone.
        expect(accept).toEqual(
            expect.arrayContaining(["Hallo", "hallo", "Servus", "servus"]),
        );
        expect(accept).not.toContain("  ");
        expect(new Set(accept).size).toBe(accept.length);
    });

    it("is a no-op for a card without alternatives (backward compatible)", () => {
        const ex = buildFreeText(
            [{id: "c0", front: "hi", back: "Hallo"}],
            "Translate: {word}",
        );
        // Unchanged from the pre-#1797 behaviour: back + its lowercase form.
        expect(ex[0].accept).toEqual(["Hallo", "hallo"]);
    });
});

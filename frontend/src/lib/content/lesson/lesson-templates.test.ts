import {describe, expect, it} from "vitest";

import {applyTemplate, LESSON_TEMPLATE_KEYS} from "./lesson-templates";

describe("lesson-templates", () => {
    it("blank → no cards, default config", () => {
        const t = applyTemplate("blank");
        expect(t.cards).toHaveLength(0);
        expect(t.config.types.length).toBeGreaterThan(0);
    });

    it("vocabulary → 10 empty slots, matching + free text", () => {
        const t = applyTemplate("vocabulary");
        expect(t.cards).toHaveLength(10);
        expect(t.cards.every((c) => c.front === "" && c.back === "")).toBe(true);
        expect(t.config.types).toEqual(["matching", "free_text"]);
    });

    it("grammar → 5 slots incl. cloze", () => {
        const t = applyTemplate("grammar");
        expect(t.cards).toHaveLength(5);
        expect(t.config.types).toContain("cloze");
    });

    it("conversation → 5 slots, word tiles + cloze", () => {
        const t = applyTemplate("conversation");
        expect(t.cards).toHaveLength(5);
        expect(t.config.types).toContain("word_tiles");
        expect(t.config.types).toContain("cloze");
    });

    it("every template key resolves", () => {
        for (const key of LESSON_TEMPLATE_KEYS) {
            expect(applyTemplate(key).cards).toBeInstanceOf(Array);
        }
    });

    it("template cards have unique ids", () => {
        const ids = applyTemplate("vocabulary").cards.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

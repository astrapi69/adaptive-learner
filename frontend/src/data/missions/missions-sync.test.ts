/**
 * Drift pin (EXP-010 / Phase 56A): the bundled
 * ``frontend/src/data/missions/templates.json`` is what the
 * mission generator reads at runtime in BOTH storage modes.
 *
 * The plugin ``templates.yaml`` is the canonical authoring
 * surface; ``make sync-missions`` regenerates the JSON. This pin
 * asserts the structural invariants the generator relies on:
 *   1. >= 20 templates, all with the canonical fields,
 *   2. unique ids,
 *   3. every category + difficulty represented (the generator
 *      picks one easy + one medium + one hard).
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

interface Template {
    id: string;
    title_key: string;
    description_key: string;
    category: string;
    target_value: number;
    difficulty: string;
    xp_reward: number;
    icon: string;
    check_function: string;
}

const CATEGORIES = ["learning", "review", "mastery", "exploration", "streak"];
const DIFFICULTIES = ["easy", "medium", "hard"];

const bundle: {templates: Template[]} = JSON.parse(
    readFileSync(join(__dirname, "templates.json"), "utf-8"),
);

describe("mission templates bundle", () => {
    it("has at least 20 templates", () => {
        expect(bundle.templates.length).toBeGreaterThanOrEqual(20);
    });

    it("every template has the canonical shape", () => {
        for (const t of bundle.templates) {
            expect(typeof t.id).toBe("string");
            expect(t.id.length).toBeGreaterThan(0);
            expect(t.title_key).toMatch(/^missions\.templates\./);
            expect(t.description_key).toMatch(/^missions\.templates\./);
            expect(CATEGORIES).toContain(t.category);
            expect(DIFFICULTIES).toContain(t.difficulty);
            expect(t.target_value).toBeGreaterThan(0);
            expect(t.xp_reward).toBeGreaterThanOrEqual(0);
            expect(t.icon.length).toBeGreaterThan(0);
            expect(t.check_function.length).toBeGreaterThan(0);
        }
    });

    it("ids are unique", () => {
        const ids = bundle.templates.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("every category and difficulty is represented", () => {
        const cats = new Set(bundle.templates.map((t) => t.category));
        const diffs = new Set(bundle.templates.map((t) => t.difficulty));
        expect([...cats].sort()).toEqual([...CATEGORIES].sort());
        expect([...diffs].sort()).toEqual([...DIFFICULTIES].sort());
    });
});

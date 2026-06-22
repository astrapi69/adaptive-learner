/**
 * Tests for the lesson-mode config objects (#1011): every mode has a
 * config, the aid flags match each mode's intent, and ``configForMode``
 * falls back to practice.
 */

import {describe, expect, it} from "vitest";

import {configForMode, MODE_CONFIGS} from "./lessonModeConfig";
import type {LessonMode} from "./lessonModePref";

const ALL_MODES: LessonMode[] = [
    "practice",
    "exam",
    "timed",
    "error",
    "reverse",
    "shuffle",
    "endless",
];

describe("MODE_CONFIGS", () => {
    it("defines a config for every mode, keyed by its own mode", () => {
        for (const mode of ALL_MODES) {
            expect(MODE_CONFIGS[mode]).toBeDefined();
            expect(MODE_CONFIGS[mode].mode).toBe(mode);
        }
    });

    it("practice keeps every aid on with immediate feedback", () => {
        const p = MODE_CONFIGS.practice;
        expect(p.showHints).toBe(true);
        expect(p.showTheoryRecap).toBe(true);
        expect(p.showReadAloud).toBe(true);
        expect(p.showAnswerToggle).toBe(true);
        expect(p.immediateFeedback).toBe(true);
        expect(p.xpMultiplier).toBe(1.0);
    });

    it("exam hides every aid + immediate feedback and boosts XP", () => {
        const e = MODE_CONFIGS.exam;
        expect(e.showHints).toBe(false);
        expect(e.showTheoryRecap).toBe(false);
        expect(e.showReadAloud).toBe(false);
        expect(e.showAnswerToggle).toBe(false);
        expect(e.immediateFeedback).toBe(false);
        expect(e.xpMultiplier).toBe(1.5);
    });

    it("timed keeps hints + feedback, drops recap/read-aloud, adds bonus", () => {
        const ti = MODE_CONFIGS.timed;
        expect(ti.showHints).toBe(true);
        expect(ti.immediateFeedback).toBe(true);
        expect(ti.showTheoryRecap).toBe(false);
        expect(ti.showReadAloud).toBe(false);
        expect(ti.timeBonusOnCorrect).toBe(5);
    });

    it("drives the card-source modes via cardSource / direction / end", () => {
        expect(MODE_CONFIGS.error.cardSource).toBe("errors");
        expect(MODE_CONFIGS.reverse.cardDirection).toBe("reverse");
        expect(MODE_CONFIGS.shuffle.cardSource).toBe("set-shuffle");
        expect(MODE_CONFIGS.endless.cardSource).toBe("srs");
        expect(MODE_CONFIGS.endless.sessionEnd).toBe("endless");
    });
});

describe("configForMode", () => {
    it("returns the matching config", () => {
        expect(configForMode("timed").mode).toBe("timed");
    });

    it("falls back to practice for an unknown id", () => {
        expect(configForMode("bogus" as LessonMode).mode).toBe("practice");
    });
});

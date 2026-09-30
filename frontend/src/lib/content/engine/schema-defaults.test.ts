/**
 * A lesson read in browser mode carries every schema default the API
 * backend fills in through Pydantic (#3372, third recurrence after #1636
 * and #3349, which each fixed one field).
 *
 * The raw JSON below is the shape authors ship: 111 exercises in the real
 * content repos have no ``card_ids``, 2927 no ``distractors``. Every
 * assertion goes through a consumer that crashed on the missing field.
 */

import {describe, expect, it} from "vitest";

import engineLessonSchema from "learn-content-engine/schema/lesson.schema.json";

import {parseLesson, type LessonSetContext} from "./index";
import {resolveCorrectionSourceCard} from "../../../components/exercises/feedback/correction-source-card";
import {buildLessonResultJson} from "../../lesson/export/result-export";

const CONTEXT: LessonSetContext = {
    language: "de",
    target_language: "de",
    source_language: "en",
    domain: "philosophy",
};

/** Cards and a cloze exercise without ``card_ids`` / ``distractors``, as
 *  alc-die-waehrung-des-geistes 01-04 ship them; no ``estimated_minutes``,
 *  no card ``tags``. */
const RAW = {
    id: "01-intro",
    title: "Intro",
    cards: [{id: "c1", front: "Geld", back: "money"}],
    steps: [
        {
            id: "ex-1",
            type: "exercise",
            exercise: {id: "ex-1", type: "cloze", prompt: "Fill", sentence: "Das ___ ist knapp."},
        },
    ],
};

describe("schema defaults on the Dexie parse path (#3372)", () => {
    const lesson = parseLesson(JSON.stringify(RAW), CONTEXT);
    const exercise = lesson.steps[0].exercise!;

    it.each([
        ["exercise.card_ids", () => exercise.card_ids, []],
        ["exercise.distractors", () => exercise.distractors, []],
        ["card.tags", () => lesson.cards[0].tags, []],
        ["lesson.estimated_minutes", () => lesson.estimated_minutes, 10],
    ])("fills %s with the schema default", (_name, read, expected) => {
        expect(read()).toEqual(expected);
    });

    it("keeps values the lesson carries", () => {
        const withIds = parseLesson(
            JSON.stringify({
                ...RAW,
                estimated_minutes: 25,
                steps: [{...RAW.steps[0], exercise: {...RAW.steps[0].exercise, card_ids: ["c1"]}}],
            }),
            CONTEXT,
        );
        expect(withIds.estimated_minutes).toBe(25);
        expect(withIds.steps[0].exercise!.card_ids).toEqual(["c1"]);
    });

    it("the result JSON export no longer throws on a card-less exercise", () => {
        expect(() =>
            buildLessonResultJson({
                lesson,
                progress: {step_results: {"ex-1": {correct: 0, total: 1}}} as never,
                dateStr: "2026-09-30",
                correct: 0,
                total: 1,
                pct: 0,
                weakAreas: [],
            }),
        ).not.toThrow();
    });

    it("the correction round resolves without a card instead of throwing", () => {
        expect(resolveCorrectionSourceCard(lesson, exercise, "Geld")).toBeNull();
    });

    it("applies every non-null default the engine schema declares", () => {
        // Derived from the engine's own schema, so a default added upstream
        // is covered without editing this list.
        const defs = (engineLessonSchema as {$defs: Record<string, {properties?: Record<string, {default?: unknown}>}>}).$defs;
        const exerciseDefaults = Object.entries(defs.Exercise.properties ?? {}).filter(
            ([, prop]) => prop.default !== undefined && prop.default !== null,
        );
        expect(exerciseDefaults.length).toBeGreaterThan(0);
        for (const [key, prop] of exerciseDefaults) {
            expect((exercise as unknown as Record<string, unknown>)[key], key).toEqual(prop.default);
        }
    });
});

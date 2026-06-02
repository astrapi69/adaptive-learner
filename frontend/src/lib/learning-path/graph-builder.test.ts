import {describe, expect, it} from "vitest";

import {
    buildLearningPathGraph,
    lessonKey,
    masteryForLesson,
    type GraphBuildInput,
} from "./graph-builder";
import type {ElementError, LessonProgress} from "../../storage/types";

const NOW = "2026-06-01T00:00:00Z";

function progress(
    setId: string,
    filename: string,
    status: LessonProgress["status"],
    correct = 0,
    total = 0,
): LessonProgress {
    return {
        id: `${setId}-${filename}`,
        user_id: "u",
        source: "bundled",
        set_id: setId,
        lesson_filename: filename,
        status,
        step_results: {},
        score_correct: correct,
        score_total: total,
        time_spent_seconds: 0,
        started_at: NOW,
        updated_at: NOW,
        completed_at: status === "completed" ? NOW : null,
        paused_at: status === "paused" ? NOW : null,
        abandoned_at: null,
    };
}

function err(direction: string, mastered: boolean): ElementError {
    return {
        id: Math.random().toString(36),
        user_id: "u",
        set_id: "fr-a1",
        lesson_id: "01.json",
        exercise_id: "ex",
        element_key: "le",
        direction,
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "",
        error_count: 1,
        correct_streak: mastered ? 3 : 0,
        last_error_at: NOW,
        last_attempt_at: NOW,
        mastered,
        mastered_at: mastered ? NOW : null,
        created_at: NOW,
        updated_at: NOW,
    };
}

function input(): GraphBuildInput {
    return {
        sets: [
            {
                setId: "fr-a1",
                source: "bundled",
                title: "French A1",
                sourceLanguage: "de",
                targetLanguage: "fr",
                lessons: [
                    {filename: "01.json", number: 1, title: "Articles", exerciseCount: 10},
                    {filename: "02.json", number: 2, title: "Être", exerciseCount: 8},
                    {filename: "03.json", number: 3, title: "Famille", exerciseCount: 9},
                ],
            },
        ],
        progress: {
            [lessonKey("fr-a1", "01.json")]: progress("fr-a1", "01.json", "completed", 9, 10),
            [lessonKey("fr-a1", "02.json")]: progress("fr-a1", "02.json", "paused"),
        },
        errors: {
            [lessonKey("fr-a1", "01.json")]: [
                err("target_to_source", true),
                err("target_to_source", true),
            ],
        },
        recommendedKey: lessonKey("fr-a1", "03.json"),
    };
}

describe("masteryForLesson", () => {
    it("receptive mastered when all receptive rows mastered", () => {
        const m = masteryForLesson([
            err("target_to_source", true),
            err("target_to_source", true),
        ]);
        expect(m.receptive).toBe(true);
        expect(m.productive).toBe(false);
    });
    it("not mastered if any row unmastered", () => {
        const m = masteryForLesson([
            err("target_to_source", true),
            err("target_to_source", false),
        ]);
        expect(m.receptive).toBe(false);
    });
    it("no rows -> not mastered", () => {
        expect(masteryForLesson([])).toEqual({receptive: false, productive: false});
    });
});

describe("buildLearningPathGraph", () => {
    const {nodes, edges} = buildLearningPathGraph(input());

    it("produces one group node + one node per lesson", () => {
        expect(nodes.filter((n) => n.type === "setGroup")).toHaveLength(1);
        expect(nodes.filter((n) => n.type === "lesson")).toHaveLength(3);
    });

    it("derives lesson statuses from progress + mastery", () => {
        const byId = Object.fromEntries(nodes.map((n) => [n.id, n.data]));
        expect((byId[lessonKey("fr-a1", "01.json")] as {status: string}).status).toBe(
            "completed", // completed, receptive-only mastery
        );
        expect((byId[lessonKey("fr-a1", "02.json")] as {status: string}).status).toBe(
            "paused",
        );
        expect((byId[lessonKey("fr-a1", "03.json")] as {status: string}).status).toBe(
            "not_started",
        );
    });

    it("marks the recommended lesson + its incoming edge", () => {
        const rec = nodes.find(
            (n) => n.id === lessonKey("fr-a1", "03.json"),
        );
        expect((rec?.data as {recommended: boolean}).recommended).toBe(true);
        const adaptive = edges.find((e) => e.target === lessonKey("fr-a1", "03.json"));
        expect((adaptive?.data as {kind: string})?.kind).toBe("adaptive");
    });

    it("aggregates set group progress + mastery", () => {
        const group = nodes.find((n) => n.type === "setGroup");
        const d = group?.data as {
            completed: number;
            total: number;
            receptiveMastered: number;
            productiveMastered: number;
        };
        expect(d.total).toBe(3);
        expect(d.completed).toBe(1);
        expect(d.receptiveMastered).toBe(1);
        expect(d.productiveMastered).toBe(0);
    });

    it("connects the group to its first lesson + sequential lessons", () => {
        expect(
            edges.some(
                (e) =>
                    e.source === "group-fr-a1" &&
                    e.target === lessonKey("fr-a1", "01.json"),
            ),
        ).toBe(true);
        // 2 sequential + 1 group connector = 3 edges.
        expect(edges).toHaveLength(3);
    });
});

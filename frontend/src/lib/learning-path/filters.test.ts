import {describe, expect, it} from "vitest";

import {
    classifyNode,
    firstMatch,
    graphStats,
    matchesQuery,
    type GraphFilters,
} from "./filters";
import type {LessonNodeData} from "../../components/learning-path/LessonNodeView";

function lesson(overrides: Partial<LessonNodeData> = {}): LessonNodeData {
    return {
        lessonNumber: 1,
        title: "Les articles",
        stars: 0,
        status: "not_started",
        receptiveMastered: false,
        productiveMastered: false,
        xp: 0,
        exerciseCount: 10,
        recommended: false,
        locked: false,
        setSlug: "fr",
        setId: "fr-a1",
        lessonFilename: "01.json",
        ...overrides,
    };
}

const F = (o: Partial<GraphFilters> = {}): GraphFilters => ({
    status: "all",
    direction: "all",
    query: "",
    ...o,
});

describe("classifyNode — status filter", () => {
    it("all shows everything", () => {
        expect(classifyNode(lesson(), F()).hidden).toBe(false);
    });
    it("mastered hides non-mastered", () => {
        expect(
            classifyNode(lesson({status: "completed"}), F({status: "mastered"}))
                .hidden,
        ).toBe(true);
        expect(
            classifyNode(lesson({status: "mastered"}), F({status: "mastered"}))
                .hidden,
        ).toBe(false);
    });
    it("in_progress includes paused", () => {
        expect(
            classifyNode(lesson({status: "paused"}), F({status: "in_progress"}))
                .hidden,
        ).toBe(false);
    });
});

describe("classifyNode — direction filter", () => {
    it("receptive shows only receptive-mastered", () => {
        expect(
            classifyNode(
                lesson({receptiveMastered: true}),
                F({direction: "receptive"}),
            ).hidden,
        ).toBe(false);
        expect(
            classifyNode(lesson(), F({direction: "receptive"})).hidden,
        ).toBe(true);
    });
});

describe("classifyNode — search", () => {
    it("highlights matches, fades the rest", () => {
        const match = classifyNode(
            lesson({title: "Les articles"}),
            F({query: "article"}),
        );
        expect(match.highlighted).toBe(true);
        expect(match.faded).toBe(false);
        const other = classifyNode(
            lesson({title: "La famille"}),
            F({query: "article"}),
        );
        expect(other.highlighted).toBe(false);
        expect(other.faded).toBe(true);
    });
    it("matchesQuery matches title substring + exact number", () => {
        expect(matchesQuery(lesson({lessonNumber: 7}), "7")).toBe(true);
        expect(matchesQuery(lesson(), "")).toBe(false);
    });
});

describe("graphStats + firstMatch", () => {
    const lessons = [
        lesson({status: "mastered", receptiveMastered: true, productiveMastered: true}),
        lesson({title: "Être", status: "completed", receptiveMastered: true}),
        lesson({title: "Famille", status: "not_started"}),
    ];
    it("aggregates", () => {
        expect(graphStats(lessons)).toEqual({
            totalLessons: 3,
            completed: 2,
            receptiveMastered: 2,
            productiveMastered: 1,
        });
    });
    it("firstMatch finds by title", () => {
        expect(firstMatch(lessons, "famil")?.title).toBe("Famille");
        expect(firstMatch(lessons, "zzz")).toBeNull();
    });
});

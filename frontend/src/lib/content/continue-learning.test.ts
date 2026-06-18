/**
 * Tests for the Continue Learning pure helpers (UX overhaul C2).
 *
 * Pins:
 * - groupRecentProgress: one row per set, newest-first, abandoned
 *   skipped, maxItems cap.
 * - resolveContinueAction: resume vs next vs set_complete.
 * - completedStepCount / rowStars / lessonLabelFromFilename /
 *   lessonRoute helpers.
 */

import {describe, expect, it} from "vitest";

import {
    completedStepCount,
    groupRecentProgress,
    lessonLabelFromFilename,
    lessonRoute,
    looksLikeOpaqueId,
    resolveContinueAction,
    rowStars,
} from "./continue-learning";
import type {LessonProgress} from "../../storage/types";

function progress(
    over: Partial<LessonProgress> & {
        set_id: string;
        lesson_filename: string;
        updated_at: string;
    },
): LessonProgress {
    return {
        id: `${over.set_id}#${over.lesson_filename}`,
        user_id: "u1",
        source: over.source ?? "owner/repo",
        status: "in_progress",
        step_results: {},
        score_correct: 0,
        score_total: 1,
        time_spent_seconds: 0,
        started_at: "2026-06-01T09:00:00Z",
        completed_at: null,
        paused_at: null,
        abandoned_at: null,
        ...over,
    };
}

describe("groupRecentProgress", () => {
    it("keeps one row per set, newest-first", () => {
        const rows = [
            progress({set_id: "a", lesson_filename: "01.json", updated_at: "2026-06-01T10:00:00Z"}),
            progress({set_id: "a", lesson_filename: "02.json", updated_at: "2026-06-03T10:00:00Z"}),
            progress({set_id: "b", lesson_filename: "01.json", updated_at: "2026-06-02T10:00:00Z"}),
        ];
        const groups = groupRecentProgress(rows, 5);
        expect(groups.map((g) => g.setId)).toEqual(["a", "b"]);
        // set "a" keeps its most-recently-touched lesson (02.json).
        expect(groups[0].mostRecent.lesson_filename).toBe("02.json");
    });

    it("skips abandoned rows entirely", () => {
        const rows = [
            progress({set_id: "a", lesson_filename: "01.json", updated_at: "2026-06-01T10:00:00Z", status: "abandoned"}),
        ];
        expect(groupRecentProgress(rows, 5)).toEqual([]);
    });

    it("a set whose newest row is in_progress survives even with an older abandoned row", () => {
        const rows = [
            progress({set_id: "a", lesson_filename: "01.json", updated_at: "2026-06-01T10:00:00Z", status: "abandoned"}),
            progress({set_id: "a", lesson_filename: "02.json", updated_at: "2026-06-02T10:00:00Z", status: "in_progress"}),
        ];
        const groups = groupRecentProgress(rows, 5);
        expect(groups).toHaveLength(1);
        expect(groups[0].mostRecent.lesson_filename).toBe("02.json");
    });

    it("caps at maxItems", () => {
        const rows = [
            progress({set_id: "a", lesson_filename: "01.json", updated_at: "2026-06-01T10:00:00Z"}),
            progress({set_id: "b", lesson_filename: "01.json", updated_at: "2026-06-02T10:00:00Z"}),
            progress({set_id: "c", lesson_filename: "01.json", updated_at: "2026-06-03T10:00:00Z"}),
        ];
        expect(groupRecentProgress(rows, 2)).toHaveLength(2);
    });

    it("distinguishes the same set_id across different sources", () => {
        const rows = [
            progress({source: "o1/r", set_id: "a", lesson_filename: "01.json", updated_at: "2026-06-01T10:00:00Z"}),
            progress({source: "o2/r", set_id: "a", lesson_filename: "01.json", updated_at: "2026-06-02T10:00:00Z"}),
        ];
        expect(groupRecentProgress(rows, 5)).toHaveLength(2);
    });
});

describe("resolveContinueAction", () => {
    it("resumes an in-progress lesson", () => {
        const row = progress({set_id: "a", lesson_filename: "02.json", updated_at: "x", status: "in_progress"});
        expect(resolveContinueAction(row, ["01.json", "02.json", "03.json"])).toEqual({
            mode: "resume",
            targetFilename: "02.json",
        });
    });

    it("resumes a paused lesson", () => {
        const row = progress({set_id: "a", lesson_filename: "02.json", updated_at: "x", status: "paused"});
        expect(resolveContinueAction(row, ["01.json", "02.json"]).mode).toBe("resume");
    });

    it("points to the next lesson after a completed one", () => {
        const row = progress({set_id: "a", lesson_filename: "02.json", updated_at: "x", status: "completed"});
        expect(resolveContinueAction(row, ["01.json", "02.json", "03.json"])).toEqual({
            mode: "next",
            targetFilename: "03.json",
            completedFilename: "02.json",
        });
    });

    it("reports set_complete when the completed lesson is the last", () => {
        const row = progress({set_id: "a", lesson_filename: "03.json", updated_at: "x", status: "completed"});
        expect(resolveContinueAction(row, ["01.json", "02.json", "03.json"])).toEqual({
            mode: "set_complete",
            targetFilename: "03.json",
        });
    });

    it("falls back to set_complete when the lesson list is unknown", () => {
        const row = progress({set_id: "a", lesson_filename: "02.json", updated_at: "x", status: "completed"});
        expect(resolveContinueAction(row, []).mode).toBe("set_complete");
    });
});

describe("helpers", () => {
    it("completedStepCount counts step_results keys", () => {
        const row = progress({set_id: "a", lesson_filename: "01.json", updated_at: "x"});
        row.step_results = {
            s1: {correct: 1, total: 1, attempts: 1, completed_at: "x"},
            s2: {correct: 0, total: 1, attempts: 2, completed_at: "x"},
        };
        expect(completedStepCount(row)).toBe(2);
    });

    it("rowStars maps the stored score to a star rating", () => {
        const perfect = progress({set_id: "a", lesson_filename: "01.json", updated_at: "x", score_correct: 10, score_total: 10});
        expect(rowStars(perfect)).toBe(3);
        const weak = progress({set_id: "a", lesson_filename: "01.json", updated_at: "x", score_correct: 4, score_total: 10});
        expect(rowStars(weak)).toBe(0);
    });

    it("lessonLabelFromFilename strips extension + separators", () => {
        expect(lessonLabelFromFilename("03-articles.json")).toBe("03 articles");
        expect(lessonLabelFromFilename("76_trauma_ptbs.json")).toBe("76 trauma ptbs");
    });

    it("looksLikeOpaqueId flags UUIDs, analysis ids, and long hashes (#729)", () => {
        expect(
            looksLikeOpaqueId("3b1f6e2a-9c4d-4f1a-bb2e-7d8e9f0a1b2c"),
        ).toBe(true);
        expect(
            looksLikeOpaqueId("analysis-3b1f6e2a-9c4d-4f1a-bb2e-7d8e9f0a1b2c"),
        ).toBe(true);
        expect(looksLikeOpaqueId("a1b2c3d4e5f60718")).toBe(true);
        expect(looksLikeOpaqueId("   ")).toBe(true);
    });

    it("looksLikeOpaqueId passes real human titles through", () => {
        expect(looksLikeOpaqueId("Spanish A1")).toBe(false);
        expect(looksLikeOpaqueId("03 articles")).toBe(false);
        expect(looksLikeOpaqueId("Trauma und PTBS")).toBe(false);
        expect(looksLikeOpaqueId("Français B1")).toBe(false);
    });

    it("lessonRoute builds the /lesson route with a slugged source", () => {
        expect(lessonRoute("owner/repo", "fr-a1", "01.json")).toBe(
            "/lesson/owner--repo/fr-a1/01.json",
        );
    });
});

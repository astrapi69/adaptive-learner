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
    classifyEntryCandidate,
    completedStepCount,
    groupRecentProgress,
    lessonLabelFromFilename,
    lessonRoute,
    looksLikeOpaqueId,
    partNumberOf,
    rankEntrySuggestions,
    resolveContinueAction,
    resolveLessonTitle,
    resolveSetTitle,
    rowStars,
    type ContinueMode,
    type EntryRankInput,
    type EntryTier,
} from "./continue-learning";
import type {LessonProgress, SetStatus} from "../../../storage/types";

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

    it("looksLikeOpaqueId flags split + filename-derived analysis ids (#854)", () => {
        // Auto-split lessons append a part suffix to the title/id; the
        // filename-derived label turns the dashes into spaces. All of
        // these reached the learner before #854.
        expect(
            looksLikeOpaqueId(
                "analysis-b8ff9ed4-e201-42aa-8f96-83424332c3a4 — Part 2 of 3",
            ),
        ).toBe(true);
        expect(
            looksLikeOpaqueId("analysis-b8ff9ed4-e201-42aa-8f96-83424332c3a4-part-2"),
        ).toBe(true);
        expect(
            looksLikeOpaqueId("analysis b8ff9ed4 e201 42aa 8f96 83424332c3a4"),
        ).toBe(true);
        expect(
            looksLikeOpaqueId("analysis b8ff9ed4 e201 42aa 8f96 83424332c3a4 part 2"),
        ).toBe(true);
    });

    it("looksLikeOpaqueId passes real human titles through", () => {
        expect(looksLikeOpaqueId("Spanish A1")).toBe(false);
        expect(looksLikeOpaqueId("03 articles")).toBe(false);
        expect(looksLikeOpaqueId("Trauma und PTBS")).toBe(false);
        expect(looksLikeOpaqueId("Français B1")).toBe(false);
        // #854: a hyphenated real set name must NOT be mistaken for an id.
        expect(looksLikeOpaqueId("Ansible-Grundlagen")).toBe(false);
        expect(looksLikeOpaqueId("Spanisch A1 - Teil 2")).toBe(false);
    });

    it("lessonRoute builds the /lesson route with a slugged source", () => {
        expect(lessonRoute("owner/repo", "fr-a1", "01.json")).toBe(
            "/lesson/owner--repo/fr-a1/01.json",
        );
    });
});

describe("partNumberOf", () => {
    it("extracts the part number from split ids/filenames/titles (#729)", () => {
        expect(partNumberOf("analysis-b8ff9ed4-part-3.json")).toBe(3);
        expect(partNumberOf("analysis-b8ff9ed4 - Part 2 of 3")).toBe(2);
        expect(partNumberOf("analysis b8ff9ed4 part 7")).toBe(7);
    });

    it("returns null when there is no part marker", () => {
        expect(partNumberOf("03-articles.json")).toBeNull();
        expect(partNumberOf("Spanish A1")).toBeNull();
    });
});

function candidate(opts: {
    setId: string;
    updatedAt: string;
    status?: SetStatus;
    dueCount?: number;
    mode?: ContinueMode;
}): EntryRankInput {
    const row = progress({
        set_id: opts.setId,
        lesson_filename: "01.json",
        updated_at: opts.updatedAt,
    });
    return {
        group: {source: row.source, setId: opts.setId, mostRecent: row},
        action: {mode: opts.mode ?? "resume", targetFilename: "01.json"},
        status: opts.status ?? "active",
        dueCount: opts.dueCount ?? 0,
    };
}

describe("classifyEntryCandidate (#2123)", () => {
    it("an active, still-open set is a 'started' suggestion", () => {
        expect(
            classifyEntryCandidate(
                candidate({setId: "a", updatedAt: "x", mode: "resume"}),
            ),
        ).toBe<EntryTier>("started");
    });

    it("DROPS a completed set with no due reviews (the reported bug)", () => {
        // lifecycle completed, and also the finished 'set_complete' action:
        // both signal a finished set. Nothing due → not a sensible suggestion.
        expect(
            classifyEntryCandidate(
                candidate({setId: "a", updatedAt: "x", status: "completed", dueCount: 0}),
            ),
        ).toBeNull();
        expect(
            classifyEntryCandidate(
                candidate({setId: "a", updatedAt: "x", mode: "set_complete", dueCount: 0}),
            ),
        ).toBeNull();
    });

    it("keeps a completed set as a 'review' suggestion when reviews are due", () => {
        expect(
            classifyEntryCandidate(
                candidate({setId: "a", updatedAt: "x", status: "completed", dueCount: 3}),
            ),
        ).toBe<EntryTier>("review");
    });

    it("DROPS a deferred set with no due reviews (learner set it aside)", () => {
        expect(
            classifyEntryCandidate(
                candidate({setId: "a", updatedAt: "x", status: "deferred", dueCount: 0}),
            ),
        ).toBeNull();
    });

    it("keeps a deferred set as a 'review' suggestion when reviews are due", () => {
        expect(
            classifyEntryCandidate(
                candidate({setId: "a", updatedAt: "x", status: "deferred", dueCount: 2}),
            ),
        ).toBe<EntryTier>("review");
    });
});

describe("rankEntrySuggestions (#2123)", () => {
    it("a completed set without due cards yields a DIFFERENT suggestion", () => {
        // RED proof: an in-progress set plus a (newer) completed-without-due
        // set. Before the fix the completed set (newest) would lead; the rule
        // drops it, so the in-progress set is the suggestion.
        const ranked = rankEntrySuggestions(
            [
                candidate({setId: "started", updatedAt: "2026-06-01T10:00:00Z", mode: "resume"}),
                candidate({
                    setId: "done",
                    updatedAt: "2026-06-05T10:00:00Z",
                    status: "completed",
                    dueCount: 0,
                }),
            ],
            5,
        );
        expect(ranked.map((r) => r.group.setId)).toEqual(["started"]);
    });

    it("a completed-without-due set alone yields NO suggestion (honest empty state)", () => {
        const ranked = rankEntrySuggestions(
            [candidate({setId: "done", updatedAt: "x", status: "completed", dueCount: 0})],
            5,
        );
        expect(ranked).toEqual([]);
    });

    it("ranks due-review sets before started sets", () => {
        const ranked = rankEntrySuggestions(
            [
                candidate({setId: "started", updatedAt: "2026-06-09T10:00:00Z", mode: "resume"}),
                candidate({
                    setId: "review",
                    updatedAt: "2026-06-01T10:00:00Z",
                    status: "completed",
                    dueCount: 4,
                }),
            ],
            5,
        );
        expect(ranked.map((r) => r.group.setId)).toEqual(["review", "started"]);
    });

    it("within a tier, sorts newest-touched first", () => {
        const ranked = rankEntrySuggestions(
            [
                candidate({setId: "older", updatedAt: "2026-06-01T10:00:00Z", mode: "resume"}),
                candidate({setId: "newer", updatedAt: "2026-06-08T10:00:00Z", mode: "resume"}),
            ],
            5,
        );
        expect(ranked.map((r) => r.group.setId)).toEqual(["newer", "older"]);
    });

    it("caps at maxItems after dropping", () => {
        const ranked = rankEntrySuggestions(
            [
                candidate({setId: "a", updatedAt: "2026-06-01T10:00:00Z", mode: "resume"}),
                candidate({setId: "b", updatedAt: "2026-06-02T10:00:00Z", mode: "resume"}),
                candidate({setId: "drop", updatedAt: "2026-06-09T10:00:00Z", status: "completed", dueCount: 0}),
                candidate({setId: "c", updatedAt: "2026-06-03T10:00:00Z", mode: "resume"}),
            ],
            2,
        );
        expect(ranked).toHaveLength(2);
        expect(ranked.map((r) => r.group.setId)).toEqual(["c", "b"]);
    });
});

describe("resolveSetTitle", () => {
    const sets = [
        {source: "owner/repo", id: "fr-a1", title: "French A1"},
        {source: "user-generated", id: "analysis-x", title: ""},
    ];

    it("returns the cached human title", () => {
        expect(resolveSetTitle(sets, "owner/repo", "fr-a1", "FB")).toBe(
            "French A1",
        );
    });

    it("falls back to the localized label for an opaque set id (#729)", () => {
        expect(
            resolveSetTitle(
                [],
                "user-generated",
                "analysis-b8ff9ed4-e201-42aa-8f96-83424332c3a4",
                "Imported analysis",
            ),
        ).toBe("Imported analysis");
    });

    it("falls back when the cached title is opaque/empty", () => {
        expect(
            resolveSetTitle(sets, "user-generated", "analysis-x", "Imported"),
        ).toBe("Imported");
    });
});

describe("resolveLessonTitle", () => {
    const partLabel = (n: number) => `Lesson · Part ${n}`;

    it("returns the cached lesson title when present", () => {
        expect(
            resolveLessonTitle({title: "Greetings"}, "01.json", "Lesson"),
        ).toBe("Greetings");
    });

    it("derives a label from the filename when uncached", () => {
        expect(resolveLessonTitle(null, "03-articles.json", "Lesson")).toBe(
            "03 articles",
        );
    });

    it("never leaks an opaque analysis id, keeping the part number (#729)", () => {
        const file = "analysis-b8ff9ed4-e201-42aa-8f96-83424332c3a4-part-3.json";
        expect(resolveLessonTitle(null, file, "Lesson", partLabel)).toBe(
            "Lesson · Part 3",
        );
    });

    it("falls back to the generic label for an opaque id without a part", () => {
        const file = "b8ff9ed4-e201-42aa-8f96-83424332c3a4.json";
        expect(resolveLessonTitle(null, file, "Lesson", partLabel)).toBe(
            "Lesson",
        );
    });
});

import {describe, expect, it} from "vitest";

import {buildErrorClusters} from "./error-clusters";
import {lessonKey} from "./graph-builder";
import type {ElementError} from "../../storage/types";

const NOW = "2026-06-01T00:00:00Z";

/** An article_gender error (French articles, differing). */
function articleErr(setId: string, lesson: string, count = 1): ElementError {
    return {
        id: Math.random().toString(36),
        user_id: "u",
        set_id: setId,
        lesson_id: lesson,
        exercise_id: "ex",
        element_key: "le",
        direction: "target_to_source",
        element_type: "vocabulary",
        user_answer: "la",
        correct_answer: "le",
        error_count: count,
        correct_streak: 0,
        last_error_at: NOW,
        last_attempt_at: NOW,
        mastered: false,
        mastered_at: null,
        created_at: NOW,
        updated_at: NOW,
    };
}

describe("buildErrorClusters", () => {
    it("clusters lessons sharing an error category", () => {
        const errors = {
            [lessonKey("fr-a1", "03.json")]: [articleErr("fr-a1", "03.json", 3)],
            [lessonKey("fr-a1", "07.json")]: [articleErr("fr-a1", "07.json", 2)],
        };
        const clusters = buildErrorClusters(errors);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].tag).toBe("article_gender");
        expect(clusters[0].lessonKeys).toHaveLength(2);
        expect(clusters[0].errorCount).toBe(5);
        expect(clusters[0].setId).toBe("fr-a1");
    });

    it("ignores a category present in only one lesson", () => {
        const errors = {
            [lessonKey("fr-a1", "03.json")]: [articleErr("fr-a1", "03.json")],
        };
        expect(buildErrorClusters(errors)).toHaveLength(0);
    });

    it("returns no clusters for unclassifiable errors", () => {
        const plain: ElementError = {
            ...articleErr("fr-a1", "03.json"),
            user_answer: "chien",
            correct_answer: "chat",
        };
        expect(buildErrorClusters({a: [plain], b: [plain]})).toHaveLength(0);
    });
});

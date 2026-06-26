/**
 * Tests for the lesson-result share-image generator (#1073). Under happy-dom
 * the canvas 2d context / toBlob may be unavailable, so the contract under
 * test is fail-soft: the generator must never throw and must resolve to a
 * Blob or null.
 */

import {describe, expect, it} from "vitest";

import {renderLessonShareImage} from "./lesson-share-image";
import type {LessonShareResult} from "./lesson-share";

const t = (_key: string, fallback?: string) => fallback ?? "";

const result: LessonShareResult = {
    lessonTitle: "Ansible basics",
    correct: 8,
    total: 10,
    scorePct: 80,
    stars: 2,
    level: 4,
    xp: 610,
};

describe("renderLessonShareImage", () => {
    it("resolves to a Blob or null without throwing", async () => {
        const out = await renderLessonShareImage(result, t);
        expect(out === null || out instanceof Blob).toBe(true);
    });

    it("handles a very long title without throwing", async () => {
        const out = await renderLessonShareImage(
            {...result, lessonTitle: "x".repeat(500)},
            t,
        );
        expect(out === null || out instanceof Blob).toBe(true);
    });
});

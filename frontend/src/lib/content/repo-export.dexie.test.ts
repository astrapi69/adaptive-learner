/**
 * #3242 reproduction on the real Dexie read path: a user set stores its
 * origin in the set row's ``domain``, ``getLessonDexie`` parses each lesson
 * with that row as context, the engine fills a missing lesson domain from
 * it, and the export used to write that value into every lesson file.
 * Same setup and the same two reads ``ShareAsRepoButton.fetchLessons``
 * makes as ``content-loader-user-sets.test.ts``.
 */
import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {generateLessonFromAnalysis} from "./analysis/analysis-to-lesson";
import {buildRepoExportFiles} from "./repo-export";
import {
    getLessonDexie,
    listLessonsDexie,
    saveUserSetDexie,
} from "../../storage/content/content-loader-dexie";
import {_resetDbForTests} from "../../storage/dexie/db";
import {USER_GENERATED_SOURCE} from "../../storage/types";
import type {ConversationAnalysisResult} from "../../types/domain";

const ANALYSIS: ConversationAnalysisResult = {
    topic: "Spanish travel",
    summary: "Ordering food and directions.",
    vocabulary: [
        {word: "la cuenta", translation: "the bill", example: "La cuenta, por favor."},
        {word: "el agua", translation: "the water", example: "Quiero el agua."},
        {word: "la calle", translation: "the street", example: "La calle esta cerca."},
        {word: "izquierda", translation: "left", example: "Gira a la izquierda."},
        {word: "gracias", translation: "thank you"},
    ],
};

describe("repo export on the Dexie read path (#3242)", () => {
    beforeEach(async () => {
        await _resetDbForTests();
    });

    it.each(["imported", "analysis", "adaptive"] as const)(
        "exports no lesson file with the origin marker %s as domain",
        async (origin) => {
            const stored = generateLessonFromAnalysis(ANALYSIS, {id: "01-travel"});
            expect(stored).not.toHaveProperty("domain");
            const entry = await saveUserSetDexie(
                {
                    set_id: `${origin}-travel`,
                    title: "Travel",
                    language: "es",
                    source_language: "de",
                    level: "A1",
                    origin,
                    lessons: [stored],
                },
                "2026-09-24T00:00:00Z",
            );
            expect(entry.domain).toBe(origin);
            const listing = await listLessonsDexie(USER_GENERATED_SOURCE, entry.id);
            const lessons = await Promise.all(
                listing.lessons.map(async (filename) => ({
                    filename,
                    lesson: await getLessonDexie(USER_GENERATED_SOURCE, entry.id, filename),
                })),
            );
            const files = buildRepoExportFiles({set: entry, lessons, ownerRepo: "me/travel"});
            const lessonFiles = files.filter((file) => file.path.startsWith("lessons/"));
            expect(lessonFiles).toHaveLength(1);
            for (const lessonFile of lessonFiles) {
                expect(JSON.parse(lessonFile.content).domain).toBe("language");
            }
        },
    );
});

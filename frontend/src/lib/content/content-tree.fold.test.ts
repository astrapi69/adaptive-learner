/**
 * Tests for folding user-generated lessons into buildContentTree nodes
 * (EXP-026 / UGC-02, #97).
 */

import {describe, expect, it} from "vitest";

import type {ContentSetEntry} from "../../storage/types";
import {buildContentTree, type UserFoldInput} from "./content-tree";

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
    return {
        source: "astrapi69/adaptive-learner-content",
        branch: "main",
        id: "x",
        title: "Title",
        title_native: null,
        language: over.target_language ?? "es",
        target_language: "es",
        source_language: "de",
        level: "A1",
        domain: "language",
        version: "1.0.0",
        lesson_count: 3,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: null,
        update_available: false,
        ...over,
    };
}

function userFold(
    over: Partial<ContentSetEntry>,
    lessons: UserFoldInput["lessons"],
): UserFoldInput {
    return {
        set: entry({source: "user-generated", id: "mine", title: "Mein Set", ...over}),
        lessons,
    };
}

const published = [
    entry({id: "es-a1-from-de", target_language: "es", source_language: "de", level: "A1"}),
    entry({id: "fr-a2-from-de", target_language: "fr", source_language: "de", level: "A2"}),
];

function esA1Level(tree: ReturnType<typeof buildContentTree>) {
    const src = [...tree.primary, ...tree.other].find((g) => g.sourceLanguage === "de");
    const target = src?.targets.find((t) => t.targetLanguage === "es");
    return target?.levels.find((l) => l.level === "A1");
}

describe("buildContentTree user-lesson folding", () => {
    it("defaults to no folded lessons when userFold is omitted", () => {
        const tree = buildContentTree(published, ["de"]);
        expect(esA1Level(tree)?.userLessons).toEqual([]);
    });

    it("folds a matching user set's lessons into the level node", () => {
        const fold = userFold({target_language: "es", source_language: "de", level: "A1"}, [
            {id: "mine-l1", title: "Meine Lektion"},
        ]);
        const tree = buildContentTree(published, ["de"], [fold]);
        expect(esA1Level(tree)?.userLessons).toEqual([
            {
                lessonId: "mine-l1",
                title: "Meine Lektion",
                setSource: "user-generated",
                setId: "mine",
                origin: "own",
            },
        ]);
    });

    it("marks lessons with variation_of as edits", () => {
        const fold = userFold({level: "A1"}, [
            {id: "mine-l1", title: "Original-Fork", variation_of: "es-a1-from-de-lesson-1"},
            {id: "mine-l2", title: "Eigene"},
        ]);
        const tree = buildContentTree(published, ["de"], [fold]);
        expect(esA1Level(tree)?.userLessons.map((l) => [l.lessonId, l.origin])).toEqual([
            ["mine-l1", "edit"],
            ["mine-l2", "own"],
        ]);
    });

    it("does not inflate setCount with folded lessons", () => {
        const fold = userFold({level: "A1"}, [{id: "mine-l1", title: "Meine"}]);
        const tree = buildContentTree(published, ["de"], [fold]);
        const src = tree.primary.find((g) => g.sourceLanguage === "de");
        const target = src?.targets.find((t) => t.targetLanguage === "es");
        expect(target?.setCount).toBe(1);
        expect(esA1Level(tree)?.sets).toHaveLength(1);
    });

    it("skips a user set with no matching published node", () => {
        const fold = userFold({level: "C1"}, [{id: "mine-l1", title: "Zu schwer"}]);
        const tree = buildContentTree(published, ["de"], [fold]);
        expect(esA1Level(tree)?.userLessons).toEqual([]);
    });

    it("folds a knowledge set into its domain group by domain + title", () => {
        const psych = entry({
            id: "psych-101",
            domain: "psychology",
            title: "Psychologie",
            source_language: "de",
            target_language: "de",
        });
        const fold = userFold(
            {domain: "psychology", title: "Psychologie", source_language: "de", target_language: "de"},
            [{id: "mine-p1", title: "Meine Notiz"}],
        );
        const tree = buildContentTree([...published, psych], ["de"], [fold]);
        const domain = tree.knowledge.find((g) => g.domain === "psychology");
        expect(domain?.userLessons.map((l) => l.lessonId)).toEqual(["mine-p1"]);
        expect(domain?.setCount).toBe(1);
    });
});

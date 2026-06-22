/**
 * Tests for the content-repo export serialization (#1017).
 *
 * Verifies the generated files are 100% loader-compatible by parsing them
 * back with the SAME parsers the import path uses (yaml + parseSearchIndex).
 */

import {describe, expect, it} from "vitest";
import {parse as parseYaml} from "yaml";

import {
    buildManifestYaml,
    buildReadme,
    buildRepoExportFiles,
    buildSearchIndexJson,
    lessonFilename,
    type RepoExportInput,
} from "./repo-export";
import {parseSearchIndex} from "./repos/search-index-loader";
import type {ContentLesson, ContentSetEntry} from "../../storage/types";

const SET = {
    source: "github:teacher/de-b2",
    branch: "main",
    id: "de-b2",
    title: "Deutsch B2 Kurs",
    title_native: null,
    language: "de",
    target_language: "de",
    source_language: "en",
    level: "B2",
    domain: "language",
    version: "1.2.0",
    lesson_count: 2,
    description: "A teacher's B2 course",
    tags: ["grammar", "b2"],
    cover_image: null,
    cached_version: null,
    update_available: false,
} as unknown as ContentSetEntry;

const lesson = (title: string, cards: number): ContentLesson =>
    ({
        id: title,
        title,
        estimated_minutes: 5,
        cards: Array.from({length: cards}, (_, i) => ({id: `c${i}`})),
        steps: [],
    }) as unknown as ContentLesson;

const INPUT: RepoExportInput = {
    set: SET,
    ownerRepo: "teacher/de-b2",
    lessons: [
        {filename: "01-grundkonzepte.json", lesson: lesson("Grundkonzepte", 12)},
        {filename: "02-aufbau.json", lesson: lesson("Aufbau", 10)},
    ],
};

describe("buildManifestYaml", () => {
    it("round-trips through the yaml parser with loader fields", () => {
        const m = parseYaml(buildManifestYaml(SET, 2));
        expect(m.name).toBe("Deutsch B2 Kurs");
        expect(m.source_language).toBe("en");
        expect(m.target_language).toBe("de");
        expect(m.level).toBe("B2");
        expect(m.domain).toBe("language");
        expect(m.lesson_count).toBe(2);
        expect(m.schema_version).toBe("1.4");
        expect(m.tags).toEqual(["grammar", "b2"]);
    });
});

describe("buildSearchIndexJson", () => {
    it("parses back through parseSearchIndex into a SearchableSet", () => {
        const data = JSON.parse(buildSearchIndexJson(INPUT));
        const sets = parseSearchIndex(data, INPUT.ownerRepo, "teacher/de-b2");
        expect(sets).toHaveLength(1);
        expect(sets[0].id).toBe("de-b2");
        expect(sets[0].lesson_count).toBe(2);
        expect(sets[0].card_count).toBe(22);
    });
});

describe("buildReadme", () => {
    it("includes the install steps + lesson list", () => {
        const readme = buildReadme(INPUT);
        expect(readme).toContain("# Deutsch B2 Kurs");
        expect(readme).toContain("2 lessons, 22 cards");
        expect(readme).toContain("https://github.com/teacher/de-b2");
        expect(readme).toContain("1. Grundkonzepte (12 cards)");
        expect(readme).toContain("2. Aufbau (10 cards)");
    });
});

describe("lessonFilename", () => {
    it("keeps an existing .json filename", () => {
        expect(lessonFilename(lesson("X", 1), "07-foo.json", 0)).toBe(
            "07-foo.json",
        );
    });

    it("derives a numbered slug when no filename is given", () => {
        expect(lessonFilename(lesson("Hello World!", 1), "", 2)).toBe(
            "03-hello-world.json",
        );
    });
});

describe("buildRepoExportFiles", () => {
    it("emits manifest + one file per lesson + index + README", () => {
        const files = buildRepoExportFiles(INPUT);
        const paths = files.map((f) => f.path);
        expect(paths).toEqual([
            "manifest.yaml",
            "lessons/01-grundkonzepte.json",
            "lessons/02-aufbau.json",
            "search-index.json",
            "README.md",
        ]);
        // Each lesson file is valid JSON of the lesson.
        const l1 = JSON.parse(files[1].content);
        expect(l1.title).toBe("Grundkonzepte");
    });
});

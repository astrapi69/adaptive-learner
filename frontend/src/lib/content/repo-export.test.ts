/**
 * Tests for the content-repo export serialization (#1017).
 *
 * Verifies the generated files are 100% loader-compatible by parsing them
 * back with the SAME parsers the import path uses (yaml + parseSearchIndex).
 */

import {validateManifest} from "learn-content-engine";
import {describe, expect, it} from "vitest";
import {parse as parseYaml} from "yaml";

import officialSearchIndex from "./__fixtures__/search-index-official.json";

import {
    buildManifestYaml,
    buildReadme,
    buildRepoExportFiles,
    buildSearchIndexJson,
    exportDomain,
    exportLessonDomain,
    lessonFilename,
    planLessonFilenames,
    type RepoExportInput,
} from "./repo-export";
import {parseSearchIndex} from "./repos/search-index-loader";
import {CURRENT_MANIFEST_SCHEMA_VERSION} from "./schema-version";
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
        const entry = m.sets[0];
        expect(entry.source_language).toBe("en");
        expect(entry.target_language).toBe("de");
        expect(entry.level).toBe("B2");
        expect(entry.domain).toBe("language");
        expect(entry.lesson_count).toBe(2);
        expect(m.schema_version).toBe(CURRENT_MANIFEST_SCHEMA_VERSION);
        expect(entry.tags).toEqual(["grammar", "b2"]);
    });

    // #3385 - the manifest schema rejects an empty level; a set stored
    // without one exports the engine's "none" sentinel instead.
    it("writes a set without a level as level none, in the manifest and the index", () => {
        const levelless = {...SET, level: "", domain: "knowledge"};
        expect(parseYaml(buildManifestYaml(levelless, 2)).sets[0].level).toBe("none");
        const index = JSON.parse(
            buildSearchIndexJson({...INPUT, set: levelless}),
        );
        expect(index.sets[0].level).toBe("none");
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

    // #2300 - the exported index must carry the format's REQUIRED root fields
    // (schema/search-index.schema.json: required [repo, schema_version, sets]),
    // or the registry validator rejects an app-exported repo.
    it("writes the required root fields repo + schema_version + sets", () => {
        const data = JSON.parse(buildSearchIndexJson(INPUT));
        expect(data.repo).toBe("teacher/de-b2");
        expect(data.schema_version).toBe("1.0");
        expect(Array.isArray(data.sets)).toBe(true);
        expect(data.sets.length).toBeGreaterThan(0);
        // ``generated`` (canonical name, NOT ``generated_at``) is an ISO stamp.
        expect(typeof data.generated).toBe("string");
        expect(Number.isNaN(Date.parse(data.generated))).toBe(false);
        expect(data).not.toHaveProperty("generated_at");
    });

    // Pin the root shape against the REAL canonical index (the mirrored
    // official fixture), so the app's second implementation of the format
    // cannot drift from the generator's again (#2300, same class as #2299).
    it("root keys match the canonical search-index format", () => {
        const exported = JSON.parse(buildSearchIndexJson(INPUT));
        expect(new Set(Object.keys(exported))).toEqual(
            new Set(Object.keys(officialSearchIndex)),
        );
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

// #2376 class 2 - the app-internal origin value ``imported`` (and any other
// unknown value) must never reach an exported repo: the Discover filter
// would receive a domain that does not exist.
describe("exportDomain", () => {
    it("keeps a known non-language content domain", () => {
        expect(
            exportDomain({...SET, domain: "psychology"} as ContentSetEntry),
        ).toBe("psychology");
    });

    it("keeps the default language domain", () => {
        expect(exportDomain(SET)).toBe("language");
    });

    it("maps the internal 'imported' value to language for a language pair", () => {
        expect(
            exportDomain({...SET, domain: "imported"} as ContentSetEntry),
        ).toBe("language");
    });

    it("maps an unknown domain to knowledge when source == target (a book)", () => {
        expect(
            exportDomain({
                ...SET,
                domain: "imported",
                source_language: "de",
                target_language: "de",
            } as ContentSetEntry),
        ).toBe("knowledge");
    });

    it("is used by the manifest, index, README and every lesson file", () => {
        const importedSet = {...SET, domain: "imported"} as ContentSetEntry;
        const input: RepoExportInput = {
            ...INPUT,
            set: importedSet,
            lessons: INPUT.lessons.map((l) => ({
                ...l,
                lesson: {...l.lesson, domain: "imported"} as ContentLesson,
            })),
        };
        expect(parseYaml(buildManifestYaml(importedSet, 2)).sets[0].domain).toBe(
            "language",
        );
        expect(JSON.parse(buildSearchIndexJson(input)).sets[0].domain).toBe(
            "language",
        );
        expect(buildReadme(input)).toContain("Domain: language");
        const lessonFiles = buildRepoExportFiles(input).filter((f) =>
            f.path.startsWith("sets/de-b2/lessons/"),
        );
        expect(lessonFiles).toHaveLength(2);
        for (const file of lessonFiles) {
            expect(JSON.parse(file.content).domain).toBe("language");
        }
    });
});

// #3242 - #2425 filtered the origin marker out of manifest, index and
// README; the lesson files still carried it, because the read path injects
// the set's domain (the origin) into a lesson that has none and the export
// wrote the parsed lesson as is. The export now judges every lesson's own
// domain with the same rule as the set's.
describe("exportLessonDomain (#3242)", () => {
    const languagePair = {...SET, domain: "imported"} as ContentSetEntry;
    const withDomain = (domain: unknown): ContentLesson =>
        ({...lesson("Reise", 3), domain}) as unknown as ContentLesson;

    it.each(["imported", "analysis", "adaptive"])(
        "replaces the origin marker %s with the set's export domain",
        (origin) => {
            expect(exportLessonDomain(withDomain(origin), languagePair)).toBe("language");
        },
    );

    it("keeps a lesson's own known non-language domain", () => {
        expect(exportLessonDomain(withDomain("psychology"), languagePair)).toBe("psychology");
    });

    it("keeps the default language domain unchanged", () => {
        expect(exportLessonDomain(withDomain("language"), languagePair)).toBe("language");
    });

    it("normalises case and whitespace the way exportDomain does", () => {
        expect(exportLessonDomain(withDomain("Imported"), languagePair)).toBe("language");
        expect(exportLessonDomain(withDomain(" imported "), languagePair)).toBe("language");
        expect(exportLessonDomain(withDomain(" Psychology "), languagePair)).toBe("psychology");
    });

    it("gives knowledge for an origin marker on a same-language set (a book)", () => {
        const book = {
            ...SET,
            domain: "imported",
            source_language: "de",
            target_language: "de",
        } as ContentSetEntry;
        expect(exportLessonDomain(withDomain("imported"), book)).toBe("knowledge");
    });

    it("leaves a lesson without a domain alone (the API-mode shape), also for null", () => {
        expect(exportLessonDomain(withDomain(undefined), languagePair)).toBeUndefined();
        expect(exportLessonDomain(withDomain(null), languagePair)).toBeUndefined();
    });

    it("writes no domain key into a lesson file whose lesson had none", () => {
        const files = buildRepoExportFiles({...INPUT, set: languagePair});
        const first = JSON.parse(
            files.find((f) => f.path.includes("/lessons/"))?.content ?? "{}",
        );
        expect(first).not.toHaveProperty("domain");
    });
});

// #2376 class 1 - lesson filenames must sort lexicographically into the
// source order (the display order IS the lexicographic id sort,
// learn-content-engine#106). ``kapitel-1..kapitel-14 + epilog`` exported
// verbatim displays as ``epilog, kapitel-1, kapitel-10..``.
describe("planLessonFilenames", () => {
    const named = (names: string[]) =>
        names.map((n, i) => ({
            filename: n,
            lesson: lesson(`L${i + 1}`, 1),
        }));

    it("keeps filenames whose sort order already matches the source order", () => {
        const plan = planLessonFilenames(
            named(["01-intro.json", "02-basics.json"]),
        );
        expect(plan.reordered).toBe(false);
        expect(plan.filenames).toEqual(["01-intro.json", "02-basics.json"]);
    });

    it("prefixes every lesson when the existing names sort out of order", () => {
        const names = [
            ...Array.from({length: 14}, (_, i) => `kapitel-${i + 1}.json`),
            "epilog.json",
        ];
        const plan = planLessonFilenames(named(names));
        expect(plan.reordered).toBe(true);
        expect(plan.filenames[0]).toBe("01-kapitel-1.json");
        expect(plan.filenames[9]).toBe("10-kapitel-10.json");
        expect(plan.filenames[14]).toBe("15-epilog.json");
        // The renamed list itself sorts back into the source order.
        expect([...plan.filenames].sort()).toEqual(plan.filenames);
    });

    it("replaces a stale numeric prefix instead of double-prefixing", () => {
        const plan = planLessonFilenames(
            named(["03-foo.json", "01-bar.json"]),
        );
        expect(plan.reordered).toBe(true);
        expect(plan.filenames).toEqual(["01-foo.json", "02-bar.json"]);
    });

    // #3401 - readers sort by code unit (``.sort()``, Python ``sorted``),
    // and the engine's ordering lint decides what a fragile shape is; a
    // locale-aware comparison kept names that readers display differently.
    it.each([
        ["a non-ASCII name sorting after z by code unit", ["über.json", "zebra.json"]],
        ["a mix of NN- prefixed and unprefixed ids", ["01-intro.json", "zusatz.json"]],
    ])("renumbers %s", (_name, names) => {
        const plan = planLessonFilenames(named(names));
        expect(plan.reordered).toBe(true);
        expect([...plan.filenames].sort()).toEqual(plan.filenames);
    });

    it("feeds buildRepoExportFiles so the archive carries ordered names", () => {
        const input: RepoExportInput = {
            ...INPUT,
            lessons: [
                {filename: "kapitel-2.json", lesson: lesson("K2", 1)},
                {filename: "kapitel-10.json", lesson: lesson("K10", 1)},
            ],
        };
        const paths = buildRepoExportFiles(input).map((f) => f.path);
        expect(paths).toContain("sets/de-b2/lessons/01-kapitel-2.json");
        expect(paths).toContain("sets/de-b2/lessons/02-kapitel-10.json");
    });
});

// #3403 - an exported repo has the layout every reader loads: a root
// manifest listing the set with its path, a set manifest that names the
// lessons, and the lessons under that path. Both manifests pass the
// engine's validateManifest.
describe("exported repo layout (#3403)", () => {
    const files = buildRepoExportFiles(INPUT);
    const byPath = new Map(files.map((f) => [f.path, f.content]));

    it.each([
        ["root", "manifest.yaml"],
        ["set", "sets/de-b2/manifest.yaml"],
    ])("writes a %s manifest the engine accepts", (_kind, path) => {
        const verdict = validateManifest(parseYaml(byPath.get(path) ?? ""));
        expect(verdict.errors.map((e) => `${e.id} ${e.message}`)).toEqual([]);
    });

    it("lists the set with its path in the root manifest", () => {
        const root = parseYaml(byPath.get("manifest.yaml") ?? "");
        expect(root.sets.map((s: {id: string; path: string}) => [s.id, s.path])).toEqual([
            ["de-b2", "sets/de-b2"],
        ]);
    });

    it("refuses to export a manifest the engine rejects, with its reasons", () => {
        const badLanguage = {...SET, target_language: "not a language"} as ContentSetEntry;
        expect(() => buildRepoExportFiles({...INPUT, set: badLanguage})).toThrow(
            /manifest\.yaml is not a valid content manifest: .*target_language/,
        );
    });

    it("names the lessons in the set manifest and stores them under the set path", () => {
        const setManifest = parseYaml(byPath.get("sets/de-b2/manifest.yaml") ?? "");
        expect(setManifest.metadata.lessons).toEqual([
            "01-grundkonzepte.json",
            "02-aufbau.json",
        ]);
        expect([...byPath.keys()].filter((p) => p.endsWith(".json") && p.includes("lessons/"))).toEqual([
            "sets/de-b2/lessons/01-grundkonzepte.json",
            "sets/de-b2/lessons/02-aufbau.json",
        ]);
    });
});

describe("buildRepoExportFiles", () => {
    it("emits manifest + one file per lesson + index + README", () => {
        const files = buildRepoExportFiles(INPUT);
        const paths = files.map((f) => f.path);
        expect(paths).toEqual([
            "manifest.yaml",
            "sets/de-b2/manifest.yaml",
            "sets/de-b2/lessons/01-grundkonzepte.json",
            "sets/de-b2/lessons/02-aufbau.json",
            "search-index.json",
            "README.md",
        ]);
        // Each lesson file is valid JSON of the lesson.
        const l1 = JSON.parse(files[2].content);
        expect(l1.title).toBe("Grundkonzepte");
    });
});

/**
 * App export vs the canonical search-index schema (#2306 point 2).
 *
 * The format has a written definition (``schema/search-index.schema.json``
 * in the official content repo) and, before this test, NONE of the three
 * writers validated against it - the app export least of all (#2300 was
 * exactly that gap surfacing at registration time, the latest possible
 * point). This test validates ``buildSearchIndexJson``'s output against a
 * byte mirror of that schema, so an export drift fails HERE, not at a
 * third party's registration gate.
 *
 * ``__fixtures__/search-index-schema-official.json`` mirrors the official
 * repo's schema verbatim (same convention as ``search-index-official.json``):
 * when upstream changes the schema, re-mirror the fixture in the same
 * change - a re-mirror that breaks the export fails loudly here.
 */

import {describe, expect, it} from "vitest";
import Ajv2020 from "ajv/dist/2020";

import officialIndex from "./__fixtures__/search-index-official.json";
import officialSchema from "./__fixtures__/search-index-schema-official.json";

import {buildSearchIndexJson, type RepoExportInput} from "./repo-export";
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
    lesson_count: 1,
    description: "A teacher's B2 course",
    tags: ["grammar"],
    cover_image: null,
    cached_version: null,
    update_available: false,
} as unknown as ContentSetEntry;

const INPUT: RepoExportInput = {
    set: SET,
    ownerRepo: "teacher/de-b2",
    lessons: [
        {
            filename: "01-grundkonzepte.json",
            lesson: {
                id: "Grundkonzepte",
                title: "Grundkonzepte",
                estimated_minutes: 5,
                cards: [{id: "c0"}],
                steps: [],
            } as unknown as ContentLesson,
        },
    ],
};

const ajv = new Ajv2020({allErrors: true, strict: false});
const validate = ajv.compile(officialSchema);

describe("buildSearchIndexJson vs the canonical schema (#2306)", () => {
    it("the exported index validates against the official schema mirror", () => {
        const exported = JSON.parse(buildSearchIndexJson(INPUT));
        const valid = validate(exported);
        expect(
            valid,
            JSON.stringify(validate.errors, null, 2),
        ).toBe(true);
    });

    it("the validator actually bites: a missing required root field fails", () => {
        const exported = JSON.parse(buildSearchIndexJson(INPUT));
        delete exported.repo;
        expect(validate(exported)).toBe(false);
    });

    it("the validator bites on set-entry fields too: a missing domain fails", () => {
        const exported = JSON.parse(buildSearchIndexJson(INPUT));
        delete exported.sets[0].domain;
        expect(validate(exported)).toBe(false);
    });

    it("the mirrored OFFICIAL index validates against the mirrored schema (coherence pin)", () => {
        const valid = validate(officialIndex);
        expect(
            valid,
            JSON.stringify(validate.errors, null, 2),
        ).toBe(true);
    });
});

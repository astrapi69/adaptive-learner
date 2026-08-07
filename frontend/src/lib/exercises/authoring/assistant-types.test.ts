import { afterEach, describe, expect, it } from "vitest";

import {
    ASSISTANT_STANDARD_TYPES,
    ASSISTANT_TYPES_STORAGE_KEY,
    ASSISTANT_UNAVAILABLE_TYPES,
    DEFAULT_ASSISTANT_TYPES,
    loadAssistantTypes,
    sanitizeAssistantTypes,
    saveAssistantTypes,
} from "./assistant-types";

afterEach(() => {
    globalThis.localStorage?.clear();
});

describe("assistant-types — model (#2510)", () => {
    it("defaults to the standard types only", () => {
        expect(DEFAULT_ASSISTANT_TYPES).toEqual([...ASSISTANT_STANDARD_TYPES]);
    });

    it("never lists an asset-bound type as selectable", () => {
        for (const t of ASSISTANT_UNAVAILABLE_TYPES) {
            expect(DEFAULT_ASSISTANT_TYPES).not.toContain(t);
            expect(sanitizeAssistantTypes([t])).toEqual([...DEFAULT_ASSISTANT_TYPES]);
        }
    });
});

describe("sanitizeAssistantTypes — min-one floor", () => {
    it("drops unknown / asset-bound types", () => {
        expect(sanitizeAssistantTypes(["cloze", "picture_choice", "bogus"])).toEqual([
            "cloze",
        ]);
    });

    it("falls back to the defaults when the result would be empty", () => {
        expect(sanitizeAssistantTypes([])).toEqual([...DEFAULT_ASSISTANT_TYPES]);
        expect(sanitizeAssistantTypes(["ext:al-dictation"])).toEqual([
            ...DEFAULT_ASSISTANT_TYPES,
        ]);
    });

    it("returns types in the canonical order, de-duplicated", () => {
        expect(
            sanitizeAssistantTypes([
                "ext:al-categorization",
                "cloze",
                "cloze",
                "matching",
            ]),
        ).toEqual(["matching", "cloze", "ext:al-categorization"]);
    });
});

describe("load/saveAssistantTypes — persistence", () => {
    it("returns the defaults when nothing is stored", () => {
        expect(loadAssistantTypes()).toEqual([...DEFAULT_ASSISTANT_TYPES]);
    });

    it("round-trips a saved selection", () => {
        saveAssistantTypes(["cloze", "ext:al-categorization"]);
        expect(loadAssistantTypes()).toEqual(["cloze", "ext:al-categorization"]);
    });

    it("never persists an empty selection (min-one)", () => {
        saveAssistantTypes([]);
        expect(loadAssistantTypes()).toEqual([...DEFAULT_ASSISTANT_TYPES]);
    });

    it("degrades to the defaults on a corrupt stored value", () => {
        globalThis.localStorage?.setItem(ASSISTANT_TYPES_STORAGE_KEY, "{not json");
        expect(loadAssistantTypes()).toEqual([...DEFAULT_ASSISTANT_TYPES]);
    });

    it("filters a stored value that carries a since-removed type", () => {
        globalThis.localStorage?.setItem(
            ASSISTANT_TYPES_STORAGE_KEY,
            JSON.stringify(["cloze", "ext:al-image-description"]),
        );
        expect(loadAssistantTypes()).toEqual(["cloze"]);
    });
});

/**
 * Tests that the content search indexes user-generated sets so folded
 * lessons stay findable (EXP-026 / UGC-05, #97).
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useContentSearch} from "./useContentSearch";
import type {ContentSetEntry} from "../storage/types";

const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();

vi.mock("../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
        },
    }),
}));

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
    return {
        source: "user-generated",
        branch: "main",
        id: "mine",
        title: "Mein Set",
        title_native: null,
        language: "es",
        target_language: "es",
        source_language: "de",
        level: "A1",
        domain: "analysis",
        version: "1.0.0",
        lesson_count: 1,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
        ...over,
    };
}

describe("useContentSearch (user-generated indexing)", () => {
    beforeEach(() => {
        listLessonsMock.mockReset();
        getLessonMock.mockReset();
    });

    it("finds a lesson inside a user-generated set", async () => {
        listLessonsMock.mockResolvedValue({lessons: ["l1.json"]});
        getLessonMock.mockResolvedValue({
            id: "l1",
            title: "Subjuntivo Übung",
            cards: [],
        });

        const {result} = renderHook(() => useContentSearch([entry({})]));
        act(() => result.current.activateSearch());

        await waitFor(() => expect(listLessonsMock).toHaveBeenCalled());
        act(() => result.current.setSearchQuery("Subjuntivo"));

        await waitFor(() =>
            expect(result.current.searchResult.matches.length).toBeGreaterThan(0),
        );
        const hit = result.current.searchResult.matches[0];
        expect(hit.source).toBe("user-generated");
        expect(hit.matchedLessons.some((l) => l.title === "Subjuntivo Übung")).toBe(true);
    });
});

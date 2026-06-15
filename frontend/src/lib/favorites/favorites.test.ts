/**
 * favorites store unit tests (#596).
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    addFavorite,
    favoriteId,
    isFavorite,
    listFavorites,
    removeFavorite,
    toggleFavorite,
} from "./favorites";

const U = "user-1";
const base = {
    source: "bundled",
    setId: "es-a1",
    filename: "01.json",
    title: "Greetings",
    setTitle: "Spanish A1",
};

beforeEach(() => localStorage.clear());

describe("favorites store", () => {
    it("is empty by default and per-user", () => {
        expect(listFavorites(U)).toEqual([]);
        expect(isFavorite(U, "es-a1", "01.json")).toBe(false);
    });

    it("adds (idempotent) and reports favorite state", () => {
        addFavorite(U, base, new Date("2026-01-01T00:00:00Z"));
        addFavorite(U, base, new Date("2026-01-02T00:00:00Z"));
        expect(listFavorites(U)).toHaveLength(1);
        expect(isFavorite(U, "es-a1", "01.json")).toBe(true);
        // not visible to a different user
        expect(isFavorite("user-2", "es-a1", "01.json")).toBe(false);
    });

    it("lists newest-added first", () => {
        addFavorite(U, base, new Date("2026-01-01T00:00:00Z"));
        addFavorite(
            U,
            {...base, filename: "02.json", title: "Numbers"},
            new Date("2026-01-05T00:00:00Z"),
        );
        expect(listFavorites(U).map((f) => f.filename)).toEqual([
            "02.json",
            "01.json",
        ]);
    });

    it("toggles on/off and removes", () => {
        expect(toggleFavorite(U, base)).toBe(true);
        expect(isFavorite(U, "es-a1", "01.json")).toBe(true);
        expect(toggleFavorite(U, base)).toBe(false);
        expect(isFavorite(U, "es-a1", "01.json")).toBe(false);
        addFavorite(U, base);
        removeFavorite(U, "es-a1", "01.json");
        expect(listFavorites(U)).toEqual([]);
    });

    it("favoriteId is stable per set+filename", () => {
        expect(favoriteId("es-a1", "01.json")).toBe("es-a1::01.json");
    });
});

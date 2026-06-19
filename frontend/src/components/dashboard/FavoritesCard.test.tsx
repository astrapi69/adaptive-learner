/**
 * Tests for the Dashboard FavoritesCard widget (#596, #625).
 *
 * Pins:
 * - empty list → empty-state text, no "+N more"
 * - <= 5 favorites → all shown, no "+N more"
 * - > 5 favorites → only 5 rendered + a "+N more" line (#625 Top-5 cap)
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

import type {FavoriteEntry} from "../../lib/favorites/favorites";

const favoritesMock = vi.fn();

vi.mock("../../hooks/learning/useFavorites", () => ({
    useFavorites: () => ({
        favorites: favoritesMock(),
        isFavorite: () => false,
        toggle: () => false,
        remove: vi.fn(),
    }),
}));

import FavoritesCard from "./FavoritesCard";

function fav(n: number): FavoriteEntry {
    return {
        source: "bundled",
        setId: "language-fr-a1",
        filename: `0${n}-lesson.json`,
        title: `Lesson ${n}`,
        setTitle: "French A1",
        addedAt: `2026-06-1${n}T00:00:00Z`,
    };
}

function renderCard() {
    return render(
        <MemoryRouter>
            <FavoritesCard userId="user-1" />
        </MemoryRouter>,
    );
}

beforeEach(() => favoritesMock.mockReset());

describe("FavoritesCard: Top-5 cap (#625)", () => {
    it("shows the empty state and no overflow line when there are none", () => {
        favoritesMock.mockReturnValue([]);
        renderCard();
        expect(
            screen.queryByTestId("favorites-card-more"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("favorites-list")).toBeInTheDocument();
    });

    it("renders all favorites and no overflow line at 5 or fewer", () => {
        favoritesMock.mockReturnValue([fav(1), fav(2), fav(3)]);
        renderCard();
        expect(screen.getAllByTestId(/^favorite-open-/)).toHaveLength(3);
        expect(
            screen.queryByTestId("favorites-card-more"),
        ).not.toBeInTheDocument();
    });

    it("caps to 5 and shows '+N more' when there are more", () => {
        favoritesMock.mockReturnValue(
            Array.from({length: 8}, (_, i) => fav(i + 1)),
        );
        renderCard();
        expect(screen.getAllByTestId(/^favorite-open-/)).toHaveLength(5);
        expect(screen.getByTestId("favorites-card-more")).toHaveTextContent(
            "+3 more",
        );
    });
});

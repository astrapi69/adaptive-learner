/**
 * FavoriteToggle tests (#596).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import FavoriteToggle from "./FavoriteToggle";

describe("FavoriteToggle", () => {
    it("reflects state via aria-pressed + label and fires onToggle", () => {
        const onToggle = vi.fn();
        const {rerender} = render(
            <FavoriteToggle
                isFavorite={false}
                onToggle={onToggle}
                addLabel="Add to favorites"
                removeLabel="Remove from favorites"
                testId="fav"
            />,
        );
        const btn = screen.getByTestId("fav");
        expect(btn).toHaveAttribute("aria-pressed", "false");
        expect(btn).toHaveAttribute("aria-label", "Add to favorites");
        fireEvent.click(btn);
        expect(onToggle).toHaveBeenCalledOnce();

        rerender(
            <FavoriteToggle
                isFavorite
                onToggle={onToggle}
                addLabel="Add to favorites"
                removeLabel="Remove from favorites"
                testId="fav"
            />,
        );
        expect(screen.getByTestId("fav")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.getByTestId("fav")).toHaveAttribute(
            "aria-label",
            "Remove from favorites",
        );
    });
});

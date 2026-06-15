/**
 * FavoritesList tests (#596).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import FavoritesList from "./FavoritesList";

describe("FavoritesList", () => {
    it("shows the empty label with no items", () => {
        render(
            <FavoritesList
                items={[]}
                onOpen={() => {}}
                onRemove={() => {}}
                removeLabel="Remove"
                emptyLabel="Nothing saved."
                testId="fl"
            />,
        );
        expect(screen.getByTestId("fl").textContent).toBe("Nothing saved.");
    });

    it("opens and removes by id", () => {
        const onOpen = vi.fn();
        const onRemove = vi.fn();
        render(
            <FavoritesList
                items={[{id: "es::01", title: "Greetings", subtitle: "Spanish A1"}]}
                onOpen={onOpen}
                onRemove={onRemove}
                removeLabel="Remove"
                emptyLabel="empty"
            />,
        );
        expect(screen.getByTestId("favorite-es::01")).toHaveTextContent(
            "Spanish A1",
        );
        fireEvent.click(screen.getByTestId("favorite-open-es::01"));
        expect(onOpen).toHaveBeenCalledWith("es::01");
        fireEvent.click(screen.getByTestId("favorite-remove-es::01"));
        expect(onRemove).toHaveBeenCalledWith("es::01");
    });
});

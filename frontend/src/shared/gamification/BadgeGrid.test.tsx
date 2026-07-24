import {describe, it, expect, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";

import BadgeGrid, {type BadgeGridItem} from "./BadgeGrid";

const ITEMS: BadgeGridItem[] = [
    {id: "a", label: "First steps", icon: <i />, earned: true, highlight: true},
    {id: "b", label: "Level 10", icon: <i />, earned: false, hint: "Reach level 10"},
];

describe("BadgeGrid", () => {
    it("renders the empty state", () => {
        cleanup();
        render(<BadgeGrid items={[]} emptyLabel="None" />);
        expect(screen.getByTestId("badge-grid-empty")).toHaveTextContent("None");
    });

    it("marks earned, locked and highlighted items", () => {
        cleanup();
        render(<BadgeGrid items={ITEMS} />);
        const a = screen
            .getByTestId("badge-grid-item-a")
            .querySelector("[data-earned]")!;
        const b = screen
            .getByTestId("badge-grid-item-b")
            .querySelector("[data-earned]")!;
        expect(a).toHaveAttribute("data-earned", "true");
        expect(a).toHaveAttribute("data-highlight", "true");
        expect(b).toHaveAttribute("data-earned", "false");
    });

    it("exposes a locked badge's hint in the tooltip", () => {
        cleanup();
        render(<BadgeGrid items={ITEMS} />);
        expect(
            screen
                .getByTestId("badge-grid-item-b")
                .querySelector("[data-earned]"),
        ).toHaveAttribute("title", "Level 10 - Reach level 10");
    });

    it("renders non-interactive cells without onSelect", () => {
        cleanup();
        render(<BadgeGrid items={ITEMS} />);
        expect(
            screen.getByTestId("badge-grid-item-a").querySelector("button"),
        ).toBeNull();
    });

    it("calls onSelect when an interactive cell is clicked", () => {
        cleanup();
        const onSelect = vi.fn();
        render(<BadgeGrid items={ITEMS} onSelect={onSelect} />);
        fireEvent.click(
            screen.getByTestId("badge-grid-item-b").querySelector("button")!,
        );
        expect(onSelect).toHaveBeenCalledWith("b");
    });
});

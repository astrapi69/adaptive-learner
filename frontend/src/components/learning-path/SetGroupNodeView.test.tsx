/**
 * Tests for SetGroupNodeView (Phase 66C) — header, progress bar,
 * mastery summary, and collapse/expand behaviour.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {SetGroupNodeView, type SetGroupNodeData} from "./SetGroupNodeView";

function data(overrides: Partial<SetGroupNodeData> = {}): SetGroupNodeData {
    return {
        setId: "fr-a1",
        title: "Français A1",
        sourceLanguage: "de",
        targetLanguage: "fr",
        completed: 6,
        total: 15,
        receptiveMastered: 8,
        productiveMastered: 3,
        collapsed: false,
        ...overrides,
    };
}

describe("SetGroupNodeView", () => {
    it("renders title, language pair and progress", () => {
        render(<SetGroupNodeView data={data()} />);
        expect(screen.getByTestId("set-group-fr-a1")).toBeInTheDocument();
        expect(screen.getByText("Français A1")).toBeInTheDocument();
        expect(screen.getByText("de → fr")).toBeInTheDocument();
        const bar = screen.getByTestId("set-group-progress-fr-a1");
        expect(bar).toHaveAttribute("aria-valuenow", "40"); // 6/15
        expect(bar.textContent).toContain("6/15");
    });

    it("shows mastery when expanded, hides it when collapsed", () => {
        const {rerender} = render(<SetGroupNodeView data={data()} />);
        expect(
            screen.getByTestId("set-group-mastery-fr-a1"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("set-group-mastery-fr-a1").textContent,
        ).toContain("8");
        rerender(<SetGroupNodeView data={data({collapsed: true})} />);
        expect(
            screen.queryByTestId("set-group-mastery-fr-a1"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("set-group-fr-a1")).toHaveAttribute(
            "data-collapsed",
            "true",
        );
    });

    it("calls onToggle when the header is clicked", () => {
        const onToggle = vi.fn();
        render(<SetGroupNodeView data={data()} onToggle={onToggle} />);
        fireEvent.click(screen.getByTestId("set-group-toggle-fr-a1"));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("handles an empty set (0 total) without dividing by zero", () => {
        render(<SetGroupNodeView data={data({completed: 0, total: 0})} />);
        expect(
            screen.getByTestId("set-group-progress-fr-a1"),
        ).toHaveAttribute("aria-valuenow", "0");
    });
});

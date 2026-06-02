/**
 * Tests for LessonNodeView (Phase 66B) — pins every status state,
 * the recommended + locked variants, stars, mastery pills, and the
 * activate callback.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {
    LessonNodeView,
    type LessonNodeData,
    type LessonNodeStatus,
} from "./LessonNodeView";

function data(overrides: Partial<LessonNodeData> = {}): LessonNodeData {
    return {
        lessonNumber: 3,
        title: "Les articles",
        stars: 0,
        status: "not_started",
        receptiveMastered: false,
        productiveMastered: false,
        xp: 0,
        exerciseCount: 12,
        recommended: false,
        locked: false,
        setSlug: "fr",
        setId: "fr-a1",
        lessonFilename: "03.json",
        ...overrides,
    };
}

const testid = "lesson-node-fr-a1-03.json";

describe("LessonNodeView", () => {
    it.each<LessonNodeStatus>([
        "not_started",
        "in_progress",
        "paused",
        "completed",
        "mastered",
    ])("renders the %s status", (status) => {
        render(<LessonNodeView data={data({status})} />);
        const node = screen.getByTestId(testid);
        expect(node).toHaveAttribute("data-status", status);
        expect(node.className).toContain(
            `lesson-node--${status.replace(/_/g, "-")}`,
        );
    });

    it("shows mastery pills + XP when mastered", () => {
        render(
            <LessonNodeView
                data={data({
                    status: "mastered",
                    stars: 3,
                    receptiveMastered: true,
                    productiveMastered: true,
                    xp: 80,
                })}
            />,
        );
        expect(screen.getByTestId("lesson-node-receptive")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-node-productive")).toBeInTheDocument();
        expect(screen.getByText("80 XP")).toBeInTheDocument();
    });

    it("marks the recommended node", () => {
        render(<LessonNodeView data={data({recommended: true})} />);
        expect(screen.getByTestId(testid)).toHaveAttribute(
            "data-recommended",
            "true",
        );
        expect(
            screen.getByTestId("lesson-node-recommended"),
        ).toBeInTheDocument();
    });

    it("locks a node: disabled, lock icon, no activation", () => {
        const onActivate = vi.fn();
        render(
            <LessonNodeView
                data={data({locked: true, lockReason: "Finish lesson 2 first"})}
                onActivate={onActivate}
            />,
        );
        const node = screen.getByTestId(testid);
        expect(node).toBeDisabled();
        expect(screen.getByTestId("lesson-node-lock")).toBeInTheDocument();
        fireEvent.click(node);
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("activates on click when not locked", () => {
        const onActivate = vi.fn();
        render(<LessonNodeView data={data()} onActivate={onActivate} />);
        fireEvent.click(screen.getByTestId(testid));
        expect(onActivate).toHaveBeenCalledTimes(1);
    });
});

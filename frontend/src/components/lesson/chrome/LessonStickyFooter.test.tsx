/**
 * LessonStickyFooter — Tailwind proof-of-concept regression pin (Phase A).
 *
 * happy-dom does not apply Tailwind's compiled CSS, so these tests assert
 * the component EMITS the expected utility classes (the build, verified in
 * commit C6, is what turns them into rules referencing our theme vars) and
 * that the behaviour contract holds. Together they prove the Phase A setup:
 * the ``@/lib/utils`` alias resolves (the component imports ``cn`` from it),
 * theme-bound utilities are present, and the action fires / gates on
 * ``disabled``.
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import LessonStickyFooter from "./LessonStickyFooter";

describe("LessonStickyFooter", () => {
    it("renders the label and a sticky, theme-bound action button", () => {
        const onClick = vi.fn();
        render(<LessonStickyFooter label="Next" onClick={onClick} />);

        const container = screen.getByTestId("lesson-sticky-footer");
        const button = screen.getByTestId("lesson-sticky-footer-action");

        // Sticky-footer container: pinned to the bottom with a gradient
        // fade that uses our --bg-primary token (theme integration).
        expect(container.className).toContain("sticky");
        expect(container.className).toContain("bottom-0");
        expect(container.className).toContain("from-bg-primary");

        // The button text + theme-bound color utilities (these resolve to
        // var(--accent) / var(--accent-fg) / var(--radius-md) at build time).
        expect(button).toHaveTextContent("Next");
        expect(button.className).toContain("bg-accent");
        expect(button.className).toContain("text-accent-fg");
        expect(button.className).toContain("hover:bg-accent-hover");
        expect(button.className).toContain("rounded-app");
    });

    it("fires onClick when enabled", () => {
        const onClick = vi.fn();
        render(<LessonStickyFooter label="Finish" onClick={onClick} />);

        fireEvent.click(screen.getByTestId("lesson-sticky-footer-action"));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not fire onClick when disabled", () => {
        const onClick = vi.fn();
        render(
            <LessonStickyFooter label="Next" onClick={onClick} disabled />,
        );

        const button = screen.getByTestId("lesson-sticky-footer-action");
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    it("merges a custom testId and extra container classes", () => {
        const onClick = vi.fn();
        render(
            <LessonStickyFooter
                label="Go"
                onClick={onClick}
                testId="poc-footer"
                className="mt-8"
            />,
        );

        const container = screen.getByTestId("poc-footer");
        expect(container.className).toContain("mt-8");
        // cn() keeps the base classes alongside the merged extra one.
        expect(container.className).toContain("sticky");
        expect(screen.getByTestId("poc-footer-action")).toBeInTheDocument();
    });
});

import {describe, it, expect} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

import ProgressRing from "./ProgressRing";

describe("ProgressRing", () => {
    it("exposes progressbar semantics", () => {
        cleanup();
        render(<ProgressRing value={3} max={5} ariaLabel="Level progress" />);
        const ring = screen.getByTestId("progress-ring");
        expect(ring).toHaveAttribute("role", "progressbar");
        expect(ring).toHaveAttribute("aria-valuenow", "3");
        expect(ring).toHaveAttribute("aria-valuemin", "0");
        expect(ring).toHaveAttribute("aria-valuemax", "5");
        expect(ring).toHaveAttribute("aria-label", "Level progress");
    });

    it("clamps value into [0, max]", () => {
        cleanup();
        render(<ProgressRing value={99} max={5} />);
        expect(screen.getByTestId("progress-ring")).toHaveAttribute(
            "aria-valuenow",
            "5",
        );
    });

    it("treats a non-positive max as an empty ring", () => {
        cleanup();
        render(<ProgressRing value={4} max={0} />);
        const ring = screen.getByTestId("progress-ring");
        expect(ring).toHaveAttribute("aria-valuenow", "0");
        expect(ring).toHaveAttribute("aria-valuemax", "0");
    });

    it("renders center content", () => {
        cleanup();
        render(
            <ProgressRing value={1} max={2}>
                <strong>L7</strong>
            </ProgressRing>,
        );
        expect(screen.getByText("L7")).toBeInTheDocument();
    });
});

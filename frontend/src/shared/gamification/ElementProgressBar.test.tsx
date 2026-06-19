/**
 * ElementProgressBar tests (#588).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ElementProgressBar from "./ElementProgressBar";

describe("ElementProgressBar", () => {
    it("shows the X/Y count and a bar at the right percent", () => {
        render(
            <ElementProgressBar
                mastered={3}
                total={8}
                ariaLabel="3 of 8 mastered"
                testId="ep"
            />,
        );
        expect(screen.getByTestId("ep")).toHaveTextContent("3/8");
        const bar = screen.getByRole("progressbar", {name: "3 of 8 mastered"});
        expect(bar).toHaveAttribute("aria-valuenow", "38");
    });

    it("renders 0% safely when total is 0", () => {
        render(
            <ElementProgressBar
                mastered={0}
                total={0}
                ariaLabel="none"
                testId="ep0"
            />,
        );
        expect(
            screen.getByRole("progressbar", {name: "none"}),
        ).toHaveAttribute("aria-valuenow", "0");
    });
});

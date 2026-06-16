/**
 * ProgressByPair render tests (#582).
 *
 * Pins: empty state, one block per pair, per-level bars with the
 * supplied percent + accessible name.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ProgressByPair from "./ProgressByPair";

describe("ProgressByPair", () => {
    it("shows the empty label with no pairs", () => {
        render(
            <ProgressByPair pairs={[]} emptyLabel="Download a set." testId="pbp" />,
        );
        expect(screen.getByTestId("pbp").textContent).toBe("Download a set.");
    });

    it("renders a block per pair with level bars", () => {
        render(
            <ProgressByPair
                pairs={[
                    {
                        name: "German → Spanish",
                        percent: 75,
                        levels: [
                            {level: "A1", percent: 100, barLabel: "A1: 100% complete"},
                            {level: "A2", percent: 50, barLabel: "A2: 50% complete"},
                        ],
                    },
                ]}
                emptyLabel="empty"
            />,
        );
        expect(
            screen.getByTestId("pair-German → Spanish"),
        ).toHaveTextContent("German → Spanish");
        const a1 = screen.getByTestId(
            "pair-German → Spanish-level-A1",
        );
        expect(a1).toHaveAttribute("aria-valuenow", "100");
        expect(a1).toHaveAttribute("aria-label", "A1: 100% complete");
    });
});

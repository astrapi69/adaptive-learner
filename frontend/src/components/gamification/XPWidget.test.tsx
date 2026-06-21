/**
 * XPWidget render tests (Phase 29A).
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import XPWidget from "./XPWidget";

describe("XPWidget", () => {
    it("renders the empty state when state is null", () => {
        render(<XPWidget state={null} />);
        expect(screen.getByTestId("xp-widget-empty")).toBeTruthy();
    });

    it("renders the empty state when total_xp is 0", () => {
        render(
            <XPWidget
                state={{
                    user_id: "u",
                    total_xp: 0,
                    level: 1,
                    xp_into_level: 0,
                    xp_to_next_level: 100,
                    next_level_threshold: 100,
                }}
            />,
        );
        expect(screen.getByTestId("xp-widget-empty")).toBeTruthy();
    });

    it("renders level + total + bar fill at the right percentage", () => {
        render(
            <XPWidget
                state={{
                    user_id: "u",
                    total_xp: 200,
                    level: 2,
                    xp_into_level: 100,
                    xp_to_next_level: 100,
                    next_level_threshold: 300,
                }}
            />,
        );
        const level = screen.getByTestId("xp-widget-level");
        expect(level.textContent).toContain("2");
        const total = screen.getByTestId("xp-widget-total");
        expect(total.textContent).toContain("200");
        const bar = screen.getByTestId("xp-widget-bar");
        expect(bar.getAttribute("aria-valuenow")).toBe("50");
    });
});

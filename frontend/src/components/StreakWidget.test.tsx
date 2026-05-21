/**
 * StreakWidget render tests (Phase 29C).
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import StreakWidget from "./StreakWidget";

describe("StreakWidget", () => {
    it("renders nothing when state is null", () => {
        const {container} = render(<StreakWidget state={null} />);
        expect(container.querySelector('[data-testid="streak-widget"]')).toBeNull();
    });

    it("renders current/longest/freeze values", () => {
        render(
            <StreakWidget
                state={{
                    user_id: "u",
                    current_streak_days: 5,
                    longest_streak_days: 12,
                    freezes_available: 2,
                    weekend_mode: false,
                    last_freeze_earned_on: null,
                    last_freeze_used_on: null,
                }}
            />,
        );
        expect(screen.getByTestId("streak-widget-current").textContent).toBe("5");
        expect(screen.getByTestId("streak-widget-longest").textContent).toBe("12");
        expect(screen.getByTestId("streak-widget-freezes").textContent).toBe("2");
    });
});

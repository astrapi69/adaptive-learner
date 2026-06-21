/**
 * XPNotification render tests (Phase 29A).
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import XPNotification from "./XPNotification";

describe("XPNotification", () => {
    it("renders nothing when award is null", () => {
        const {container} = render(<XPNotification award={null} />);
        expect(container.querySelector('[data-testid="xp-notification"]')).toBeNull();
    });

    it("renders the +N XP amount", () => {
        render(
            <XPNotification
                award={{
                    xp_earned: 50,
                    xp_total: 50,
                    level: 1,
                    level_up: false,
                    multiplier: 1.0,
                    breakdown: {base: 50},
                    reason: "session_complete",
                }}
                durationMs={10_000}
            />,
        );
        const amount = screen.getByTestId("xp-notification-amount");
        expect(amount.textContent).toContain("+50");
    });

    it("renders the level-up bubble when award.level_up is true", () => {
        render(
            <XPNotification
                award={{
                    xp_earned: 100,
                    xp_total: 100,
                    level: 2,
                    level_up: true,
                    multiplier: 1.0,
                    breakdown: {flat: 100},
                    reason: "test",
                }}
                durationMs={10_000}
            />,
        );
        expect(screen.getByTestId("xp-notification-level-up")).toBeTruthy();
    });
});

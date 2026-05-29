/**
 * Tests for Confetti (EXP-008 / Phase 55C).
 *
 * Pins:
 *  - renders the configured number of CSS particles normally,
 *  - renders nothing + calls onDone immediately under
 *    prefers-reduced-motion.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import Confetti from "./Confetti";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Confetti", () => {
    it("renders 30 particles when motion is allowed", () => {
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        );
        render(<Confetti />);
        const burst = screen.getByTestId("confetti");
        expect(burst).toHaveAttribute("data-particle-count", "30");
        expect(burst.querySelectorAll(".confetti-piece")).toHaveLength(30);
    });

    it("renders nothing and calls onDone under reduced motion", () => {
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        );
        const onDone = vi.fn();
        render(<Confetti onDone={onDone} />);
        expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
        expect(onDone).toHaveBeenCalled();
    });
});

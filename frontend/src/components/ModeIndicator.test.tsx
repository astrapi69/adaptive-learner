/**
 * Tests for ModeIndicator (EXP-010 / Phase 56L). Visual-only.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ModeIndicator from "./ModeIndicator";

describe("ModeIndicator", () => {
    it("shows Solo as the active mode", () => {
        render(<ModeIndicator />);
        const solo = screen.getByTestId("mode-card-solo");
        expect(solo).toHaveClass("is-active");
        expect(solo).toHaveAttribute("aria-current", "true");
    });

    it("shows Multiplayer as a disabled coming-soon card", () => {
        render(<ModeIndicator />);
        const mp = screen.getByTestId("mode-card-multiplayer");
        expect(mp).toHaveClass("is-disabled");
        expect(mp).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByTestId("mode-coming-soon")).toBeInTheDocument();
        // It is purely visual - not a button, no click target.
        expect(mp.tagName).not.toBe("BUTTON");
    });
});

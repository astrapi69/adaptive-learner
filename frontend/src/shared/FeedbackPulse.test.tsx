import {describe, it, expect, vi, beforeEach} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

import FeedbackPulse from "./FeedbackPulse";

beforeEach(() => {
    cleanup();
    vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({matches: false, addEventListener() {}, removeEventListener() {}})),
    );
});

describe("FeedbackPulse", () => {
    it("renders children with the variant marker", () => {
        render(
            <FeedbackPulse variant="success">
                <i data-testid="icon" />
            </FeedbackPulse>,
        );
        const pulse = screen.getByTestId("feedback-pulse");
        expect(pulse).toHaveAttribute("data-variant", "success");
        expect(screen.getByTestId("icon")).toBeInTheDocument();
    });

    it("plays an animation on mount when motion is allowed", () => {
        const animate = vi.fn(() => ({cancel: vi.fn()}));
        // happy-dom may lack Element.animate; attach a spy.
        (HTMLElement.prototype as any).animate = animate;
        render(<FeedbackPulse variant="error" />);
        expect(animate).toHaveBeenCalledTimes(1);
        delete (HTMLElement.prototype as any).animate;
    });

    it("does not animate under reduced motion", () => {
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({matches: true, addEventListener() {}, removeEventListener() {}})),
        );
        const animate = vi.fn(() => ({cancel: vi.fn()}));
        (HTMLElement.prototype as any).animate = animate;
        render(<FeedbackPulse variant="success" />);
        expect(animate).not.toHaveBeenCalled();
        delete (HTMLElement.prototype as any).animate;
    });
});

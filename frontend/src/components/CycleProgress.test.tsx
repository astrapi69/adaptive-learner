import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import CycleProgress from "./CycleProgress";

describe("CycleProgress", () => {
    it("renders seven steps in canonical order", () => {
        render(<CycleProgress currentStep={1} />);
        const KEYS = [
            "input",
            "attempt",
            "error",
            "feedback",
            "adapt",
            "repeat",
            "integrate",
        ];
        for (const key of KEYS) {
            expect(screen.getByTestId(`cycle-step-${key}`)).toBeInTheDocument();
        }
    });

    it("marks the current step with data-state='current' and aria-current", () => {
        render(<CycleProgress currentStep={4} />);
        const feedback = screen.getByTestId("cycle-step-feedback");
        expect(feedback.getAttribute("data-state")).toBe("current");
        expect(feedback.getAttribute("aria-current")).toBe("step");
    });

    it("marks earlier steps complete and later steps pending", () => {
        render(<CycleProgress currentStep={3} />);
        expect(screen.getByTestId("cycle-step-input").getAttribute("data-state")).toBe(
            "complete",
        );
        expect(screen.getByTestId("cycle-step-attempt").getAttribute("data-state")).toBe(
            "complete",
        );
        expect(screen.getByTestId("cycle-step-error").getAttribute("data-state")).toBe(
            "current",
        );
        expect(screen.getByTestId("cycle-step-feedback").getAttribute("data-state")).toBe(
            "pending",
        );
    });

    it("clamps out-of-range step values", () => {
        const {rerender} = render(<CycleProgress currentStep={0} />);
        // Clamp: 0 -> 1 (first step is current).
        expect(screen.getByTestId("cycle-step-input").getAttribute("data-state")).toBe(
            "current",
        );
        rerender(<CycleProgress currentStep={99} />);
        expect(screen.getByTestId("cycle-step-integrate").getAttribute("data-state")).toBe(
            "current",
        );
    });

    it("caption includes the localized step label", () => {
        render(<CycleProgress currentStep={5} />);
        const caption = screen.getByTestId("cycle-caption");
        // Label of step 5 (``adapt``) — i18n fallback may be DE,
        // EN, or the raw key depending on what the backend served;
        // any of them is acceptable here.
        expect(caption.textContent).toMatch(/adapt|Anpassung|Adapt/);
    });
});

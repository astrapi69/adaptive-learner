import {act, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

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

    // --- v0.5.0: evaluation reason tooltip ---------------------------------

    it("does NOT render evaluation reason when prop is null", () => {
        render(<CycleProgress currentStep={3} evaluationReason={null} />);
        expect(
            screen.queryByTestId("cycle-evaluation-reason"),
        ).not.toBeInTheDocument();
    });

    it("renders evaluation reason when prop is provided", () => {
        render(
            <CycleProgress
                currentStep={3}
                evaluationReason="Learner produced a concrete example."
            />,
        );
        const reason = screen.getByTestId("cycle-evaluation-reason");
        expect(reason).toBeInTheDocument();
        expect(reason.textContent).toContain(
            "Learner produced a concrete example.",
        );
    });

    it("evaluation reason node carries the tooltip title", () => {
        render(
            <CycleProgress
                currentStep={1}
                evaluationReason="Solid grasp of the rule."
            />,
        );
        const reason = screen.getByTestId("cycle-evaluation-reason");
        const title = reason.getAttribute("title");
        // i18n fallback variations are acceptable.
        expect(title).toMatch(
            /Why this step\?|Warum dieser Schritt\?|Pourquoi cette etape/,
        );
    });

    // --- v0.5.0: step-transition pulse animation --------------------------

    describe("step-transition pulse", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it("does NOT mark the current step as just-advanced on first render", () => {
            render(<CycleProgress currentStep={3} />);
            const current = screen.getByTestId("cycle-step-error");
            expect(current.getAttribute("data-just-advanced")).toBeNull();
            expect(current.className).not.toContain("is-just-advanced");
        });

        it("marks the new current step as just-advanced on a step change", () => {
            const {rerender} = render(<CycleProgress currentStep={2} />);
            rerender(<CycleProgress currentStep={3} />);
            const current = screen.getByTestId("cycle-step-error");
            expect(current.getAttribute("data-just-advanced")).toBe("true");
            expect(current.className).toContain("is-just-advanced");
        });

        it("marks the new step on a BACKWARD transition too (direction-agnostic)", () => {
            const {rerender} = render(<CycleProgress currentStep={4} />);
            rerender(<CycleProgress currentStep={2} />);
            const current = screen.getByTestId("cycle-step-attempt");
            expect(current.getAttribute("data-just-advanced")).toBe("true");
        });

        it("clears the just-advanced flag after the pulse timeout", () => {
            const {rerender} = render(<CycleProgress currentStep={1} />);
            rerender(<CycleProgress currentStep={2} />);
            const current = screen.getByTestId("cycle-step-attempt");
            expect(current.getAttribute("data-just-advanced")).toBe("true");
            // Pulse lasts ~900ms; advance the fake clock past it.
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(current.getAttribute("data-just-advanced")).toBeNull();
        });

        it("does NOT mark just-advanced when the step value doesn't change", () => {
            const {rerender} = render(<CycleProgress currentStep={3} />);
            rerender(<CycleProgress currentStep={3} />);
            const current = screen.getByTestId("cycle-step-error");
            expect(current.getAttribute("data-just-advanced")).toBeNull();
        });
    });
});

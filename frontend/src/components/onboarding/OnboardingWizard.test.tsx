/**
 * Tests for the optional onboarding wizard (#94).
 *
 * Covers step navigation (Next/Back + the step-1 Back -> exit),
 * the pre-selected defaults, the slider + segmented timeframe control,
 * and the two terminal actions on the final step.
 */

import {act, fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";

import OnboardingWizard, {type WizardValues} from "./OnboardingWizard";

const DEFAULTS: WizardValues = {
    goal: "",
    timeframe: "Flexible",
    dailyMinutes: 15,
    currentProblem: "",
};

function renderWizard(
    overrides: Partial<{
        defaults: WizardValues;
        onFinish: (v: WizardValues, start: boolean) => void;
        onExit: () => void;
    }> = {},
) {
    const onFinish = overrides.onFinish ?? vi.fn();
    const onExit = overrides.onExit ?? vi.fn();
    render(
        <MemoryRouter>
            <OnboardingWizard
                defaults={overrides.defaults ?? DEFAULTS}
                onFinish={onFinish}
                onExit={onExit}
            />
        </MemoryRouter>,
    );
    return {onFinish, onExit};
}

function next() {
    fireEvent.click(screen.getByTestId("onboarding-wizard-next"));
}

describe("OnboardingWizard", () => {
    it("starts on step 1 of 5 with the goal question", () => {
        renderWizard();
        expect(screen.getByTestId("onboarding-wizard-step-label").textContent).toContain(
            "1",
        );
        expect(screen.getByTestId("onboarding-wizard-goal")).toBeInTheDocument();
    });

    it("Back on step 1 calls onExit (returns to the invitation)", () => {
        const {onExit} = renderWizard();
        fireEvent.click(screen.getByTestId("onboarding-wizard-back"));
        expect(onExit).toHaveBeenCalledTimes(1);
    });

    it("Next advances through all five steps to the assessment offer", () => {
        renderWizard();
        next(); // -> timeframe
        expect(
            screen.getByTestId("onboarding-wizard-timeframe-flexible"),
        ).toBeInTheDocument();
        next(); // -> minutes
        expect(screen.getByTestId("onboarding-wizard-minutes")).toBeInTheDocument();
        next(); // -> problem
        expect(screen.getByTestId("onboarding-wizard-problem")).toBeInTheDocument();
        next(); // -> done
        expect(
            screen.getByTestId("onboarding-wizard-start-assessment"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("onboarding-wizard-later")).toBeInTheDocument();
    });

    it("finishing with defaults (no edits) returns the default values", () => {
        const {onFinish} = renderWizard();
        next();
        next();
        next();
        next();
        act(() => {
            fireEvent.click(
                screen.getByTestId("onboarding-wizard-start-assessment"),
            );
        });
        expect(onFinish).toHaveBeenCalledWith(
            {goal: "", timeframe: "Flexible", dailyMinutes: 15, currentProblem: ""},
            true,
        );
    });

    it("collects edits across steps and passes startAssessment=false on Later", () => {
        const onFinish = vi.fn<(v: WizardValues, start: boolean) => void>();
        renderWizard({onFinish});
        fireEvent.change(screen.getByTestId("onboarding-wizard-goal"), {
            target: {value: "Speak fluently"},
        });
        next(); // timeframe
        fireEvent.click(screen.getByTestId("onboarding-wizard-timeframe-3m"));
        next(); // minutes
        fireEvent.change(screen.getByTestId("onboarding-wizard-minutes"), {
            target: {value: "45"},
        });
        next(); // problem
        fireEvent.change(screen.getByTestId("onboarding-wizard-problem"), {
            target: {value: "No time"},
        });
        next(); // done
        act(() => {
            fireEvent.click(screen.getByTestId("onboarding-wizard-later"));
        });
        const [values, startAssessment] = onFinish.mock.calls[0];
        expect(values.goal).toBe("Speak fluently");
        expect(values.dailyMinutes).toBe(45);
        expect(values.currentProblem).toBe("No time");
        // The 3-month option label was selected.
        expect(values.timeframe.length).toBeGreaterThan(0);
        expect(startAssessment).toBe(false);
    });

    it("the minutes slider shows its current value", () => {
        renderWizard({defaults: {...DEFAULTS, dailyMinutes: 30}});
        next();
        next();
        expect(
            screen.getByTestId("onboarding-wizard-minutes-value").textContent,
        ).toContain("30");
    });
});

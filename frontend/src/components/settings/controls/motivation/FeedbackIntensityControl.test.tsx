/**
 * Tests for FeedbackIntensityControl (EXP-008 / Phase 55E).
 *
 * Pins:
 *  - reflects the stored intensity (defaults to normal),
 *  - selecting a level persists it + the live-update event fires,
 *  - the reduced-motion hint surfaces only when reduced motion is
 *    requested.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import FeedbackIntensityControl from "./FeedbackIntensityControl";
import {
    FEEDBACK_PREF_CHANGE_EVENT,
    readFeedbackIntensity,
} from "../../../../lib/feedback/feedbackPref";
import {setPlayfulMode} from "../../../../lib/learning/playful/playfulModePref";

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("FeedbackIntensityControl", () => {
    it("defaults to the normal radio selected", () => {
        render(<FeedbackIntensityControl />);
        expect(
            screen.getByTestId("settings-feedback-intensity-normal"),
        ).toBeChecked();
        expect(
            screen.getByTestId("settings-feedback-intensity-subtle"),
        ).not.toBeChecked();
    });

    it("persists the chosen level and dispatches the change event", () => {
        const onChange = vi.fn();
        window.addEventListener(FEEDBACK_PREF_CHANGE_EVENT, onChange);
        render(<FeedbackIntensityControl />);
        fireEvent.click(
            screen.getByTestId("settings-feedback-intensity-enthusiastic"),
        );
        expect(readFeedbackIntensity()).toBe("enthusiastic");
        expect(
            screen.getByTestId("settings-feedback-intensity-enthusiastic"),
        ).toBeChecked();
        expect(onChange).toHaveBeenCalled();
        window.removeEventListener(FEEDBACK_PREF_CHANGE_EVENT, onChange);
    });

    it("shows the reduced-motion hint only under reduced motion", () => {
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        );
        render(<FeedbackIntensityControl />);
        expect(
            screen.getByTestId(
                "settings-feedback-intensity-reduced-hint",
            ),
        ).toBeInTheDocument();
    });

    it("hides the reduced-motion hint when motion is allowed", () => {
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        );
        render(<FeedbackIntensityControl />);
        expect(
            screen.queryByTestId(
                "settings-feedback-intensity-reduced-hint",
            ),
        ).not.toBeInTheDocument();
    });

    it("shows the game-mode hint while playful mode is on and removes it when the mode is switched off", () => {
        setPlayfulMode(true);
        render(<FeedbackIntensityControl />);
        expect(
            screen.getByTestId("settings-feedback-intensity-playful-hint"),
        ).toHaveTextContent(
            "Game mode is on, so feedback is always enthusiastic regardless of this setting.",
        );

        act(() => {
            setPlayfulMode(false);
        });
        expect(
            screen.queryByTestId("settings-feedback-intensity-playful-hint"),
        ).not.toBeInTheDocument();
    });

    it("hides the game-mode hint while playful mode is off", () => {
        render(<FeedbackIntensityControl />);
        expect(
            screen.queryByTestId("settings-feedback-intensity-playful-hint"),
        ).not.toBeInTheDocument();
    });
});

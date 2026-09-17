/**
 * InteractionControl (#2954) - the Settings > Learning "Interaction"
 * section extracted from ``LearningPanel``: swipe gestures, lesson
 * keyboard shortcuts, auto-advance and the "Ask AI" button visibility.
 *
 * Pins: the section root + the four toggles keep their testids, every
 * toggle persists to its own localStorage key (the same key the lesson
 * consumers read), the persisted value is reflected on mount, and the
 * shipped defaults survive the extraction.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

import InteractionControl from "./InteractionControl";

const TOGGLES = [
    {
        name: "swipe gestures",
        testid: "settings-gestures-toggle",
        key: "adaptive-learner.gestures_enabled",
    },
    {
        name: "lesson keyboard shortcuts",
        testid: "settings-lesson-shortcuts-toggle",
        key: "adaptive-learner.lesson.shortcuts_enabled",
    },
    {
        name: "auto-advance",
        testid: "settings-lesson-auto-advance-toggle",
        key: "adaptive-learner.lesson.auto_advance_enabled",
    },
    {
        name: "Ask AI visibility",
        testid: "settings-ask-ai-visible-toggle",
        key: "adaptive-learner.lesson.ask_ai_visible",
    },
] as const;

const PERSISTED_CASES = TOGGLES.flatMap((toggle) =>
    (["true", "false"] as const).map((persisted) => ({...toggle, persisted})),
);

afterEach(() => {
    localStorage.clear();
});

describe("InteractionControl (#2954)", () => {
    it("renders the Interaction section with its four toggles", () => {
        render(<InteractionControl />);
        expect(
            screen.getByTestId("settings-section-interaction"),
        ).toBeInTheDocument();
        for (const {testid} of TOGGLES) {
            const toggle = screen.getByTestId(testid) as HTMLInputElement;
            expect(toggle).toBeInTheDocument();
            expect(toggle.type).toBe("checkbox");
        }
    });

    it("reflects the shipped defaults when nothing is stored (shortcuts ON, auto-advance OFF, Ask AI ON)", () => {
        render(<InteractionControl />);
        const shortcuts = screen.getByTestId(
            "settings-lesson-shortcuts-toggle",
        ) as HTMLInputElement;
        const autoAdvance = screen.getByTestId(
            "settings-lesson-auto-advance-toggle",
        ) as HTMLInputElement;
        const askAi = screen.getByTestId(
            "settings-ask-ai-visible-toggle",
        ) as HTMLInputElement;
        expect(shortcuts.checked).toBe(true);
        expect(autoAdvance.checked).toBe(false);
        expect(askAi.checked).toBe(true);
    });

    it.each(TOGGLES)(
        "flipping the $name toggle persists the new value under $key",
        ({testid, key}) => {
            render(<InteractionControl />);
            const toggle = screen.getByTestId(testid) as HTMLInputElement;
            const initial = toggle.checked;
            fireEvent.click(toggle);
            expect(toggle.checked).toBe(!initial);
            expect(localStorage.getItem(key)).toBe(String(!initial));
        },
    );

    it.each(PERSISTED_CASES)(
        "initialises the $name toggle from the persisted value ($persisted)",
        ({testid, key, persisted}) => {
            localStorage.setItem(key, persisted);
            render(<InteractionControl />);
            const toggle = screen.getByTestId(testid) as HTMLInputElement;
            expect(toggle.checked).toBe(persisted === "true");
        },
    );
});

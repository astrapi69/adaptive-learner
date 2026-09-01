/**
 * Tests for PlayfulModeControl (#2844): default-off rendering, the
 * persisted round-trip, and the live change event on toggle.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import PlayfulModeControl from "./PlayfulModeControl";
import {
    PLAYFUL_MODE_CHANGE_EVENT,
    readPlayfulMode,
    setPlayfulMode,
} from "../../../../lib/learning/playfulModePref";

beforeEach(() => {
    localStorage.clear();
});

describe("PlayfulModeControl", () => {
    it("renders the section with the toggle off by default", () => {
        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-section-playful"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("settings-playful-mode-toggle"),
        ).not.toBeChecked();
    });

    it("reflects an already-enabled playful mode", () => {
        setPlayfulMode(true);
        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-playful-mode-toggle"),
        ).toBeChecked();
    });

    it("toggling persists the pref and dispatches the change event", () => {
        const listener = vi.fn();
        window.addEventListener(PLAYFUL_MODE_CHANGE_EVENT, listener);
        render(<PlayfulModeControl />);

        fireEvent.click(screen.getByTestId("settings-playful-mode-toggle"));
        expect(readPlayfulMode()).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("settings-playful-mode-toggle"));
        expect(readPlayfulMode()).toBe(false);

        window.removeEventListener(PLAYFUL_MODE_CHANGE_EVENT, listener);
    });
});

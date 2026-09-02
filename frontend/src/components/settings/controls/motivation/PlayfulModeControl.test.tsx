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
import {
    readPlayfulCountdown,
    readPlayfulCountdownSeconds,
    readPlayfulHearts,
    readPlayfulHeartsCount,
} from "../../../../lib/learning/playfulTensionPref";

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

describe("game-mode sounds (#2875)", async () => {
    const {setPlayfulMode} = await import(
        "../../../../lib/learning/playfulModePref"
    );
    const {
        readPlayfulSounds,
        readPlayfulSoundsPrompted,
        setPlayfulSounds,
    } = await import("../../../../lib/learning/playfulSoundsPref");
    const {fireEvent} = await import("@testing-library/react");

    it("renders the sound toggle and persists a change", () => {
        render(<PlayfulModeControl />);
        const toggle = screen.getByTestId("settings-playful-sounds-toggle");
        expect(toggle).not.toBeChecked();
        fireEvent.click(toggle);
        expect(readPlayfulSounds()).toBe(true);
    });

    it("shows the one-time offer only while game mode is on and unanswered", () => {
        render(<PlayfulModeControl />);
        expect(
            screen.queryByTestId("settings-playful-sounds-offer"),
        ).not.toBeInTheDocument();
    });

    it("offer 'yes' enables sounds; 'later' only dismisses", () => {
        setPlayfulMode(true);
        const first = render(<PlayfulModeControl />);
        fireEvent.click(
            screen.getByTestId("settings-playful-sounds-offer-yes"),
        );
        expect(readPlayfulSounds()).toBe(true);
        expect(
            screen.queryByTestId("settings-playful-sounds-offer"),
        ).not.toBeInTheDocument();
        first.unmount();

        localStorage.clear();
        setPlayfulMode(true);
        render(<PlayfulModeControl />);
        fireEvent.click(
            screen.getByTestId("settings-playful-sounds-offer-later"),
        );
        expect(readPlayfulSounds()).toBe(false);
        expect(readPlayfulSoundsPrompted()).toBe(true);
        expect(
            screen.queryByTestId("settings-playful-sounds-offer"),
        ).not.toBeInTheDocument();
    });

    it("an answered offer never returns", () => {
        setPlayfulMode(true);
        setPlayfulSounds(true);
        render(<PlayfulModeControl />);
        expect(
            screen.queryByTestId("settings-playful-sounds-offer"),
        ).not.toBeInTheDocument();
    });
});

describe("PlayfulModeControl: tension systems (#2878)", () => {
    it("renders both switches off by default with disabled number inputs", () => {
        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-playful-hearts-toggle"),
        ).not.toBeChecked();
        expect(
            screen.getByTestId("settings-playful-countdown-toggle"),
        ).not.toBeChecked();
        expect(screen.getByTestId("settings-playful-hearts-count")).toBeDisabled();
        expect(
            screen.getByTestId("settings-playful-countdown-seconds"),
        ).toBeDisabled();
    });

    it("toggling hearts persists and enables the count input", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(screen.getByTestId("settings-playful-hearts-toggle"));
        expect(readPlayfulHearts()).toBe(true);
        expect(
            screen.getByTestId("settings-playful-hearts-count"),
        ).not.toBeDisabled();
        fireEvent.change(screen.getByTestId("settings-playful-hearts-count"), {
            target: {value: "99"},
        });
        expect(readPlayfulHeartsCount()).toBe(5);
    });

    it("toggling the countdown persists and clamps the seconds", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(
            screen.getByTestId("settings-playful-countdown-toggle"),
        );
        expect(readPlayfulCountdown()).toBe(true);
        fireEvent.change(
            screen.getByTestId("settings-playful-countdown-seconds"),
            {target: {value: "2"}},
        );
        expect(readPlayfulCountdownSeconds()).toBe(5);
    });
});

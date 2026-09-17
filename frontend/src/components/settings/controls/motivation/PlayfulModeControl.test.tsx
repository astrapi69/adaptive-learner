/**
 * Tests for PlayfulModeControl (#2844): default-off rendering, the
 * persisted round-trip, the live change event on toggle, the game-mode
 * sounds offer (#2875), and the summary card + remembered details fold
 * (#2959): collapsed by default with every detail control still MOUNTED,
 * disabled with a notice while the master is off, enabled live when the
 * master flips, the open state surviving a remount, and the status line
 * counting the enabled extras. The per-block control tests live next to
 * the blocks in ``./playful``.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import PlayfulModeControl from "./PlayfulModeControl";
import {
    PLAYFUL_MODE_CHANGE_EVENT,
    readPlayfulMode,
    setPlayfulMode,
} from "../../../../lib/learning/playful/playfulModePref";

const DETAILS_OPEN_KEY = "adaptive-learner.settings.playful_details_open";

/** Every detail control the fold hosts (all 24 pre-#2959 testids minus
 *  the master / sounds / offer ids that stay on the summary card). */
const DETAIL_CONTROLS = [
    "settings-playful-hearts-toggle",
    "settings-playful-hearts-count",
    "settings-playful-countdown-toggle",
    "settings-playful-countdown-seconds",
    "settings-playful-arcade-toggle",
    "settings-playful-arcade-snake-seconds",
    "settings-playful-arcade-memory-pairs",
    "settings-playful-arcade-simon-target",
    "settings-playful-special-rounds-toggle",
    "settings-playful-flash-round-cards",
    "settings-playful-tickets-toggle",
    "settings-playful-ticket-cap",
    "settings-playful-bonus-toggle",
    "settings-playful-combo-xp-toggle",
    "settings-playful-combo-xp-cap",
];

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
        expect(
            screen.getByTestId("settings-playful-mode-toggle"),
        ).toBeChecked();

        fireEvent.click(screen.getByTestId("settings-playful-mode-toggle"));
        expect(readPlayfulMode()).toBe(false);

        window.removeEventListener(PLAYFUL_MODE_CHANGE_EVENT, listener);
    });
});

describe("game-mode sounds (#2875)", async () => {
    const {
        readPlayfulSounds,
        readPlayfulSoundsPrompted,
        setPlayfulSounds,
    } = await import("../../../../lib/learning/playful/playfulSoundsPref");

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

describe("PlayfulModeControl: summary card + details fold (#2959)", () => {
    it("collapses the game details by default and keeps every sub-control mounted", () => {
        render(<PlayfulModeControl />);
        const toggle = screen.getByTestId("settings-playful-details-toggle");
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(
            screen.getByTestId("settings-playful-details-body"),
        ).not.toBeVisible();
        ["tension", "arcade", "xp"].forEach((block) =>
            expect(
                screen.getByTestId(`settings-playful-block-${block}`),
            ).toBeInTheDocument(),
        );
        DETAIL_CONTROLS.forEach((testid) =>
            expect(screen.getByTestId(testid)).toBeInTheDocument(),
        );
    });

    it("disables every detail control and shows the notice while game mode is off", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(screen.getByTestId("settings-playful-details-toggle"));
        expect(
            screen.getByTestId("settings-playful-details-off-notice"),
        ).toBeVisible();
        DETAIL_CONTROLS.forEach((testid) =>
            expect(screen.getByTestId(testid)).toBeDisabled(),
        );
        // The summary-card controls stay usable: the master is the way out.
        expect(
            screen.getByTestId("settings-playful-mode-toggle"),
        ).not.toBeDisabled();
        expect(
            screen.getByTestId("settings-playful-sounds-toggle"),
        ).not.toBeDisabled();
    });

    it("enables them without reload when the master is switched on", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(screen.getByTestId("settings-playful-details-toggle"));
        act(() => setPlayfulMode(true));
        expect(
            screen.queryByTestId("settings-playful-details-off-notice"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("settings-playful-hearts-toggle"),
        ).not.toBeDisabled();
        expect(
            screen.getByTestId("settings-playful-combo-xp-cap"),
        ).not.toBeDisabled();
        // A control's OWN gate still applies: hearts are off, so the count stays locked.
        expect(screen.getByTestId("settings-playful-hearts-count")).toBeDisabled();
        act(() => setPlayfulMode(false));
        expect(
            screen.getByTestId("settings-playful-details-off-notice"),
        ).toBeVisible();
        expect(
            screen.getByTestId("settings-playful-combo-xp-cap"),
        ).toBeDisabled();
    });

    it("remembers the open state across mounts", () => {
        const first = render(<PlayfulModeControl />);
        fireEvent.click(screen.getByTestId("settings-playful-details-toggle"));
        expect(localStorage.getItem(DETAILS_OPEN_KEY)).toBe("true");
        first.unmount();

        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-playful-details-toggle"),
        ).toHaveAttribute("aria-expanded", "true");
        expect(
            screen.getByTestId("settings-playful-details-body"),
        ).toBeVisible();
    });

    it("the summary line counts the enabled extras", () => {
        setPlayfulMode(true);
        render(<PlayfulModeControl />);
        const summary = screen.getByTestId("settings-playful-summary");
        expect(summary).toHaveTextContent("5 of 7 extras on");
        fireEvent.click(screen.getByTestId("settings-playful-details-toggle"));
        fireEvent.click(screen.getByTestId("settings-playful-hearts-toggle"));
        expect(summary).toHaveTextContent("6 of 7 extras on");
        fireEvent.click(screen.getByTestId("settings-playful-arcade-toggle"));
        fireEvent.click(screen.getByTestId("settings-playful-bonus-toggle"));
        expect(summary).toHaveTextContent("4 of 7 extras on");
    });
});

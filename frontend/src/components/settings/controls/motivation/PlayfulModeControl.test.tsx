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
} from "../../../../lib/learning/playful/playfulModePref";
import {
    readPlayfulCountdown,
    readPlayfulCountdownSeconds,
    readPlayfulHearts,
    readPlayfulHeartsCount,
} from "../../../../lib/learning/playful/playfulTensionPref";
import {
    readComboXpCap,
    readPlayfulComboXp,
} from "../../../../lib/learning/playful/playfulComboXpPref";
import {
    readMemoryPairs,
    readSimonTarget,
    readPlayfulArcade,
    readSnakeSeconds,
} from "../../../../lib/learning/playful/playfulArcadePref";
import {
    readFlashRoundCards,
    readPlayfulSpecialRounds,
} from "../../../../lib/learning/playful/playfulSpecialRoundsPref";
import {
    readPlayfulTickets,
    readTicketCap,
} from "../../../../lib/learning/playful/playfulTicketsPref";
import {readPlayfulBonus} from "../../../../lib/learning/playful/playfulBonusPref";

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
        "../../../../lib/learning/playful/playfulModePref"
    );
    const {
        readPlayfulSounds,
        readPlayfulSoundsPrompted,
        setPlayfulSounds,
    } = await import("../../../../lib/learning/playful/playfulSoundsPref");
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

describe("PlayfulModeControl: combo bonus XP (#2893)", () => {
    it("renders the switch ON by default with the cap enabled at 10", () => {
        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-playful-combo-xp-toggle"),
        ).toBeChecked();
        const cap = screen.getByTestId("settings-playful-combo-xp-cap");
        expect(cap).not.toBeDisabled();
        expect(cap).toHaveValue(10);
    });

    it("disabling persists and disables the cap input", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(
            screen.getByTestId("settings-playful-combo-xp-toggle"),
        );
        expect(readPlayfulComboXp()).toBe(false);
        expect(
            screen.getByTestId("settings-playful-combo-xp-cap"),
        ).toBeDisabled();
    });

    it("clamps the cap on change and persists the clamped value", () => {
        render(<PlayfulModeControl />);
        fireEvent.change(screen.getByTestId("settings-playful-combo-xp-cap"), {
            target: {value: "99"},
        });
        expect(readComboXpCap()).toBe(20);
        expect(
            screen.getByTestId("settings-playful-combo-xp-cap"),
        ).toHaveValue(20);
    });
});

describe("PlayfulModeControl: arcade (#2887)", () => {
    it("renders the switch ON by default with editable snake/memory fields", () => {
        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-playful-arcade-toggle"),
        ).toBeChecked();
        expect(
            screen.getByTestId("settings-playful-arcade-snake-seconds"),
        ).toHaveValue(60);
        expect(
            screen.getByTestId("settings-playful-arcade-memory-pairs"),
        ).toHaveValue(8);
        expect(
            screen.getByTestId("settings-playful-arcade-simon-target"),
        ).toHaveValue(8);
    });

    it("disabling persists and disables the number inputs", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(screen.getByTestId("settings-playful-arcade-toggle"));
        expect(readPlayfulArcade()).toBe(false);
        expect(
            screen.getByTestId("settings-playful-arcade-snake-seconds"),
        ).toBeDisabled();
        expect(
            screen.getByTestId("settings-playful-arcade-memory-pairs"),
        ).toBeDisabled();
        expect(
            screen.getByTestId("settings-playful-arcade-simon-target"),
        ).toBeDisabled();
    });

    it("clamps and persists the number settings", () => {
        render(<PlayfulModeControl />);
        fireEvent.change(
            screen.getByTestId("settings-playful-arcade-snake-seconds"),
            {target: {value: "999"}},
        );
        fireEvent.change(
            screen.getByTestId("settings-playful-arcade-memory-pairs"),
            {target: {value: "1"}},
        );
        fireEvent.change(
            screen.getByTestId("settings-playful-arcade-simon-target"),
            {target: {value: "99"}},
        );
        expect(readSnakeSeconds()).toBe(120);
        expect(readMemoryPairs()).toBe(4);
        expect(readSimonTarget()).toBe(15);
    });
});

describe("PlayfulModeControl: special rounds (#2888)", () => {
    it("renders the switch ON by default with an editable card count of 10", () => {
        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-playful-special-rounds-toggle"),
        ).toBeChecked();
        expect(
            screen.getByTestId("settings-playful-flash-round-cards"),
        ).toHaveValue(10);
    });

    it("disabling persists and disables the card-count input", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(
            screen.getByTestId("settings-playful-special-rounds-toggle"),
        );
        expect(readPlayfulSpecialRounds()).toBe(false);
        expect(
            screen.getByTestId("settings-playful-flash-round-cards"),
        ).toBeDisabled();
    });

    it("clamps and persists the card count", () => {
        render(<PlayfulModeControl />);
        fireEvent.change(
            screen.getByTestId("settings-playful-flash-round-cards"),
            {target: {value: "99"}},
        );
        expect(readFlashRoundCards()).toBe(20);
    });
});

describe("PlayfulModeControl: ticket economy (#2889)", () => {
    it("renders the switch ON by default with an editable cap of 5", () => {
        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-playful-tickets-toggle"),
        ).toBeChecked();
        expect(screen.getByTestId("settings-playful-ticket-cap")).toHaveValue(
            5,
        );
    });

    it("disabling persists and disables the cap input", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(screen.getByTestId("settings-playful-tickets-toggle"));
        expect(readPlayfulTickets()).toBe(false);
        expect(
            screen.getByTestId("settings-playful-ticket-cap"),
        ).toBeDisabled();
    });

    it("clamps and persists the cap", () => {
        render(<PlayfulModeControl />);
        fireEvent.change(screen.getByTestId("settings-playful-ticket-cap"), {
            target: {value: "99"},
        });
        expect(readTicketCap()).toBe(10);
    });
});

describe("PlayfulModeControl: bonus lessons (#2890)", () => {
    it("renders the switch ON by default", () => {
        render(<PlayfulModeControl />);
        expect(
            screen.getByTestId("settings-playful-bonus-toggle"),
        ).toBeChecked();
    });

    it("disabling persists the pref", () => {
        render(<PlayfulModeControl />);
        fireEvent.click(screen.getByTestId("settings-playful-bonus-toggle"));
        expect(readPlayfulBonus()).toBe(false);
    });
});

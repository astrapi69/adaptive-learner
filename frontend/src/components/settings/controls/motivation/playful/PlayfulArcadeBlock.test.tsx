/**
 * Tests for PlayfulArcadeBlock (#2887 / #2907 / #2888 / #2889 / #2890,
 * split out by #2959): the arcade, special-round, ticket and bonus
 * switches default ON with editable clamped numbers, each persists, and
 * the block-wide ``disabled`` prop locks every control.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it} from "vitest";

import PlayfulArcadeBlock from "./PlayfulArcadeBlock";
import {
    readMemoryPairs,
    readPlayfulArcade,
    readSimonTarget,
    readSnakeSeconds,
} from "@/lib/learning/playful/playfulArcadePref";
import {
    readFlashRoundCards,
    readPlayfulSpecialRounds,
} from "@/lib/learning/playful/playfulSpecialRoundsPref";
import {
    readPlayfulTickets,
    readTicketCap,
} from "@/lib/learning/playful/playfulTicketsPref";
import {readPlayfulBonus} from "@/lib/learning/playful/playfulBonusPref";

const CONTROLS = [
    "settings-playful-arcade-toggle",
    "settings-playful-arcade-snake-seconds",
    "settings-playful-arcade-memory-pairs",
    "settings-playful-arcade-simon-target",
    "settings-playful-special-rounds-toggle",
    "settings-playful-flash-round-cards",
    "settings-playful-tickets-toggle",
    "settings-playful-ticket-cap",
    "settings-playful-bonus-toggle",
];

beforeEach(() => {
    localStorage.clear();
});

describe("PlayfulArcadeBlock: heading + disabled (#2959)", () => {
    it("renders the cluster heading with every control present", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        expect(
            screen.getByTestId("settings-playful-block-arcade"),
        ).toBeInTheDocument();
        expect(screen.getByRole("heading", {level: 3})).toHaveTextContent(
            "Arcade and rewards",
        );
        CONTROLS.forEach((testid) =>
            expect(screen.getByTestId(testid)).toBeInTheDocument(),
        );
    });

    it("disabled locks every control while the ON defaults stay checked", () => {
        render(<PlayfulArcadeBlock disabled />);
        CONTROLS.forEach((testid) =>
            expect(screen.getByTestId(testid)).toBeDisabled(),
        );
        expect(screen.getByTestId("settings-playful-arcade-toggle")).toBeChecked();
    });
});

describe("PlayfulArcadeBlock: arcade (#2887)", () => {
    it("renders the switch ON by default with editable snake/memory/simon fields", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
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
        render(<PlayfulArcadeBlock disabled={false} />);
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
        render(<PlayfulArcadeBlock disabled={false} />);
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

describe("PlayfulArcadeBlock: special rounds (#2888)", () => {
    it("renders the switch ON by default with an editable card count of 10", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        expect(
            screen.getByTestId("settings-playful-special-rounds-toggle"),
        ).toBeChecked();
        expect(
            screen.getByTestId("settings-playful-flash-round-cards"),
        ).toHaveValue(10);
    });

    it("disabling persists and disables the card-count input", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        fireEvent.click(
            screen.getByTestId("settings-playful-special-rounds-toggle"),
        );
        expect(readPlayfulSpecialRounds()).toBe(false);
        expect(
            screen.getByTestId("settings-playful-flash-round-cards"),
        ).toBeDisabled();
    });

    it("clamps and persists the card count", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        fireEvent.change(
            screen.getByTestId("settings-playful-flash-round-cards"),
            {target: {value: "99"}},
        );
        expect(readFlashRoundCards()).toBe(20);
    });
});

describe("PlayfulArcadeBlock: ticket economy (#2889)", () => {
    it("renders the switch ON by default with an editable cap of 5", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        expect(
            screen.getByTestId("settings-playful-tickets-toggle"),
        ).toBeChecked();
        expect(screen.getByTestId("settings-playful-ticket-cap")).toHaveValue(
            5,
        );
    });

    it("disabling persists and disables the cap input", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        fireEvent.click(screen.getByTestId("settings-playful-tickets-toggle"));
        expect(readPlayfulTickets()).toBe(false);
        expect(
            screen.getByTestId("settings-playful-ticket-cap"),
        ).toBeDisabled();
    });

    it("clamps and persists the cap", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        fireEvent.change(screen.getByTestId("settings-playful-ticket-cap"), {
            target: {value: "99"},
        });
        expect(readTicketCap()).toBe(10);
    });
});

describe("PlayfulArcadeBlock: bonus lessons (#2890)", () => {
    it("renders the switch ON by default", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        expect(
            screen.getByTestId("settings-playful-bonus-toggle"),
        ).toBeChecked();
    });

    it("disabling persists the pref", () => {
        render(<PlayfulArcadeBlock disabled={false} />);
        fireEvent.click(screen.getByTestId("settings-playful-bonus-toggle"));
        expect(readPlayfulBonus()).toBe(false);
    });
});

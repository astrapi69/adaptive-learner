/**
 * Tests for PlayfulXpBlock (#2893 + #2861, split out by #2959): the
 * streak-bonus switch defaults ON with an editable clamped cap, the
 * mascot variant picker renders inside the block, and the block-wide
 * ``disabled`` prop locks the cap AND every mascot button.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const getState = vi.fn();
const listBadges = vi.fn();
const spendXp = vi.fn();
vi.mock("../../../../../storage", () => ({
    getStorage: () => ({gamification: {getState, listBadges, spendXp}}),
}));

import PlayfulXpBlock from "./PlayfulXpBlock";
import {setUserId} from "@/lib/learning/learnerState";
import {
    readComboXpCap,
    readPlayfulComboXp,
} from "@/lib/learning/playful/playfulComboXpPref";

const xpState = {
    user_id: "u1",
    total_xp: 300,
    level: 3,
    xp_into_level: 0,
    xp_to_next_level: 100,
    next_level_threshold: 100,
};

beforeEach(() => {
    localStorage.clear();
    getState.mockReset().mockResolvedValue(xpState);
    listBadges.mockReset().mockResolvedValue([]);
    spendXp.mockReset();
});

async function renderWithMascot(disabled: boolean) {
    setUserId("u1");
    render(<PlayfulXpBlock disabled={disabled} />);
    await waitFor(() =>
        expect(
            screen.getByTestId("settings-mascot-variants"),
        ).toBeInTheDocument(),
    );
}

describe("PlayfulXpBlock: combo bonus XP (#2893)", () => {
    it("renders the cluster heading and the switch ON by default with the cap enabled at 10", () => {
        render(<PlayfulXpBlock disabled={false} />);
        expect(screen.getByTestId("settings-playful-block-xp")).toBeInTheDocument();
        expect(screen.getByRole("heading", {level: 3})).toHaveTextContent(
            "XP and mascot",
        );
        expect(
            screen.getByTestId("settings-playful-combo-xp-toggle"),
        ).toBeChecked();
        const cap = screen.getByTestId("settings-playful-combo-xp-cap");
        expect(cap).not.toBeDisabled();
        expect(cap).toHaveValue(10);
    });

    it("disabling persists and disables the cap input", () => {
        render(<PlayfulXpBlock disabled={false} />);
        fireEvent.click(
            screen.getByTestId("settings-playful-combo-xp-toggle"),
        );
        expect(readPlayfulComboXp()).toBe(false);
        expect(
            screen.getByTestId("settings-playful-combo-xp-cap"),
        ).toBeDisabled();
    });

    it("clamps the cap on change and persists the clamped value", () => {
        render(<PlayfulXpBlock disabled={false} />);
        fireEvent.change(screen.getByTestId("settings-playful-combo-xp-cap"), {
            target: {value: "99"},
        });
        expect(readComboXpCap()).toBe(20);
        expect(
            screen.getByTestId("settings-playful-combo-xp-cap"),
        ).toHaveValue(20);
    });
});

describe("PlayfulXpBlock: disabled + mascot (#2959)", () => {
    it("disabled locks the switch and the cap while the switch stays checked", () => {
        render(<PlayfulXpBlock disabled />);
        expect(
            screen.getByTestId("settings-playful-combo-xp-toggle"),
        ).toBeDisabled();
        expect(
            screen.getByTestId("settings-playful-combo-xp-toggle"),
        ).toBeChecked();
        expect(
            screen.getByTestId("settings-playful-combo-xp-cap"),
        ).toBeDisabled();
    });

    it("renders the mascot picker with the unlocked default selectable when enabled", async () => {
        await renderWithMascot(false);
        expect(
            screen.getByTestId("settings-mascot-variant-funke"),
        ).not.toBeDisabled();
    });

    it("disabled propagates into the mascot picker: even the unlocked default is locked", async () => {
        await renderWithMascot(true);
        expect(
            screen.getByTestId("settings-mascot-variant-funke"),
        ).toBeDisabled();
        expect(
            screen.getByTestId("settings-mascot-variant-buy-gold"),
        ).toBeDisabled();
    });
});

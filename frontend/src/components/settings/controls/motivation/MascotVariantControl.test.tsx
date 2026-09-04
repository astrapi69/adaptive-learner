/**
 * Tests for MascotVariantControl (#2861): the five variants render
 * with their lock states, selecting persists and recolors live via
 * the store's change event, and the XP purchase is the guarded
 * two-step shared flow (affordability check first - spendXp never
 * rejects on its own).
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const getState = vi.fn();
const listBadges = vi.fn();
const spendXp = vi.fn();
vi.mock("../../../../storage", () => ({
    getStorage: () => ({gamification: {getState, listBadges, spendXp}}),
}));

const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock("../../../../utils/notify", () => ({
    notify: {
        success: (m: string) => notifySuccess(m),
        error: (m: string) => notifyError(m),
    },
}));

import MascotVariantControl from "./MascotVariantControl";
import {setUserId} from "../../../../lib/learning/learnerState";
import {
    MASCOT_VARIANT_CHANGE_EVENT,
    readMascotVariantState,
} from "../../../../lib/mascot/mascot-variant-store";

const xpState = (total: number, level: number) => ({
    user_id: "u1",
    total_xp: total,
    level,
    xp_into_level: 0,
    xp_to_next_level: 100,
    next_level_threshold: 100,
});

beforeEach(() => {
    localStorage.clear();
    setUserId("u1");
    getState.mockReset().mockResolvedValue(xpState(300, 3));
    listBadges.mockReset().mockResolvedValue([
        {key: "streak_3_days", earned: false},
        {key: "first_session", earned: false},
    ]);
    spendXp.mockReset().mockResolvedValue(xpState(50, 3));
    notifySuccess.mockClear();
    notifyError.mockClear();
});

async function renderControl() {
    render(<MascotVariantControl />);
    await waitFor(() =>
        expect(
            screen.getByTestId("settings-mascot-variants"),
        ).toBeInTheDocument(),
    );
}

describe("MascotVariantControl", () => {
    it("renders all five variants; level/badge locks match the loaded state", async () => {
        await renderControl();
        // Level 3: ozean (L3) unlocked, wald (L7) locked.
        expect(
            screen.getByTestId("settings-mascot-variant-ozean"),
        ).not.toBeDisabled();
        expect(
            screen.getByTestId("settings-mascot-variant-wald"),
        ).toBeDisabled();
        // Badge first_session not earned -> geist locked.
        expect(
            screen.getByTestId("settings-mascot-variant-geist"),
        ).toBeDisabled();
        // Default always available.
        expect(
            screen.getByTestId("settings-mascot-variant-funke"),
        ).not.toBeDisabled();
    });

    it("selecting an unlocked variant persists and fires the change event", async () => {
        const listener = vi.fn();
        window.addEventListener(MASCOT_VARIANT_CHANGE_EVENT, listener);
        await renderControl();
        fireEvent.click(screen.getByTestId("settings-mascot-variant-ozean"));
        expect(readMascotVariantState("u1").selected).toBe("ozean");
        expect(listener).toHaveBeenCalled();
        expect(
            screen.getByTestId("settings-mascot-variant-ozean"),
        ).toHaveAttribute("aria-pressed", "true");
        window.removeEventListener(MASCOT_VARIANT_CHANGE_EVENT, listener);
    });

    it("buying the affordable gold variant is a two-step confirm that spends and selects", async () => {
        await renderControl();
        // gold costs 250, total_xp 300 -> affordable.
        const buy = screen.getByTestId("settings-mascot-variant-buy-gold");
        fireEvent.click(buy);
        expect(spendXp).not.toHaveBeenCalled();
        await act(async () => {
            fireEvent.click(buy);
        });
        expect(spendXp).toHaveBeenCalledWith("u1", 250, "mascot_variant");
        expect(readMascotVariantState("u1").purchased).toContain("gold");
        expect(readMascotVariantState("u1").selected).toBe("gold");
    });

    it("an unaffordable variant cannot be bought (spendXp clamps, so we must guard)", async () => {
        getState.mockResolvedValue(xpState(100, 3));
        await renderControl();
        expect(
            screen.getByTestId("settings-mascot-variant-buy-gold"),
        ).toBeDisabled();
        expect(spendXp).not.toHaveBeenCalled();
    });

    it("renders nothing without an onboarded user", async () => {
        localStorage.clear();
        const {container} = render(<MascotVariantControl />);
        expect(container.innerHTML).toBe("");
        expect(getState).not.toHaveBeenCalled();
    });
});

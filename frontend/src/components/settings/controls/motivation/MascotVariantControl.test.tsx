/**
 * Tests for MascotVariantControl (#2861): the five variants render
 * with their lock states, selecting persists and recolors live via
 * the store's change event, and the XP purchase is the guarded
 * two-step shared flow (affordability check first). Since #3445 the
 * purchase is one ledger event and ownership follows the ledger.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const getState = vi.fn();
const listBadges = vi.fn();
const purchaseItem = vi.fn();
const listPurchases = vi.fn();
vi.mock("../../../../storage", () => ({
    getStorage: () => ({
        gamification: {getState, listBadges, purchaseItem, listPurchases},
    }),
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
    purchaseItem.mockReset().mockResolvedValue({xp: xpState(50, 3)});
    listPurchases.mockReset().mockResolvedValue([]);
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
        expect(purchaseItem).not.toHaveBeenCalled();
        await act(async () => {
            fireEvent.click(buy);
        });
        expect(purchaseItem).toHaveBeenCalledWith("u1", {
            item_kind: "mascot_variant",
            item_id: "gold",
            cost: 250,
        });
        expect(readMascotVariantState("u1").purchased).toContain("gold");
        expect(readMascotVariantState("u1").selected).toBe("gold");
    });

    it("an unaffordable variant cannot be bought", async () => {
        getState.mockResolvedValue(xpState(100, 3));
        await renderControl();
        expect(
            screen.getByTestId("settings-mascot-variant-buy-gold"),
        ).toBeDisabled();
        expect(purchaseItem).not.toHaveBeenCalled();
    });

    it("a variant bought in another browser shows as owned (#3445)", async () => {
        getState.mockResolvedValue(xpState(100, 3));
        listPurchases.mockResolvedValue([
            {
                id: "p1",
                user_id: "u1",
                item_kind: "mascot_variant",
                item_id: "gold",
                cost: 250,
                purchased_at: "2026-10-01T00:00:00Z",
            },
        ]);
        await renderControl();
        await waitFor(() =>
            expect(
                screen.queryByTestId("settings-mascot-variant-buy-gold"),
            ).not.toBeInTheDocument(),
        );
        expect(readMascotVariantState("u1").purchased).toEqual(["gold"]);
    });

    it("renders nothing without an onboarded user", async () => {
        localStorage.clear();
        const {container} = render(<MascotVariantControl />);
        expect(container.innerHTML).toBe("");
        expect(getState).not.toHaveBeenCalled();
    });
});

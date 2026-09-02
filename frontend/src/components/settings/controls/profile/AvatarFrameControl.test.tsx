/**
 * Tests for AvatarFrameControl (#2850): the seven options render with
 * their lock states, selecting an unlocked frame persists and fires
 * the profile signal, and the XP purchase is a guarded two-step
 * (affordability check first - spendXp never rejects on its own).
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

import AvatarFrameControl from "./AvatarFrameControl";
import {readAvatarFrameState} from "../../../../lib/avatar/avatar-frame-store";
import {PROFILE_UPDATED_EVENT} from "../../../../lib/learning/profileSignal";

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
    getState.mockReset().mockResolvedValue(xpState(200, 3));
    listBadges.mockReset().mockResolvedValue([
        {key: "streak_3_days", earned: false},
        {key: "first_session", earned: true},
    ]);
    spendXp.mockReset().mockResolvedValue(xpState(50, 3));
    notifySuccess.mockClear();
    notifyError.mockClear();
});

async function renderControl() {
    render(<AvatarFrameControl userId="u1" />);
    await waitFor(() =>
        expect(screen.getByTestId("settings-avatar-frames")).toBeInTheDocument(),
    );
}

describe("AvatarFrameControl", () => {
    it("renders all seven frames; level/badge locks match the loaded state", async () => {
        await renderControl();
        // Level 3: bronze (L2) unlocked, silver (L5) + gold (L10) locked.
        expect(
            screen.getByTestId("settings-avatar-frame-bronze"),
        ).not.toBeDisabled();
        expect(screen.getByTestId("settings-avatar-frame-silver")).toBeDisabled();
        expect(screen.getByTestId("settings-avatar-frame-gold")).toBeDisabled();
        // Badge streak_3_days not earned -> flame locked.
        expect(screen.getByTestId("settings-avatar-frame-flame")).toBeDisabled();
        // Default always available.
        expect(
            screen.getByTestId("settings-avatar-frame-none"),
        ).not.toBeDisabled();
    });

    it("selecting an unlocked frame persists and fires the profile signal", async () => {
        const listener = vi.fn();
        window.addEventListener(PROFILE_UPDATED_EVENT, listener);
        await renderControl();
        fireEvent.click(screen.getByTestId("settings-avatar-frame-bronze"));
        expect(readAvatarFrameState("u1").selected).toBe("bronze");
        expect(listener).toHaveBeenCalled();
        expect(
            screen.getByTestId("settings-avatar-frame-bronze"),
        ).toHaveAttribute("aria-pressed", "true");
        window.removeEventListener(PROFILE_UPDATED_EVENT, listener);
    });

    it("buying an affordable XP frame is a two-step confirm that spends and selects", async () => {
        await renderControl();
        // star costs 150, total_xp 200 -> affordable.
        const buy = screen.getByTestId("settings-avatar-frame-buy-star");
        fireEvent.click(buy);
        expect(spendXp).not.toHaveBeenCalled();
        await act(async () => {
            fireEvent.click(buy);
        });
        expect(spendXp).toHaveBeenCalledWith("u1", 150, "avatar_frame");
        expect(readAvatarFrameState("u1").purchased).toContain("star");
        expect(readAvatarFrameState("u1").selected).toBe("star");
    });

    it("an unaffordable XP frame cannot be bought (spendXp clamps, so we must guard)", async () => {
        getState.mockResolvedValue(xpState(100, 3));
        await renderControl();
        // accent costs 300, total_xp 100 -> button disabled.
        expect(
            screen.getByTestId("settings-avatar-frame-buy-accent"),
        ).toBeDisabled();
        expect(spendXp).not.toHaveBeenCalled();
    });

    it("a purchased XP frame renders as selectable, not buyable", async () => {
        await renderControl();
        const buy = screen.getByTestId("settings-avatar-frame-buy-star");
        fireEvent.click(buy);
        await act(async () => {
            fireEvent.click(buy);
        });
        expect(
            screen.queryByTestId("settings-avatar-frame-buy-star"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("settings-avatar-frame-star"),
        ).not.toBeDisabled();
    });
});

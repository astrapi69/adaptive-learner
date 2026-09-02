/**
 * Tests for the Arcade page (#2887): the visible-with-reason gate
 * notice outside the game mode, the game list (memory free, snake
 * locked), the affordability guard, and the two-step XP unlock flow
 * through the shared purchase hook.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Arcade from "./Arcade";
import {setPlayfulMode} from "../../lib/learning/playful/playfulModePref";

const getState = vi.fn();
const spendXp = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        gamification: {
            getState: (...args: unknown[]) => getState(...args),
            spendXp: (...args: unknown[]) => spendXp(...args),
        },
    }),
}));

function renderArcade() {
    return render(
        <MemoryRouter>
            <Arcade />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u1");
    getState.mockResolvedValue({total_xp: 500, level: 3});
    spendXp.mockResolvedValue({total_xp: 300, level: 3});
});

describe("Arcade gate", () => {
    it("shows the settings notice while the game mode is off", () => {
        renderArcade();
        expect(screen.getByTestId("arcade-gate-notice")).toBeInTheDocument();
        expect(screen.queryByTestId("arcade-page")).not.toBeInTheDocument();
    });
});

describe("Arcade game list", () => {
    it("memory is playable, snake is locked behind the XP unlock", async () => {
        setPlayfulMode(true);
        renderArcade();
        expect(screen.getByTestId("arcade-play-memory")).toBeInTheDocument();
        expect(
            screen.queryByTestId("arcade-play-snake"),
        ).not.toBeInTheDocument();
        const unlock = screen.getByTestId("arcade-unlock-snake");
        await waitFor(() => expect(unlock).not.toBeDisabled());
        expect(unlock).toHaveTextContent("200 XP");
    });

    it("the unlock button disables when XP cannot cover the price", async () => {
        getState.mockResolvedValue({total_xp: 50, level: 1});
        setPlayfulMode(true);
        renderArcade();
        const unlock = screen.getByTestId("arcade-unlock-snake");
        expect(unlock).toBeDisabled();
        await waitFor(() => expect(getState).toHaveBeenCalled());
        expect(unlock).toBeDisabled();
    });

    it("the two-step unlock spends XP and switches snake to playable", async () => {
        setPlayfulMode(true);
        renderArcade();
        const unlock = screen.getByTestId("arcade-unlock-snake");
        await waitFor(() => expect(unlock).not.toBeDisabled());
        fireEvent.click(unlock);
        expect(unlock).toHaveTextContent("Really unlock");
        expect(spendXp).not.toHaveBeenCalled();
        fireEvent.click(unlock);
        await waitFor(() =>
            expect(spendXp).toHaveBeenCalledWith("u1", 200, "arcade_game"),
        );
        expect(
            await screen.findByTestId("arcade-play-snake"),
        ).toBeInTheDocument();
    });
});

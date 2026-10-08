/**
 * Tests for the Arcade page (#2887): the visible-with-reason gate
 * notice outside the game mode, the game list (memory free, snake
 * locked), the affordability guard, and the two-step XP unlock flow
 * through the shared purchase hook. Since #3445 an unlock is one ledger
 * event and ownership follows the ledger.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Arcade from "./Arcade";
import {awardTickets, readTicketState} from "../../lib/arcade/ticket-store";
import {setPlayfulArcade} from "../../lib/learning/playful/playfulArcadePref";
import {setPlayfulMode} from "../../lib/learning/playful/playfulModePref";
import {setPlayfulTickets} from "../../lib/learning/playful/playfulTicketsPref";

const getState = vi.fn();
const purchaseItem = vi.fn();
const listPurchases = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        gamification: {
            getState: (...args: unknown[]) => getState(...args),
            purchaseItem: (...args: unknown[]) => purchaseItem(...args),
            listPurchases: (...args: unknown[]) => listPurchases(...args),
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
    purchaseItem.mockResolvedValue({xp: {total_xp: 300, level: 3}});
    listPurchases.mockResolvedValue([]);
});

describe("Arcade gate", () => {
    it("shows the settings notice while the game mode is off, naming the game mode (#3216)", () => {
        renderArcade();
        expect(screen.getByTestId("arcade-gate-notice")).toBeInTheDocument();
        expect(screen.queryByTestId("arcade-page")).not.toBeInTheDocument();
        expect(screen.getByTestId("arcade-gate-reason")).toHaveTextContent(
            /game mode is off|Spielmodus ist aus/i,
        );
    });

    it("names the arcade switch when the game mode is on but the arcade is off (#3216)", () => {
        setPlayfulMode(true);
        setPlayfulArcade(false);
        renderArcade();
        expect(screen.getByTestId("arcade-gate-notice")).toBeInTheDocument();
        expect(screen.getByTestId("arcade-gate-reason")).toHaveTextContent(
            /arcade switch is off|Arcade-Schalter ist aus/i,
        );
        expect(screen.getByTestId("arcade-gate-reason")).not.toHaveTextContent(
            /game mode is off|Spielmodus ist aus/i,
        );
    });

    // #2961 - the gate link lands on the motivation cluster of the
    // Learning tab (where the game mode card lives), not on the tab top.
    it("links the notice to the Learning tab's motivation section", () => {
        renderArcade();
        const link = screen.getByRole("link", {name: /open settings|einstellungen öffnen/i});
        expect(link).toHaveAttribute("href", "/settings?tab=learning&section=motivation");
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
        expect(purchaseItem).not.toHaveBeenCalled();
        fireEvent.click(unlock);
        await waitFor(() =>
            expect(purchaseItem).toHaveBeenCalledWith("u1", {
                item_kind: "arcade_game",
                item_id: "snake",
                cost: 200,
            }),
        );
        expect(
            await screen.findByTestId("arcade-play-snake"),
        ).toBeInTheDocument();
    });

    it("a game unlocked in another browser is playable here (#3445)", async () => {
        setPlayfulMode(true);
        listPurchases.mockResolvedValue([
            {
                id: "p1",
                user_id: "u1",
                item_kind: "arcade_game",
                item_id: "snake",
                cost: 200,
                purchased_at: "2026-10-01T00:00:00Z",
            },
        ]);
        renderArcade();
        expect(
            await screen.findByTestId("arcade-play-snake"),
        ).toBeInTheDocument();
        expect(purchaseItem).not.toHaveBeenCalled();
    });
});

describe("Arcade tictactoe entry (#2906)", () => {
    it("lists tictactoe locked behind its 100-XP unlock", async () => {
        setPlayfulMode(true);
        renderArcade();
        expect(
            screen.queryByTestId("arcade-play-tictactoe"),
        ).not.toBeInTheDocument();
        const unlock = screen.getByTestId("arcade-unlock-tictactoe");
        await waitFor(() => expect(unlock).not.toBeDisabled());
        expect(unlock).toHaveTextContent("100 XP");
    });

    it("a ticket plays one tictactoe round", () => {
        setPlayfulMode(true);
        awardTickets("u1", 1, 5);
        renderArcade();
        fireEvent.click(
            screen.getByTestId("arcade-ticket-play-tictactoe"),
        );
        expect(screen.getByTestId("arcade-tictactoe")).toBeInTheDocument();
        expect(readTicketState("u1").tickets).toBe(0);
    });
});

describe("Arcade simon entry (#2907)", () => {
    it("lists simon locked behind its 300-XP unlock", async () => {
        setPlayfulMode(true);
        renderArcade();
        expect(
            screen.queryByTestId("arcade-play-simon"),
        ).not.toBeInTheDocument();
        const unlock = screen.getByTestId("arcade-unlock-simon");
        await waitFor(() => expect(unlock).not.toBeDisabled());
        expect(unlock).toHaveTextContent("300 XP");
    });

    it("a ticket plays one simon round", () => {
        setPlayfulMode(true);
        awardTickets("u1", 1, 5);
        renderArcade();
        fireEvent.click(screen.getByTestId("arcade-ticket-play-simon"));
        expect(screen.getByTestId("arcade-simon")).toBeInTheDocument();
        expect(readTicketState("u1").tickets).toBe(0);
    });
});

describe("Arcade ticket economy (#2889)", () => {
    it("shows the ticket balance while the economy is on", () => {
        setPlayfulMode(true);
        awardTickets("u1", 2, 5);
        renderArcade();
        expect(screen.getByTestId("arcade-tickets")).toHaveTextContent(
            "Tickets: 2",
        );
    });

    it("hides the balance when the ticket switch is off", () => {
        setPlayfulMode(true);
        setPlayfulTickets(false);
        renderArcade();
        expect(screen.queryByTestId("arcade-tickets")).not.toBeInTheDocument();
    });

    it("a ticket plays one round of the locked snake", () => {
        setPlayfulMode(true);
        awardTickets("u1", 2, 5);
        renderArcade();
        fireEvent.click(screen.getByTestId("arcade-ticket-play-snake"));
        expect(screen.getByTestId("arcade-back")).toBeInTheDocument();
        expect(readTicketState("u1").tickets).toBe(1);
    });

    it("no ticket button without a balance", () => {
        setPlayfulMode(true);
        renderArcade();
        expect(
            screen.queryByTestId("arcade-ticket-play-snake"),
        ).not.toBeInTheDocument();
    });
});

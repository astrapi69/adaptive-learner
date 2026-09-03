/**
 * Tests for the game-mode ticket-economy preference (#2889):
 * default ON, the round-trip, the 1-10 cap clamp (default 5), the
 * combined game-mode gate, and the change event.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {setPlayfulMode} from "./playfulModePref";
import {
    DEFAULT_TICKET_CAP,
    PLAYFUL_TICKETS_CHANGE_EVENT,
    clampTicketCap,
    playfulTicketsActive,
    readPlayfulTickets,
    readTicketCap,
    setPlayfulTickets,
    setTicketCap,
} from "./playfulTicketsPref";

beforeEach(() => {
    localStorage.clear();
});

describe("playfulTicketsPref", () => {
    it("defaults ON with a cap of 5", () => {
        expect(readPlayfulTickets()).toBe(true);
        expect(readTicketCap()).toBe(DEFAULT_TICKET_CAP);
        expect(readTicketCap()).toBe(5);
    });

    it("round-trips the switch and fires the change event", () => {
        const listener = vi.fn();
        window.addEventListener(PLAYFUL_TICKETS_CHANGE_EVENT, listener);
        setPlayfulTickets(false);
        expect(readPlayfulTickets()).toBe(false);
        setPlayfulTickets(true);
        expect(readPlayfulTickets()).toBe(true);
        window.removeEventListener(PLAYFUL_TICKETS_CHANGE_EVENT, listener);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["clamps below to 1", 0, 1],
        ["clamps above to 10", 99, 10],
        ["keeps an in-range value", 7, 7],
        ["rounds fractions", 4.6, 5],
        ["NaN falls back to the default", Number.NaN, 5],
    ])("%s", (_name, raw, expected) => {
        expect(clampTicketCap(raw)).toBe(expected);
    });

    it("persists the cap clamped", () => {
        setTicketCap(99);
        expect(readTicketCap()).toBe(10);
    });

    it("the gate needs the game mode AND the switch", () => {
        expect(playfulTicketsActive()).toBe(false);
        setPlayfulMode(true);
        expect(playfulTicketsActive()).toBe(true);
        setPlayfulTickets(false);
        expect(playfulTicketsActive()).toBe(false);
    });
});

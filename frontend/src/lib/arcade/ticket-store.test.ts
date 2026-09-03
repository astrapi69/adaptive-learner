/**
 * Tests for the arcade ticket store (#2889): the per-user count with
 * its configurable cap, spending, the streak-milestone bookkeeping
 * (a milestone is only consumed when its ticket was actually
 * granted), corrupt-storage tolerance, and the change event.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    ARCADE_TICKET_CHANGE_EVENT,
    awardStreakMilestoneTickets,
    awardTickets,
    readTicketState,
    spendTicket,
} from "./ticket-store";

const USER = "u1";

beforeEach(() => {
    localStorage.clear();
});

describe("ticket-store", () => {
    it("defaults to zero tickets and no awarded milestones", () => {
        expect(readTicketState(USER)).toEqual({tickets: 0, milestones: []});
    });

    it("awardTickets adds up to the cap and reports what was granted", () => {
        expect(awardTickets(USER, 2, 5)).toBe(2);
        expect(readTicketState(USER).tickets).toBe(2);
        expect(awardTickets(USER, 9, 5)).toBe(3);
        expect(readTicketState(USER).tickets).toBe(5);
        expect(awardTickets(USER, 1, 5)).toBe(0);
    });

    it("spendTicket decrements and refuses at zero", () => {
        awardTickets(USER, 1, 5);
        expect(spendTicket(USER)).toBe(true);
        expect(readTicketState(USER).tickets).toBe(0);
        expect(spendTicket(USER)).toBe(false);
    });

    it("milestones grant one ticket each and are recorded once", () => {
        expect(awardStreakMilestoneTickets(USER, 8, 5)).toBe(2);
        expect(readTicketState(USER)).toEqual({
            tickets: 2,
            milestones: [3, 7],
        });
        expect(awardStreakMilestoneTickets(USER, 8, 5)).toBe(0);
    });

    it("a milestone blocked by the cap stays available for later", () => {
        awardTickets(USER, 5, 5);
        expect(awardStreakMilestoneTickets(USER, 3, 5)).toBe(0);
        expect(readTicketState(USER).milestones).toEqual([]);
        spendTicket(USER);
        expect(awardStreakMilestoneTickets(USER, 3, 5)).toBe(1);
        expect(readTicketState(USER).milestones).toEqual([3]);
    });

    it("tickets are per user", () => {
        awardTickets(USER, 2, 5);
        expect(readTicketState("other").tickets).toBe(0);
    });

    it("tolerates corrupt storage", () => {
        localStorage.setItem("adaptive-learner.arcade.tickets", "{nope");
        expect(readTicketState(USER)).toEqual({tickets: 0, milestones: []});
        expect(awardTickets(USER, 1, 5)).toBe(1);
        expect(readTicketState(USER).tickets).toBe(1);
    });

    it("every write dispatches the change event", () => {
        const listener = vi.fn();
        window.addEventListener(ARCADE_TICKET_CHANGE_EVENT, listener);
        awardTickets(USER, 1, 5);
        spendTicket(USER);
        window.removeEventListener(ARCADE_TICKET_CHANGE_EVENT, listener);
        expect(listener).toHaveBeenCalledTimes(2);
    });
});

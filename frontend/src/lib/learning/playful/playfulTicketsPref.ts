/**
 * Game-mode ticket-economy preference (#2889).
 *
 * The ticket economy (arcade tickets earned by performance) DEFAULTS
 * ON while the game mode is active - the switch exists so the arcade
 * can fall back to the pure XP-purchase path. The savable-ticket cap
 * rides along (1-10, default 5).
 *
 * Same localStorage pattern as the sibling prefs in this folder.
 */

import {readPlayfulMode} from "./playfulModePref";

const TICKETS_KEY = "adaptive-learner.lesson.playful_tickets";
const TICKET_CAP_KEY = "adaptive-learner.lesson.playful_ticket_cap";

/** Dispatched on the window when either value changes in this tab. */
export const PLAYFUL_TICKETS_CHANGE_EVENT =
    "adaptive-learner:playful-tickets-pref";

export const DEFAULT_TICKET_CAP = 5;
export const MIN_TICKET_CAP = 1;
export const MAX_TICKET_CAP = 10;

function _notify(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(PLAYFUL_TICKETS_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

/** Whether the ticket economy is on - DEFAULT ON (only "false" disables). */
export function readPlayfulTickets(): boolean {
    try {
        return localStorage.getItem(TICKETS_KEY) !== "false";
    } catch {
        return true;
    }
}

/** Persist the ticket switch + dispatch the change event. */
export function setPlayfulTickets(on: boolean): void {
    try {
        localStorage.setItem(TICKETS_KEY, on ? "true" : "false");
    } catch {
        /* no-op */
    }
    _notify();
}

/** Clamp a ticket cap into [1, 10]; non-numbers fall back to 5. */
export function clampTicketCap(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_TICKET_CAP;
    return Math.min(
        MAX_TICKET_CAP,
        Math.max(MIN_TICKET_CAP, Math.round(raw)),
    );
}

/** The configured savable-ticket cap (clamped). */
export function readTicketCap(): number {
    try {
        const raw = localStorage.getItem(TICKET_CAP_KEY);
        if (raw === null) return DEFAULT_TICKET_CAP;
        return clampTicketCap(Number(raw));
    } catch {
        return DEFAULT_TICKET_CAP;
    }
}

/** Persist the ticket cap (clamped) + dispatch the change event. */
export function setTicketCap(cap: number): void {
    try {
        localStorage.setItem(TICKET_CAP_KEY, String(clampTicketCap(cap)));
    } catch {
        /* no-op */
    }
    _notify();
}

/** The ticket gate: game mode on AND the switch not disabled. */
export function playfulTicketsActive(): boolean {
    return readPlayfulMode() && readPlayfulTickets();
}

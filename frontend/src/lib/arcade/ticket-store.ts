/**
 * Mode-agnostic arcade ticket store (#2889) - the game-mode ticket
 * economy's browser-local home, following the sibling stores'
 * pattern (``arcade-unlock-store`` / ``selection-store``): ONE
 * localStorage map keyed by userId, write-through mirrored into the
 * Dexie ``userData`` canonical store so the balance survives a
 * restore and rides the ``.alb`` backup's localStorage snapshot
 * (the key is registered in ``MANAGED_USER_DATA_KEYS``).
 *
 * A milestone is only recorded as awarded when its ticket was
 * actually granted - a cap-blocked milestone stays available and is
 * granted on a later check once a ticket slot is free (the cap
 * limits hoarding, it never voids earned rewards).
 */

import {mirrorUserData} from "../../storage/dexie/dexie-user-data";
import {newStreakMilestones} from "./ticket-rules";

const STORAGE_KEY = "adaptive-learner.arcade.tickets";

/** ``window`` event fired after every write - the live-update hook. */
export const ARCADE_TICKET_CHANGE_EVENT = `${STORAGE_KEY}:changed`;

export interface TicketState {
    /** Spendable tickets, 0..cap. */
    tickets: number;
    /** Streak milestones already turned into a ticket. */
    milestones: number[];
}

function defaultState(): TicketState {
    return {tickets: 0, milestones: []};
}

function isTicketState(value: unknown): value is TicketState {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.tickets === "number" &&
        Array.isArray(candidate.milestones) &&
        candidate.milestones.every((m) => typeof m === "number")
    );
}

function readMap(): Record<string, TicketState> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const out: Record<string, TicketState> = {};
        for (const [key, val] of Object.entries(
            parsed as Record<string, unknown>,
        )) {
            if (isTicketState(val)) out[key] = val;
        }
        return out;
    } catch {
        return {};
    }
}

function writeMap(map: Record<string, TicketState>): void {
    try {
        const raw = JSON.stringify(map);
        localStorage.setItem(STORAGE_KEY, raw);
        void mirrorUserData(STORAGE_KEY, raw);
    } catch {
        /* quota / disabled storage - worst case the balance resets */
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(ARCADE_TICKET_CHANGE_EVENT));
    }
}

/** The stored ticket state for ``userId`` (default: empty). */
export function readTicketState(userId: string): TicketState {
    const entry = readMap()[userId];
    return entry
        ? {tickets: entry.tickets, milestones: [...entry.milestones]}
        : defaultState();
}

/**
 * Grant up to ``count`` tickets, clamped at ``cap``; returns how many
 * were actually granted (0 when already at the cap).
 */
export function awardTickets(
    userId: string,
    count: number,
    cap: number,
): number {
    if (count <= 0) return 0;
    const map = readMap();
    const current = map[userId] ?? defaultState();
    const granted = Math.max(
        0,
        Math.min(count, cap - current.tickets),
    );
    if (granted === 0) return 0;
    map[userId] = {...current, tickets: current.tickets + granted};
    writeMap(map);
    return granted;
}

/** Spend one ticket; false when the balance is empty. */
export function spendTicket(userId: string): boolean {
    const map = readMap();
    const current = map[userId] ?? defaultState();
    if (current.tickets <= 0) return false;
    map[userId] = {...current, tickets: current.tickets - 1};
    writeMap(map);
    return true;
}

/**
 * Grant one ticket per newly reached streak milestone (3/7/14/30),
 * recording only the milestones whose ticket fit under ``cap`` so a
 * blocked one is retried later. Returns the number granted.
 */
export function awardStreakMilestoneTickets(
    userId: string,
    streakDays: number,
    cap: number,
): number {
    const map = readMap();
    const current = map[userId] ?? defaultState();
    const reached = newStreakMilestones(streakDays, current.milestones);
    const granted = Math.max(
        0,
        Math.min(reached.length, cap - current.tickets),
    );
    if (granted === 0) return 0;
    map[userId] = {
        tickets: current.tickets + granted,
        milestones: [...current.milestones, ...reached.slice(0, granted)],
    };
    writeMap(map);
    return granted;
}

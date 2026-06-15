/**
 * Pure builders for the user-initiated event report (EXP-028).
 *
 * Kept free of DOM/storage so they stay unit-testable: the dialog
 * resolves the events + description and passes them in; the browser
 * download is a thin wrapper around these strings.
 */

import {
    type AppStateSnapshot,
    type EventCategory,
    type RecordedEvent,
    categoryFor,
} from "./eventRecorder";

/** Inputs for the JSON report twin (EVT-05). */
export interface EventReportInput {
    events: RecordedEvent[];
    /** Optional free-text the user typed (steps to reproduce). */
    description?: string;
    /** Error message when the report was opened reactively. */
    errorMessage?: string;
    /** App version literal (``__APP_VERSION__``). */
    appVersion: string;
    /** Build timestamp; injectable for deterministic tests. */
    now?: Date;
}

/**
 * The most recent app-state snapshot carried by any error event
 * in the buffer, or ``null`` when none was captured (EVT-02).
 */
export function latestAppState(events: RecordedEvent[]): AppStateSnapshot | null {
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].appState) return events[i].appState ?? null;
    }
    return null;
}

/** Distinct categories present in the buffer, in encounter order. */
export function presentCategories(events: RecordedEvent[]): EventCategory[] {
    const seen = new Set<EventCategory>();
    const out: EventCategory[] = [];
    for (const ev of events) {
        const cat = categoryFor(ev);
        if (!seen.has(cat)) {
            seen.add(cat);
            out.push(cat);
        }
    }
    return out;
}

/** Filter events to a single category (``null`` = all). */
export function filterByCategory(
    events: RecordedEvent[],
    category: EventCategory | null,
): RecordedEvent[] {
    if (category === null) return events;
    return events.filter((ev) => categoryFor(ev) === category);
}

/**
 * Build the structured JSON report: metadata + the latest app-state
 * snapshot + the raw recorded events (EVT-05). Stable, machine-readable.
 */
export function buildEventReportJson(input: EventReportInput): string {
    const now = input.now ?? new Date();
    const report = {
        meta: {
            generatedAt: now.toISOString(),
            appVersion: input.appVersion,
            eventCount: input.events.length,
            description: input.description?.trim() || null,
            errorMessage: input.errorMessage || null,
        },
        appState: latestAppState(input.events),
        events: input.events,
    };
    return JSON.stringify(report, null, 2);
}

/** Filename for the JSON download, e.g. ``event-report-2026-06-15.json``. */
export function eventReportFilename(now?: Date): string {
    const d = now ?? new Date();
    return `event-report-${d.toISOString().slice(0, 10)}.json`;
}

/**
 * Tests for the pure event-report builders (EXP-028, EVT-05).
 */

import {describe, it, expect} from "vitest";

import type {RecordedEvent} from "./eventRecorder";
import {
    buildEventReportJson,
    eventReportFilename,
    filterByCategory,
    latestAppState,
    presentCategories,
} from "./event-report";

const sample: RecordedEvent[] = [
    {type: "navigation", timestamp: 1, to: "/dashboard", category: "navigation"},
    {type: "click", timestamp: 2, text: "Save", category: "ui"},
    {type: "api_call", timestamp: 3, endpoint: "/api/x", category: "network"},
    {
        type: "uncaught_error",
        timestamp: 4,
        message: "boom",
        category: "error",
        appState: {storageMode: "dexie", language: "de", online: true},
    },
];

describe("latestAppState", () => {
    it("returns the most recent snapshot", () => {
        expect(latestAppState(sample)).toEqual({
            storageMode: "dexie",
            language: "de",
            online: true,
        });
    });

    it("returns null when no event carries a snapshot", () => {
        expect(latestAppState(sample.slice(0, 3))).toBeNull();
    });
});

describe("presentCategories", () => {
    it("lists distinct categories in encounter order", () => {
        expect(presentCategories(sample)).toEqual([
            "navigation",
            "ui",
            "network",
            "error",
        ]);
    });

    it("derives the category when not explicitly set", () => {
        expect(
            presentCategories([{type: "api_error", timestamp: 1}]),
        ).toEqual(["network"]);
    });
});

describe("filterByCategory", () => {
    it("returns all events when category is null", () => {
        expect(filterByCategory(sample, null)).toHaveLength(4);
    });

    it("filters to a single category", () => {
        const out = filterByCategory(sample, "network");
        expect(out).toHaveLength(1);
        expect(out[0].endpoint).toBe("/api/x");
    });
});

describe("buildEventReportJson", () => {
    const now = new Date("2026-06-15T10:00:00Z");

    it("produces parseable JSON with meta + snapshot + events", () => {
        const json = buildEventReportJson({
            events: sample,
            description: "  I clicked save  ",
            errorMessage: "boom",
            appVersion: "1.81.0",
            now,
        });
        const parsed = JSON.parse(json);
        expect(parsed.meta.appVersion).toBe("1.81.0");
        expect(parsed.meta.eventCount).toBe(4);
        expect(parsed.meta.description).toBe("I clicked save");
        expect(parsed.meta.generatedAt).toBe("2026-06-15T10:00:00.000Z");
        expect(parsed.appState.language).toBe("de");
        expect(parsed.events).toHaveLength(4);
    });

    it("nulls an empty description", () => {
        const parsed = JSON.parse(
            buildEventReportJson({events: [], appVersion: "1", now}),
        );
        expect(parsed.meta.description).toBeNull();
        expect(parsed.appState).toBeNull();
    });
});

describe("eventReportFilename", () => {
    it("includes the ISO date", () => {
        expect(eventReportFilename(new Date("2026-06-15T10:00:00Z"))).toBe(
            "event-report-2026-06-15.json",
        );
    });
});

/**
 * Tests for the event-recorder ring buffer + sanitizer + formatter.
 *
 * Privacy contract is load-bearing: the sanitizer redacts sensitive
 * fields, strips URL query params, and truncates long text. These
 * tests pin the contract so any regression (a new EventType field,
 * a relaxed regex, etc.) fails loudly.
 */

import {describe, it, expect, beforeEach, afterEach} from "vitest";

import {
    EventRingBuffer,
    categoryFor,
    eventRecorder,
    formatEventLog,
    sanitizeEvent,
    setAppStateProvider,
    type RecordedEvent,
} from "./eventRecorder";

beforeEach(() => {
    eventRecorder.clear();
});

// --- Ring Buffer ---

describe("EventRingBuffer", () => {
    it("adds and retrieves events", () => {
        eventRecorder.add({type: "click", timestamp: 1000, text: "Save"});
        expect(eventRecorder.size()).toBe(1);
        expect(eventRecorder.getAll()[0].text).toBe("Save");
    });

    it("respects max size of 100", () => {
        for (let i = 0; i < 120; i++) {
            eventRecorder.add({
                type: "click",
                timestamp: i * 100,
                text: `btn-${i}`,
            });
        }
        expect(eventRecorder.size()).toBe(100);
        // Oldest 20 events are dropped.
        expect(eventRecorder.getAll()[0].text).toBe("btn-20");
        expect(eventRecorder.getAll()[99].text).toBe("btn-119");
    });

    it("clear empties the buffer", () => {
        eventRecorder.add({type: "click", timestamp: 0, text: "x"});
        eventRecorder.clear();
        expect(eventRecorder.size()).toBe(0);
    });

    it("getAll returns a copy, not a reference", () => {
        eventRecorder.add({type: "click", timestamp: 0, text: "a"});
        const copy = eventRecorder.getAll();
        copy.pop();
        expect(eventRecorder.size()).toBe(1);
    });
});

// --- Sanitizer ---

describe("sanitizeEvent", () => {
    it("redacts fields matching sensitive patterns (api_key)", () => {
        const ev: RecordedEvent = {
            type: "dropdown_change",
            timestamp: 0,
            field: "api_key",
            value: "sk_secret_123",
        };
        expect(sanitizeEvent(ev).value).toBe("[REDACTED]");
    });

    it("redacts password fields", () => {
        const ev: RecordedEvent = {
            type: "dropdown_change",
            timestamp: 0,
            field: "password",
            value: "hunter2",
        };
        expect(sanitizeEvent(ev).value).toBe("[REDACTED]");
    });

    it("redacts license fields", () => {
        const ev: RecordedEvent = {
            type: "dropdown_change",
            timestamp: 0,
            field: "license_key",
            value: "ABCD-1234",
        };
        expect(sanitizeEvent(ev).value).toBe("[REDACTED]");
    });

    it("redacts token fields", () => {
        const ev: RecordedEvent = {
            type: "dropdown_change",
            timestamp: 0,
            field: "auth_token",
            value: "bearer.value",
        };
        expect(sanitizeEvent(ev).value).toBe("[REDACTED]");
    });

    it("redacts secret fields", () => {
        const ev: RecordedEvent = {
            type: "dropdown_change",
            timestamp: 0,
            field: "client_secret",
            value: "very-secret",
        };
        expect(sanitizeEvent(ev).value).toBe("[REDACTED]");
    });

    it("redacts text containing token/key references", () => {
        const ev: RecordedEvent = {
            type: "click",
            timestamp: 0,
            text: "Save API Key",
        };
        expect(sanitizeEvent(ev).text).toBe("[REDACTED]");
    });

    it("strips query params from endpoints", () => {
        const ev: RecordedEvent = {
            type: "api_call",
            timestamp: 0,
            endpoint: "/api/projects?secret=abc&lang=de",
        };
        expect(sanitizeEvent(ev).endpoint).toBe("/api/projects");
    });

    it("strips query params from the navigation 'to' field", () => {
        const ev: RecordedEvent = {
            type: "navigation",
            timestamp: 0,
            from: "/dashboard",
            to: "/session?id=abc&token=xyz",
        };
        expect(sanitizeEvent(ev).to).toBe("/session");
    });

    it("truncates long text to 200 chars + '...' marker", () => {
        const longText = "x".repeat(500);
        const ev: RecordedEvent = {type: "click", timestamp: 0, text: longText};
        const sanitized = sanitizeEvent(ev);
        expect(sanitized.text!.length).toBeLessThanOrEqual(203);
        expect(sanitized.text!.endsWith("...")).toBe(true);
    });

    it("truncates long messages", () => {
        const ev: RecordedEvent = {
            type: "toast",
            timestamp: 0,
            message: "e".repeat(300),
        };
        expect(sanitizeEvent(ev).message!.length).toBeLessThanOrEqual(203);
    });

    it("leaves non-sensitive events untouched", () => {
        const ev: RecordedEvent = {
            type: "click",
            timestamp: 1234,
            text: "Export",
        };
        expect(sanitizeEvent(ev)).toEqual(ev);
    });

    it("is the same shape as ring-buffer.add output (round-trip pin)", () => {
        // Privacy round-trip: a recorded sensitive event in the
        // buffer must be redacted by the time it lands.
        eventRecorder.add({
            type: "dropdown_change",
            timestamp: 0,
            field: "api_key",
            value: "sk_live_xxx",
        });
        const captured = eventRecorder.getAll()[0];
        expect(captured.value).toBe("[REDACTED]");
        // And the formatter does not re-leak the value.
        expect(formatEventLog([captured])).not.toContain("sk_live_xxx");
    });
});

// --- Formatter ---

describe("formatEventLog", () => {
    it("formats click events with HH:MM:SS", () => {
        const events: RecordedEvent[] = [
            {type: "click", timestamp: 3661000, text: "Save"},
        ];
        const log = formatEventLog(events);
        expect(log).toContain("01:01:01");
        expect(log).toContain('Click: "Save"');
    });

    it("formats navigation events", () => {
        const events: RecordedEvent[] = [
            {
                type: "navigation",
                timestamp: 0,
                from: "/dashboard",
                to: "/session",
            },
        ];
        expect(formatEventLog(events)).toContain("/dashboard -> /session");
    });

    it("formats API calls with status and duration", () => {
        const events: RecordedEvent[] = [
            {
                type: "api_call",
                timestamp: 0,
                method: "POST",
                endpoint: "/api/users",
                status: 201,
                durationMs: 42,
            },
        ];
        expect(formatEventLog(events)).toContain(
            "POST /api/users -> 201 (42ms)",
        );
    });

    it("formats toast messages", () => {
        const events: RecordedEvent[] = [
            {
                type: "toast",
                timestamp: 0,
                level: "error",
                message: "Session failed",
            },
        ];
        expect(formatEventLog(events)).toContain(
            'Toast: error "Session failed"',
        );
    });

    it("formats api_error events", () => {
        const events: RecordedEvent[] = [
            {
                type: "api_error",
                timestamp: 0,
                method: "POST",
                endpoint: "/api/projects",
                message: "Network down",
            },
        ];
        expect(formatEventLog(events)).toContain(
            "API Error: POST /api/projects -> Network down",
        );
    });
});

// --- Category taxonomy (EVT-01) ---

describe("categoryFor", () => {
    it("maps navigation to navigation", () => {
        expect(categoryFor({type: "navigation", timestamp: 0})).toBe(
            "navigation",
        );
    });

    it("maps api_call / api_error to network", () => {
        expect(categoryFor({type: "api_call", timestamp: 0})).toBe("network");
        expect(categoryFor({type: "api_error", timestamp: 0})).toBe("network");
    });

    it("maps uncaught_error / unhandled_rejection to error", () => {
        expect(categoryFor({type: "uncaught_error", timestamp: 0})).toBe(
            "error",
        );
        expect(categoryFor({type: "unhandled_rejection", timestamp: 0})).toBe(
            "error",
        );
    });

    it("maps clicks / dialogs to ui", () => {
        expect(categoryFor({type: "click", timestamp: 0})).toBe("ui");
        expect(categoryFor({type: "dialog_open", timestamp: 0})).toBe("ui");
    });

    it("classifies an error-level toast as error, others as ui", () => {
        expect(
            categoryFor({type: "toast", timestamp: 0, level: "error"}),
        ).toBe("error");
        expect(
            categoryFor({type: "toast", timestamp: 0, level: "info"}),
        ).toBe("ui");
    });

    it("honours an explicit category override", () => {
        expect(
            categoryFor({
                type: "click",
                timestamp: 0,
                category: "exercise",
            }),
        ).toBe("exercise");
    });

    it("add() fills category from the lookup", () => {
        eventRecorder.add({type: "navigation", timestamp: 1, to: "/x"});
        expect(eventRecorder.getAll()[0].category).toBe("navigation");
    });
});

// --- App-state snapshot (EVT-02) ---

describe("app-state snapshot", () => {
    afterEach(() => setAppStateProvider(null));

    it("attaches a snapshot to error-category events", () => {
        setAppStateProvider(() => ({
            storageMode: "dexie",
            language: "fr",
            online: false,
        }));
        eventRecorder.add({
            type: "uncaught_error",
            timestamp: 1,
            message: "boom",
        });
        const ev = eventRecorder.getAll()[0];
        expect(ev.appState).toEqual({
            storageMode: "dexie",
            language: "fr",
            online: false,
        });
    });

    it("does not attach a snapshot to non-error events", () => {
        setAppStateProvider(() => ({
            storageMode: "api",
            language: "de",
            online: true,
        }));
        eventRecorder.add({type: "click", timestamp: 1, text: "Save"});
        expect(eventRecorder.getAll()[0].appState).toBeUndefined();
    });

    it("survives a throwing provider without losing the event", () => {
        setAppStateProvider(() => {
            throw new Error("nope");
        });
        eventRecorder.add({
            type: "uncaught_error",
            timestamp: 1,
            message: "boom",
        });
        expect(eventRecorder.size()).toBe(1);
        expect(eventRecorder.getAll()[0].appState).toBeUndefined();
    });
});

// --- Persistence (EVT-03) ---

describe("sessionStorage persistence", () => {
    beforeEach(() => sessionStorage.clear());
    afterEach(() => sessionStorage.clear());

    it("reloads the buffer from sessionStorage on construction", () => {
        const a = new EventRingBuffer();
        a.clear();
        a.add({type: "uncaught_error", timestamp: 1, message: "crash"});
        // A fresh instance (simulating a reload) loads the persisted state.
        const b = new EventRingBuffer();
        expect(b.size()).toBe(1);
        expect(b.getAll()[0].message).toBe("crash");
    });

    it("clear() empties the persisted store too", () => {
        const a = new EventRingBuffer();
        a.add({type: "uncaught_error", timestamp: 1, message: "crash"});
        a.clear();
        const b = new EventRingBuffer();
        expect(b.size()).toBe(0);
    });

    it("caps the reloaded buffer at the max size", () => {
        const seed: RecordedEvent[] = [];
        for (let i = 0; i < 150; i++) {
            seed.push({type: "click", timestamp: i, text: `b${i}`});
        }
        sessionStorage.setItem(
            "adaptive-learner.event-buffer",
            JSON.stringify(seed),
        );
        const b = new EventRingBuffer();
        expect(b.size()).toBe(100);
        expect(b.getAll()[0].text).toBe("b50");
    });

    it("ignores a corrupt persisted payload", () => {
        sessionStorage.setItem("adaptive-learner.event-buffer", "not json{");
        const b = new EventRingBuffer();
        expect(b.size()).toBe(0);
    });
});

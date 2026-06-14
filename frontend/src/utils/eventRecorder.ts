/**
 * Event recorder for error reporting.
 *
 * Records user actions (clicks, navigation, API calls, toasts) in a
 * fixed-size ring buffer. The buffer lives in RAM only — nothing is
 * persisted, nothing is sent to any server, and everything is lost on
 * tab close.
 *
 * The recorded history is only used when the user explicitly clicks
 * "Issue melden" / "Report Issue" and opts in to including the action
 * history in the GitHub issue body.
 *
 * Privacy guarantees:
 * - No keyboard input is ever recorded
 * - No textarea/editor content is ever recorded
 * - Fields matching sensitive patterns (password, token, key, license,
 *   secret, api_key, credential) are redacted before entering the buffer
 * - URL query parameters are stripped
 * - All text is truncated to 200 chars max
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType =
    | "click"
    | "navigation"
    | "dialog_open"
    | "dialog_close"
    | "dropdown_change"
    | "checkbox_change"
    | "file_upload"
    | "api_call"
    | "api_error"
    | "toast"
    | "uncaught_error"
    | "unhandled_rejection";

export interface RecordedEvent {
    type: EventType;
    /** Milliseconds since page load (performance.now). */
    timestamp: number;
    /** Human-readable label (button text, dialog title, field name). */
    text?: string;
    /** data-testid of the element if present. */
    testId?: string;
    /** HTTP method for API calls. */
    method?: string;
    /** URL path (no query params, no host). */
    endpoint?: string;
    /** HTTP status code. */
    status?: number;
    /** Duration in ms for API calls. */
    durationMs?: number;
    /** Changed value for dropdowns/checkboxes. */
    value?: string;
    /** Field name for form interactions. */
    field?: string;
    /** Error message or toast text. */
    message?: string;
    /** Toast level (info/success/warning/error). */
    level?: string;
    /** Source file for uncaught errors. */
    source?: string;
    /** Line number for uncaught errors. */
    line?: number;
    /** Old and new path for navigation. */
    from?: string;
    to?: string;
}

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

const SENSITIVE_FIELD = /password|token|api.?key|secret|license|credential/i;
const MAX_TEXT_LENGTH = 200;

export function sanitizeEvent(event: RecordedEvent): RecordedEvent {
    const copy = {...event};

    // Redact values that look like credentials
    if (copy.field && SENSITIVE_FIELD.test(copy.field)) {
        copy.value = "[REDACTED]";
    }
    if (copy.text && SENSITIVE_FIELD.test(copy.text)) {
        copy.text = "[REDACTED]";
    }

    // Strip query params from URLs
    if (copy.endpoint) {
        try {
            const url = new URL(copy.endpoint, "http://localhost");
            copy.endpoint = url.pathname;
        } catch {
            // not a URL, leave as-is
        }
    }
    if (copy.to) {
        try {
            copy.to = new URL(copy.to, "http://localhost").pathname;
        } catch {
            /* ignore */
        }
    }

    // Truncate long text
    if (copy.text && copy.text.length > MAX_TEXT_LENGTH) {
        copy.text = copy.text.substring(0, MAX_TEXT_LENGTH) + "...";
    }
    if (copy.message && copy.message.length > MAX_TEXT_LENGTH) {
        copy.message = copy.message.substring(0, MAX_TEXT_LENGTH) + "...";
    }

    return copy;
}

// ---------------------------------------------------------------------------
// Ring Buffer
// ---------------------------------------------------------------------------

const MAX_BUFFER_SIZE = 100;

class EventRingBuffer {
    private buffer: RecordedEvent[] = [];

    add(event: RecordedEvent): void {
        const sanitized = sanitizeEvent(event);
        this.buffer.push(sanitized);
        if (this.buffer.length > MAX_BUFFER_SIZE) {
            this.buffer.shift();
        }
    }

    getAll(): RecordedEvent[] {
        return [...this.buffer];
    }

    size(): number {
        return this.buffer.length;
    }

    clear(): void {
        this.buffer = [];
    }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Global event recorder instance. Import and use from anywhere. */
export const eventRecorder = new EventRingBuffer();

// ---------------------------------------------------------------------------
// Formatter (for the preview dialog)
// ---------------------------------------------------------------------------

/** Format a timestamp (performance.now ms) as HH:MM:SS. */
function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Per-event-type line formatters, keyed by ``EventType``. Each owns its
 *  own ``||`` / ``?:`` fallbacks in its own scope, so ``formatEvent`` stays
 *  a thin lookup. ``time`` is the pre-formatted ``HH:MM:SS`` prefix. */
const EVENT_FORMATTERS: Record<
    EventType,
    (ev: RecordedEvent, time: string) => string
> = {
    click: (ev, time) =>
        `${time}  Click: "${ev.text || "?"}"${ev.testId ? ` [${ev.testId}]` : ""}`,
    navigation: (ev, time) =>
        `${time}  Navigation: ${ev.from || "?"} -> ${ev.to || "?"}`,
    dialog_open: (ev, time) => `${time}  Dialog opened: "${ev.text || "?"}"`,
    dialog_close: (ev, time) => `${time}  Dialog closed: "${ev.text || "?"}"`,
    dropdown_change: (ev, time) =>
        `${time}  Dropdown: ${ev.field || "?"} = "${ev.value || "?"}"`,
    checkbox_change: (ev, time) =>
        `${time}  Checkbox: ${ev.field || "?"} = ${ev.value || "?"}`,
    file_upload: (ev, time) =>
        `${time}  Upload: ${ev.text || "File"} (${ev.value || "?"})`,
    api_call: (ev, time) =>
        `${time}  API: ${ev.method || "?"} ${ev.endpoint || "?"} -> ${ev.status || "?"} (${ev.durationMs || 0}ms)`,
    api_error: (ev, time) =>
        `${time}  API Error: ${ev.method || "?"} ${ev.endpoint || "?"} -> ${ev.message || "?"}`,
    toast: (ev, time) => `${time}  Toast: ${ev.level || "?"} "${ev.message || "?"}"`,
    uncaught_error: (ev, time) =>
        `${time}  Uncaught Error: ${ev.message || "?"} (${ev.source || "?"}:${ev.line || "?"})`,
    unhandled_rejection: (ev, time) =>
        `${time}  Unhandled Rejection: ${ev.message || "?"}`,
};

/** Format one recorded event into its log line. */
function formatEvent(ev: RecordedEvent): string {
    const time = formatTime(ev.timestamp);
    const formatter = EVENT_FORMATTERS[ev.type];
    return formatter
        ? formatter(ev, time)
        : `${time}  ${ev.type}: ${ev.text || ev.message || ""}`;
}

/** Render the event buffer as a human-readable multi-line string. */
export function formatEventLog(events?: RecordedEvent[]): string {
    const items = events || eventRecorder.getAll();
    return items.map(formatEvent).join("\n");
}

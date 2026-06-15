/**
 * Event recorder for error reporting.
 *
 * Records user actions (clicks, navigation, API calls, toasts) in a
 * fixed-size ring buffer. The buffer is mirrored write-through into
 * ``sessionStorage`` (EVT-03) so it survives a reload / crash-reload
 * but still dies with the tab. Nothing is sent to any server.
 *
 * The recorded history is only used when the user explicitly clicks
 * "Issue melden" / "Report Issue" (reactive) or opens the proactive
 * "Create error report" entry in Settings, and opts in to including
 * the action history.
 *
 * Privacy guarantees:
 * - No keyboard input is ever recorded
 * - No textarea/editor content is ever recorded
 * - Fields matching sensitive patterns (password, token, key, license,
 *   secret, api_key, credential) are redacted before entering the buffer
 * - URL query parameters are stripped
 * - All text is truncated to 200 chars max
 * - Exercise events (when instrumented) carry only IDs / boolean flags,
 *   never the learner's answer or the expected text (EXP-028 §4.3)
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

/**
 * Coarse classification over the fine-grained {@link EventType} (EVT-01).
 * Used to filter and group the action history in the report preview.
 */
export type EventCategory =
    | "navigation"
    | "exercise"
    | "storage"
    | "error"
    | "network"
    | "ui";

/**
 * Minimal app-state context attached to ``error``-category events
 * (EVT-02). No PII, no deep clone — just the three signals that
 * place a bug: storage mode, UI language, online/offline.
 */
export interface AppStateSnapshot {
    storageMode: string;
    language: string;
    online: boolean;
}

export interface RecordedEvent {
    type: EventType;
    /** Milliseconds since page load (performance.now). */
    timestamp: number;
    /** Coarse category, derived from ``type`` when not set (EVT-01). */
    category?: EventCategory;
    /** App-state snapshot, attached on ``error``-category events (EVT-02). */
    appState?: AppStateSnapshot;
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
// Category taxonomy (EVT-01)
// ---------------------------------------------------------------------------

/**
 * Maps each fine-grained {@link EventType} onto its coarse
 * {@link EventCategory}. A ``toast`` is classified as ``error`` only
 * when its level is ``error`` (see {@link categoryFor}); the table
 * value is its default (``ui``).
 */
const EVENT_CATEGORIES: Record<EventType, EventCategory> = {
    navigation: "navigation",
    api_call: "network",
    api_error: "network",
    uncaught_error: "error",
    unhandled_rejection: "error",
    click: "ui",
    dialog_open: "ui",
    dialog_close: "ui",
    dropdown_change: "ui",
    checkbox_change: "ui",
    file_upload: "ui",
    toast: "ui",
};

/** Every category, in display order. Exported for the filter UI. */
export const EVENT_CATEGORY_ORDER: EventCategory[] = [
    "navigation",
    "ui",
    "network",
    "storage",
    "exercise",
    "error",
];

/**
 * Resolve the coarse category for an event. Honours an explicit
 * ``category`` when present, otherwise derives it from ``type`` —
 * with the one nuance that an error-level ``toast`` counts as
 * ``error`` rather than ``ui``.
 */
export function categoryFor(event: RecordedEvent): EventCategory {
    if (event.category) return event.category;
    if (event.type === "toast" && event.level === "error") return "error";
    return EVENT_CATEGORIES[event.type] ?? "ui";
}

// ---------------------------------------------------------------------------
// App-state provider (EVT-02)
// ---------------------------------------------------------------------------

type AppStateProvider = () => AppStateSnapshot;

let appStateProvider: AppStateProvider | null = null;

/**
 * Inject the app-state provider. Called once from a root-mounted
 * component (``EventRecorderSetup``) so the recorder itself stays
 * dependency-free — importing the storage barrel here would create
 * an import cycle (storage → api client → eventRecorder).
 */
export function setAppStateProvider(provider: AppStateProvider | null): void {
    appStateProvider = provider;
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
// Persistence (EVT-03): write-through to sessionStorage
// ---------------------------------------------------------------------------

const STORAGE_KEY = "adaptive-learner.event-buffer";
const FLUSH_THROTTLE_MS = 500;

/** Safe accessor — ``sessionStorage`` can throw (privacy mode, SSR). */
function safeSessionStorage(): Storage | null {
    try {
        return typeof sessionStorage !== "undefined" ? sessionStorage : null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Ring Buffer
// ---------------------------------------------------------------------------

const MAX_BUFFER_SIZE = 100;

export class EventRingBuffer {
    private buffer: RecordedEvent[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.buffer = this.load();
    }

    add(event: RecordedEvent): void {
        const sanitized = sanitizeEvent(event);
        sanitized.category = categoryFor(sanitized);

        // App-state snapshot on error-category events only (EVT-02).
        if (
            sanitized.category === "error" &&
            !sanitized.appState &&
            appStateProvider
        ) {
            try {
                sanitized.appState = appStateProvider();
            } catch {
                /* never let snapshot capture break recording */
            }
        }

        this.buffer.push(sanitized);
        if (this.buffer.length > MAX_BUFFER_SIZE) {
            this.buffer.shift();
        }

        // Error events flush immediately so a directly-following
        // reload keeps the crash context; everything else is
        // throttled to keep the click hot-path free (EVT-03).
        if (sanitized.category === "error") {
            this.flushNow();
        } else {
            this.scheduleFlush();
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
        this.flushNow();
    }

    // --- persistence internals ---

    private scheduleFlush(): void {
        if (this.flushTimer !== null) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushNow();
        }, FLUSH_THROTTLE_MS);
    }

    /** Write the buffer to ``sessionStorage`` synchronously. */
    flushNow(): void {
        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        const store = safeSessionStorage();
        if (!store) return;
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(this.buffer));
        } catch {
            /* quota / serialization failure — non-fatal */
        }
    }

    private load(): RecordedEvent[] {
        const store = safeSessionStorage();
        if (!store) return [];
        try {
            const raw = store.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return (parsed as RecordedEvent[]).slice(-MAX_BUFFER_SIZE);
        } catch {
            return [];
        }
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

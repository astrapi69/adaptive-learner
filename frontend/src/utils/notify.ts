/**
 * Centralized toast notification wrapper with type-specific
 * display durations.
 *
 * Phase 37 — error toasts include a "Report Issue" button that
 * dispatches a ``adaptive-learner:open-error-report`` custom
 * event. The App listens for it and mounts
 * ``ErrorReportDialog`` with a pre-filled GitHub issue body
 * (endpoint, status, stacktrace, environment, sanitized action
 * history). The optional ``apiError`` parameter forwards the
 * structured context; calls without it still get a working
 * button (the dialog just has less to pre-fill).
 *
 * Phase 36 — the ``persistent`` option keeps the toast open
 * until the user dismisses it manually. Use for failures the
 * user must acknowledge (analysis broken, AI provider down,
 * persistent error states) so the message survives the next
 * keystroke.
 *
 * Layout contract: the ``ErrorContent`` component renders
 * inside react-toastify's fixed-width toast container. All text
 * MUST wrap via ``overflow-wrap`` / ``word-break`` so long SQL
 * errors or stacktraces do not blow out the container width.
 * The "Report Issue" button must stay visible and clickable on
 * every screen size.
 */

import React from "react";
import {toast} from "react-toastify";
import {ApiError} from "../api/client";
import {isDevMode} from "../hooks/settings/useDevMode";
import {resolveI18n} from "../hooks/ui/useI18n";
import {friendlyErrorMessage} from "./errorMessages";

// Truncate the visible error message so the toast stays
// readable. The full detail is still embedded in the
// ErrorReportDialog body when the user opts in.
const MAX_DISPLAY_LENGTH = 200;

interface ErrorOptions {
    /**
     * Phase 36 — when ``true``, the toast does NOT auto-dismiss.
     */
    persistent?: boolean;
    /**
     * Phase 37 — structured API error context. Passed to the
     * error-report dialog so the GitHub issue body can include
     * the HTTP endpoint / status / stacktrace.
     */
    apiError?: ApiError;
    /**
     * #3374 - the caught error. ``message`` is then the localized
     * prefix the user sees; the error's own text is appended only in
     * dev mode and always travels to the report dialog and the event
     * recorder. An ``ApiError`` here also takes the friendly
     * ``ui.errors.*`` path, exactly like ``apiError``.
     *
     * @example
     * catch (err) {
     *     notify.error(t("content.delete_failed", "Could not delete."), {error: err});
     * }
     */
    error?: unknown;
}

interface InfoOptions {
    /** Override the default 8s auto-dismiss. */
    autoClose?: number | false;
    /**
     * Render the toast click-through (``pointer-events: none``) so it
     * never blocks a control beneath it. For passive, auto-dismissing
     * messages only (no action / no close button).
     */
    passThrough?: boolean;
}

function truncateForDisplay(message: string): string {
    if (message.length <= MAX_DISPLAY_LENGTH) return message;
    return message.slice(0, MAX_DISPLAY_LENGTH) + "...";
}

/**
 * react-toastify options rendering a toast click-through
 * (``pointer-events: none``) so it never intercepts a control beneath it —
 * e.g. the sticky lesson footer's Check/Next buttons, which the bottom-right
 * toasts overlap (#589 motivation toast; #1410 download-success toast in
 * landscape). Returns an empty object when not enabled.
 */
function passThroughOptions(enabled: boolean | undefined) {
    return enabled
        ? {
              style: {pointerEvents: "none" as const},
              closeOnClick: false,
              closeButton: false,
              draggable: false,
          }
        : {};
}

function ErrorContent({
    displayMessage,
    originalMessage,
    apiError,
}: {
    displayMessage: string;
    originalMessage: string;
    apiError?: ApiError;
}) {
    return React.createElement(
        "div",
        {
            style: {
                display: "flex",
                flexDirection: "column",
                gap: 8,
                // CRITICAL: prevent long SQL errors / stacktraces
                // from blowing out the toast container width.
                maxWidth: "100%",
                overflow: "hidden",
                overflowWrap: "break-word",
                wordBreak: "break-word",
            },
        },
        React.createElement(
            "span",
            {
                style: {
                    display: "block",
                    fontSize: "0.8125rem",
                    lineHeight: 1.4,
                },
            },
            truncateForDisplay(displayMessage),
        ),
        React.createElement(
            "button",
            {
                type: "button",
                "data-testid": "error-toast-report-issue",
                onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    // Pass the ORIGINAL technical message to the
                    // ErrorReportDialog. Production-mode users see
                    // the friendly toast text but the submitted
                    // GitHub issue still carries full technical
                    // detail (status, endpoint, stacktrace).
                    window.dispatchEvent(
                        new CustomEvent(
                            "adaptive-learner:open-error-report",
                            {
                                detail: {
                                    message: originalMessage,
                                    apiError,
                                },
                            },
                        ),
                    );
                },
                style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "currentColor",
                    background: "color-mix(in srgb, currentColor 15%, transparent)",
                    border: "1px solid color-mix(in srgb, currentColor 30%, transparent)",
                    borderRadius: 4,
                    cursor: "pointer",
                    alignSelf: "flex-start",
                },
            },
            resolveI18n("ui.error_report.report_button", "Report Issue"),
        ),
    );
}

function recordToast(level: string, message: string) {
    try {
        // Dynamic import to avoid circular dependencies between
        // notify.ts and eventRecorder.ts. notify.ts imports
        // ApiError from api/client.ts which records api_call
        // events into the recorder; the recorder itself is
        // therefore loaded indirectly. Keeping the import async
        // here keeps the dependency graph one-way at module
        // evaluation time.
        import("./eventRecorder")
            .then(({eventRecorder}) => {
                eventRecorder.add({
                    type: "toast",
                    timestamp: performance.now(),
                    level,
                    message,
                });
            })
            .catch(() => {});
    } catch {
        /* ignore */
    }
}

/**
 * Decide what the user actually sees in the toast.
 *
 * - Dev mode (Settings > Interface > Developer Mode): always
 *   show the caller's original technical message.
 * - Production mode + ApiError supplied: replace the message
 *   with a status-code-mapped friendly string from
 *   ``ui.errors.*``. The user never sees HTTP details.
 * - Production mode without ApiError: show the caller's
 *   message as-is. Callers that supply a literal already-
 *   friendly string (parse errors, validation messages from
 *   their own code) stay in control of the wording.
 */
function pickDisplayMessage(
    message: string,
    technical: string,
    apiError: ApiError | undefined,
): string {
    if (isDevMode()) return technical;
    if (!apiError) return message;
    return friendlyErrorMessage(apiError);
}

/** The caught error's own text, or ``null`` when there is none. */
function errorText(error: unknown): string | null {
    if (error instanceof Error) return error.message || error.name;
    if (error === null || error === undefined) return null;
    return String(error);
}

/** ``prefix: error text`` for the recorder and the report dialog. */
function technicalMessage(message: string, opts?: ErrorOptions): string {
    const text = errorText(opts?.error);
    return text ? `${message}: ${text}` : message;
}

/** The ApiError to map and report: the explicit one, else the caught one. */
function resolveApiError(opts?: ErrorOptions): ApiError | undefined {
    if (opts?.apiError) return opts.apiError;
    return opts?.error instanceof ApiError ? opts.error : undefined;
}

export const notify = {
    error: (message: string, opts?: ErrorOptions) => {
        const technical = technicalMessage(message, opts);
        const apiError = resolveApiError(opts);
        const displayMessage = pickDisplayMessage(message, technical, apiError);
        // eventRecorder always captures the ORIGINAL technical
        // message — privacy-aware (no API keys / passwords leak
        // through here) and useful when the user later submits a
        // bug report. Dev/prod mode only affects what is rendered
        // in the toast, never what the recorder stores.
        recordToast("error", technical);
        // Error toasts NEVER auto-dismiss: a failure the user did not
        // read is a failure they cannot act on. They stay until the
        // user closes them (drag would dismiss them by accident, so it
        // is off). Whether a TAP closes them is the container's call
        // (#3235: yes during a lesson run, where the toast covers the
        // footer; the Report Issue button stops propagation either
        // way). The ``persistent`` option is kept for call-site
        // compatibility but is now the only behaviour.
        return toast.error(
            React.createElement(ErrorContent, {
                displayMessage,
                originalMessage: technical,
                apiError,
            }),
            {
                autoClose: false,
                draggable: false,
            },
        );
    },
    warning: (message: string) => {
        recordToast("warning", message);
        return toast.warning(message, {autoClose: 10000});
    },
    info: (message: string, opts?: InfoOptions) => {
        recordToast("info", message);
        return toast.info(message, {
            autoClose: opts?.autoClose ?? 8000,
            ...passThroughOptions(opts?.passThrough),
        });
    },
    success: (message: string, opts?: Pick<InfoOptions, "passThrough">) => {
        recordToast("success", message);
        return toast.success(message, {
            autoClose: 5000,
            ...passThroughOptions(opts?.passThrough),
        });
    },
};

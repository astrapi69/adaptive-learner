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
import {isDevMode} from "../hooks/useDevMode";
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
                    color: "#fff",
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 4,
                    cursor: "pointer",
                    alignSelf: "flex-start",
                },
            },
            "Report Issue",
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
function pickDisplayMessage(message: string, opts?: ErrorOptions): string {
    if (isDevMode()) return message;
    if (!opts?.apiError) return message;
    return friendlyErrorMessage(opts.apiError);
}

export const notify = {
    error: (message: string, opts?: ErrorOptions) => {
        const displayMessage = pickDisplayMessage(message, opts);
        // eventRecorder always captures the ORIGINAL technical
        // message — privacy-aware (no API keys / passwords leak
        // through here) and useful when the user later submits a
        // bug report. Dev/prod mode only affects what is rendered
        // in the toast, never what the recorder stores.
        recordToast("error", message);
        // Error toasts NEVER auto-dismiss: a failure the user did not
        // read is a failure they cannot act on. They stay until the
        // user closes them via the X button (closeOnClick / drag would
        // dismiss them by accident, so both are off). The ``persistent``
        // option is kept for call-site compatibility but is now the
        // only behaviour.
        return toast.error(
            React.createElement(ErrorContent, {
                displayMessage,
                originalMessage: message,
                apiError: opts?.apiError,
            }),
            {
                autoClose: false,
                closeOnClick: false,
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
            // ``passThrough`` makes a purely-informational toast
            // click-through (pointer-events: none) so it never
            // intercepts a button beneath it — e.g. the mid-lesson
            // motivation toast that overlaps the sticky lesson footer
            // (it blocked the Check/Next buttons; #589 regression).
            ...(opts?.passThrough
                ? {
                      style: {pointerEvents: "none"},
                      closeOnClick: false,
                      closeButton: false,
                      draggable: false,
                  }
                : {}),
        });
    },
    success: (message: string) => {
        recordToast("success", message);
        return toast.success(message, {autoClose: 5000});
    },
};

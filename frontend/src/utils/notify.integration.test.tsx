/**
 * Integration test for the toast → dialog handshake.
 *
 * When the user clicks the "Report Issue" button inside an error
 * toast, ``notify.ts`` dispatches a
 * ``adaptive-learner:open-error-report`` custom event with the
 * message + optional ApiError attached. The App listens for it and
 * mounts ``ErrorReportDialog``. We can't render the full App tree
 * cleanly under happy-dom (Routes, I18nProvider, etc. add noise),
 * so we render the ``ErrorContent`` element directly and wire a
 * minimal listener to mirror what App.tsx does.
 */

import React, {useEffect, useState} from "react";
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {act, render, screen, fireEvent, cleanup} from "@testing-library/react";

import {ApiError} from "../api/client";

vi.mock("../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
        setLang: vi.fn(),
    }),
}));

vi.mock("./eventRecorder", () => ({
    eventRecorder: {getAll: () => []},
    formatEventLog: () => "",
}));

import ErrorReportDialog from "../components/ErrorReportDialog";

/** Mirror of the App.tsx wiring — listens for the custom event
 *  and mounts the dialog. Implemented here so the test exercises
 *  the same handshake without dragging the entire route tree
 *  through happy-dom. */
function HostShell() {
    const [state, setState] = useState<{
        open: boolean;
        message: string;
        apiError?: ApiError;
    }>({open: false, message: ""});

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as {
                message: string;
                apiError?: ApiError;
            };
            setState({
                open: true,
                message: detail.message,
                apiError: detail.apiError,
            });
        };
        window.addEventListener(
            "adaptive-learner:open-error-report",
            handler,
        );
        return () =>
            window.removeEventListener(
                "adaptive-learner:open-error-report",
                handler,
            );
    }, []);

    return (
        <>
            <ErrorReportDialog
                open={state.open}
                onClose={() => setState({open: false, message: ""})}
                errorMessage={state.message}
                apiError={state.apiError}
            />
        </>
    );
}

beforeEach(() => {
    cleanup();
});

afterEach(() => {
    cleanup();
});

describe("notify.error → dialog handshake", () => {
    it("dispatching the custom event opens the dialog and pipes the message into the issue body", () => {
        render(<HostShell />);
        expect(
            screen.queryByTestId("error-report-dialog"),
        ).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(
                new CustomEvent("adaptive-learner:open-error-report", {
                    detail: {message: "Synthetic error from the test"},
                }),
            );
        });

        // Dialog mounts.
        expect(
            screen.getByTestId("error-report-dialog"),
        ).toBeInTheDocument();
        // The errorMessage isn't rendered directly in the visible
        // dialog body (it lives in the GitHub-issue preview); flip
        // the preview to verify the prop was wired through.
        fireEvent.click(screen.getByTestId("error-report-toggle-preview"));
        const preview = screen.getByTestId("error-report-full-preview");
        expect(preview.textContent).toContain(
            "Synthetic error from the test",
        );
    });

    it("forwards the apiError into the dialog props", () => {
        render(<HostShell />);
        const apiError = new ApiError(
            502,
            "Anthropic: unreachable",
            "/api/sessions/x/message",
            "POST",
            "Traceback (most recent call last):\n  ...",
        );

        act(() => {
            window.dispatchEvent(
                new CustomEvent("adaptive-learner:open-error-report", {
                    detail: {message: "Anthropic down", apiError},
                }),
            );
        });

        fireEvent.click(screen.getByTestId("error-report-toggle-preview"));
        const preview = screen.getByTestId("error-report-full-preview");
        expect(preview.textContent).toContain("HTTP Status: 502");
        expect(preview.textContent).toContain(
            "/api/sessions/x/message",
        );
    });

    it("close button restores the closed state", () => {
        render(<HostShell />);
        act(() => {
            window.dispatchEvent(
                new CustomEvent("adaptive-learner:open-error-report", {
                    detail: {message: "Boom"},
                }),
            );
        });
        expect(
            screen.getByTestId("error-report-dialog"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("error-report-close"));
        expect(
            screen.queryByTestId("error-report-dialog"),
        ).not.toBeInTheDocument();
    });
});

describe("notify.error toast wiring", () => {
    /** We can't render a full ToastContainer reliably under
     *  happy-dom, but we can verify the contract directly: calling
     *  notify.error stores a React element whose embedded button
     *  dispatches the right custom event. */
    it("calling notify.error invokes toast.error with an element whose button dispatches the custom event", () => {
        // Mock react-toastify so we can inspect what was passed.
        const errorSpy = vi.fn();
        // Re-import the toast surface — vi.doMock resets the
        // resolver cache for the next import.
        vi.resetModules();
        vi.doMock("react-toastify", () => ({toast: {error: errorSpy}}));
        return import("./notify").then(async ({notify: freshNotify}) => {
            const dispatched: CustomEvent[] = [];
            const listener = (e: Event) =>
                dispatched.push(e as CustomEvent);
            window.addEventListener(
                "adaptive-learner:open-error-report",
                listener,
            );

            try {
                freshNotify.error("Toast-attached failure");
                expect(errorSpy).toHaveBeenCalledOnce();
                const [body] = errorSpy.mock.calls[0];
                expect(React.isValidElement(body)).toBe(true);

                // Render the body to get the button DOM.
                render(body as React.ReactElement);
                const reportBtn = screen.getByTestId(
                    "error-toast-report-issue",
                );
                fireEvent.click(reportBtn);

                expect(dispatched).toHaveLength(1);
                expect(dispatched[0].detail).toEqual({
                    message: "Toast-attached failure",
                    apiError: undefined,
                });
            } finally {
                window.removeEventListener(
                    "adaptive-learner:open-error-report",
                    listener,
                );
                vi.doUnmock("react-toastify");
                vi.resetModules();
            }
        });
    });
});

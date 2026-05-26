/**
 * Tests for the toast notification utility.
 *
 * Phase 37 — ``notify.error`` renders an ``ErrorContent`` React
 * element as the toast body (with a "Report Issue" button)
 * rather than a plain string. Assertions on the toast.error call
 * shape match accordingly.
 *
 * DEV-MODE-FRIENDLY-ERRORS-01 — ``notify.error`` now splits the
 * displayed message from the original technical message. In
 * production mode (Developer Mode off) with an ``ApiError``
 * supplied, the friendly status-code-mapped string is shown to
 * the user while the original technical message stays attached
 * for the ErrorReportDialog. Dev mode shows the technical
 * message verbatim. The recorded toast (eventRecorder) always
 * carries the original technical message regardless of mode.
 */

import React from "react";
import {describe, it, expect, vi, beforeEach} from "vitest";

vi.mock("react-toastify", () => ({
    toast: {
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
    },
}));

// Mock the dev-mode helper so tests can flip between
// production / developer mode deterministically.
const isDevModeMock = vi.fn(() => false);
vi.mock("../hooks/useDevMode", () => ({
    isDevMode: () => isDevModeMock(),
}));

import {toast} from "react-toastify";
import {notify} from "./notify";

beforeEach(() => {
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.warning).mockReset();
    vi.mocked(toast.info).mockReset();
    vi.mocked(toast.success).mockReset();
    isDevModeMock.mockReturnValue(false);
});

function getErrorContentProps(): {
    displayMessage: string;
    originalMessage: string;
    apiError?: unknown;
} {
    const [body] = vi.mocked(toast.error).mock.calls[0];
    expect(React.isValidElement(body)).toBe(true);
    return (
        body as React.ReactElement<{
            displayMessage: string;
            originalMessage: string;
            apiError?: unknown;
        }>
    ).props;
}

describe("notify.error", () => {
    it("renders an ErrorContent element with the message", () => {
        notify.error("boom");
        expect(toast.error).toHaveBeenCalledOnce();
        const [body, opts] = vi.mocked(toast.error).mock.calls[0];
        expect(React.isValidElement(body)).toBe(true);
        expect(opts).toMatchObject({autoClose: 15000, closeOnClick: false});
    });

    it("respects the persistent option (autoClose=false)", () => {
        notify.error("stuck", {persistent: true});
        const [, opts] = vi.mocked(toast.error).mock.calls[0];
        expect(opts).toMatchObject({autoClose: false, closeOnClick: false});
    });

    it("without apiError shows the caller's message in both modes", () => {
        notify.error("custom-friendly-message");
        let props = getErrorContentProps();
        expect(props.displayMessage).toBe("custom-friendly-message");
        expect(props.originalMessage).toBe("custom-friendly-message");

        vi.mocked(toast.error).mockReset();
        isDevModeMock.mockReturnValue(true);
        notify.error("custom-friendly-message");
        props = getErrorContentProps();
        expect(props.displayMessage).toBe("custom-friendly-message");
        expect(props.originalMessage).toBe("custom-friendly-message");
    });

    it("in production mode replaces an ApiError message with the friendly string", () => {
        const apiError = {
            status: 404,
            detail: "Not Found: /api/plugin-settings/learning-repo",
            endpoint: "/api/plugin-settings/learning-repo",
            method: "GET",
            stacktrace: "stack",
            timestamp: "2026-05-22T00:00:00.000Z",
            name: "ApiError",
        } as unknown as import("../api/client").ApiError;

        notify.error("HTTP 404 /api/plugin-settings/learning-repo", {
            apiError,
        });
        const props = getErrorContentProps();
        // Friendly text resolves to the English fallback because
        // the i18n catalogue is not loaded in the test harness.
        expect(props.displayMessage).toBe(
            "This page or feature was not found.",
        );
        // Technical message survives — it powers the
        // ErrorReportDialog title/body when the user clicks
        // "Report Issue".
        expect(props.originalMessage).toBe(
            "HTTP 404 /api/plugin-settings/learning-repo",
        );
        expect(props.apiError).toBe(apiError);
    });

    it("in dev mode shows the original technical message even with ApiError", () => {
        isDevModeMock.mockReturnValue(true);
        const apiError = {
            status: 500,
            detail: "boom",
            endpoint: "/api/foo",
            method: "GET",
            stacktrace: "trace",
            timestamp: "2026-05-22T00:00:00.000Z",
            name: "ApiError",
        } as unknown as import("../api/client").ApiError;

        notify.error("HTTP 500 boom", {apiError});
        const props = getErrorContentProps();
        expect(props.displayMessage).toBe("HTTP 500 boom");
        expect(props.originalMessage).toBe("HTTP 500 boom");
        expect(props.apiError).toBe(apiError);
    });

    it("maps each documented status to a friendly key", () => {
        const cases: Array<[number, string]> = [
            [400, "The request could not be processed."],
            [401, "Access denied. Please check your settings."],
            [403, "Access denied. Please check your settings."],
            [404, "This page or feature was not found."],
            [409, "This action conflicts with the current state."],
            [422, "The request could not be processed."],
            [429, "Too many requests. Please wait a moment and try again."],
            [500, "An internal error occurred."],
            [502, "The AI service is currently unreachable."],
            [
                418,
                "Something went wrong. Please try again later.",
            ],
        ];
        for (const [status, expected] of cases) {
            vi.mocked(toast.error).mockReset();
            const apiError = {
                status,
                detail: "raw",
                timestamp: "2026-05-22T00:00:00.000Z",
                name: "ApiError",
            } as unknown as import("../api/client").ApiError;
            notify.error("raw HTTP " + status, {apiError});
            const props = getErrorContentProps();
            expect(props.displayMessage, `status ${status}`).toBe(expected);
        }
    });
});

describe("notify.warning / info / success", () => {
    it("warning forwards the message and sets autoClose to 10s", () => {
        notify.warning("warn");
        expect(toast.warning).toHaveBeenCalledWith("warn", {autoClose: 10000});
    });

    it("info forwards the message and sets autoClose to 8s", () => {
        notify.info("fyi");
        expect(toast.info).toHaveBeenCalledWith("fyi", {autoClose: 8000});
    });

    it("success forwards the message and sets autoClose to 5s", () => {
        notify.success("done");
        expect(toast.success).toHaveBeenCalledWith("done", {autoClose: 5000});
    });
});

/**
 * Tests for the toast notification utility.
 *
 * Phase 37 — ``notify.error`` now renders an ``ErrorContent`` React
 * element as the toast body (with a "Report Issue" button) rather
 * than a plain string. Assertions on the toast.error call shape
 * are updated accordingly; the precise React element structure is
 * covered by the toast-click → dialog-opens integration test in
 * ``ErrorReportDialog.test.tsx``.
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

import {toast} from "react-toastify";
import {notify} from "./notify";

beforeEach(() => {
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.warning).mockReset();
    vi.mocked(toast.info).mockReset();
    vi.mocked(toast.success).mockReset();
});

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

    it("passes apiError through to ErrorContent props", () => {
        const apiError = {
            status: 500,
            detail: "boom",
            endpoint: "/api/foo",
            method: "GET",
            stacktrace: "trace",
            timestamp: "2026-05-22T00:00:00.000Z",
            name: "ApiError",
        } as unknown as import("../api/client").ApiError;
        notify.error("boom", {apiError});
        const [body] = vi.mocked(toast.error).mock.calls[0];
        // body is the React element returned by createElement(ErrorContent, {message, apiError})
        expect(React.isValidElement(body)).toBe(true);
        const elementProps = (
            body as React.ReactElement<{message: string; apiError?: unknown}>
        ).props;
        expect(elementProps.message).toBe("boom");
        expect(elementProps.apiError).toBe(apiError);
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

/**
 * #3415 - the error toast's Report Issue button speaks the UI language
 * like the dialog it opens, instead of a hardcoded English literal.
 */

import "@testing-library/jest-dom/vitest";
import React from "react";
import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

vi.mock("react-toastify", () => ({
    toast: {error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn()},
}));

vi.mock("../hooks/ui/useI18n", () => ({
    resolveI18n: (key: string, fallback: string) =>
        key === "ui.error_report.report_button" ? "Problem melden" : fallback,
}));

import {toast} from "react-toastify";
import {notify} from "./notify";

describe("error toast Report Issue button (#3415)", () => {
    it("renders the localized label from the catalog", () => {
        notify.error("Something broke");
        const [body] = vi.mocked(toast.error).mock.calls[0];
        render(body as React.ReactElement);
        expect(screen.getByTestId("error-toast-report-issue")).toHaveTextContent("Problem melden");
    });
});

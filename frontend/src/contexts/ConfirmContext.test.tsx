/**
 * Tests for the ConfirmProvider / useConfirm bridge (#783): the
 * awaitable confirm() opens the modal and resolves true on confirm,
 * false on cancel.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../hooks/useI18n";
import { ConfirmProvider, useConfirm } from "./ConfirmContext";

function Harness() {
    const confirm = useConfirm();
    const [result, setResult] = useState("pending");
    return (
        <button
            type="button"
            data-testid="trigger"
            data-result={result}
            onClick={async () => {
                const ok = await confirm({
                    message: "Delete this item?",
                    confirmLabel: "Delete",
                    variant: "danger",
                });
                setResult(String(ok));
            }}
        >
            go
        </button>
    );
}

function renderHarness() {
    return render(
        <I18nProvider>
            <ConfirmProvider>
                <Harness />
            </ConfirmProvider>
        </I18nProvider>,
    );
}

describe("useConfirm", () => {
    it("opens the modal with the given message and resolves true on confirm", async () => {
        renderHarness();
        fireEvent.click(screen.getByTestId("trigger"));
        await waitFor(() =>
            expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument(),
        );
        expect(screen.getByText("Delete this item?")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
        await waitFor(() =>
            expect(screen.getByTestId("trigger")).toHaveAttribute(
                "data-result",
                "true",
            ),
        );
        // closes after resolving
        expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("resolves false on cancel", async () => {
        renderHarness();
        fireEvent.click(screen.getByTestId("trigger"));
        await waitFor(() =>
            expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
        await waitFor(() =>
            expect(screen.getByTestId("trigger")).toHaveAttribute(
                "data-result",
                "false",
            ),
        );
    });
});

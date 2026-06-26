/**
 * Tests for KeyVaultSection (EXP-038) — the storage-mode gating
 * (FUNKTION-NICHT-VERFUEGBAR) of the encrypted key export entry.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import KeyVaultSection from "./KeyVaultSection";

const exportApiKeysMock = vi.fn();
const resolveStorageModeMock = vi.fn<() => "api" | "dexie">();

vi.mock("../../../storage", () => ({
    getStorage: () => ({ settings: { exportApiKeys: exportApiKeysMock } }),
    resolveStorageMode: () => resolveStorageModeMock(),
}));

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({ userId: "u-1" }),
}));

vi.mock("../../../hooks/ui/useI18n", () => ({
    useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

vi.mock("../../../utils/notify", () => ({
    notify: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
    exportApiKeysMock.mockReset().mockResolvedValue({});
    resolveStorageModeMock.mockReset().mockReturnValue("dexie");
});

describe("KeyVaultSection gating", () => {
    it("API mode: shows the disabled notice, no export form", async () => {
        resolveStorageModeMock.mockReturnValue("api");
        render(<KeyVaultSection />);
        expect(
            await screen.findByTestId("key-vault-api-notice"),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("key-vault-export")).not.toBeInTheDocument();
        // Keys are never read in API mode.
        expect(exportApiKeysMock).not.toHaveBeenCalled();
    });

    it("Dexie mode, no keys: export disabled + hint shown", async () => {
        exportApiKeysMock.mockResolvedValue({});
        render(<KeyVaultSection />);
        await waitFor(() =>
            expect(screen.getByTestId("key-vault-no-keys")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("key-vault-export-button")).toBeDisabled();
        // Import is always available on a fresh device.
        expect(
            screen.getByTestId("key-vault-import-button"),
        ).not.toBeDisabled();
    });

    it("Dexie mode, a key present: export enabled", async () => {
        exportApiKeysMock.mockResolvedValue({ anthropic: "sk-ant-AAA" });
        render(<KeyVaultSection />);
        await waitFor(() =>
            expect(
                screen.getByTestId("key-vault-export-button"),
            ).not.toBeDisabled(),
        );
        expect(screen.queryByTestId("key-vault-no-keys")).not.toBeInTheDocument();
    });
});

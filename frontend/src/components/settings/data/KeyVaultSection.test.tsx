/**
 * Tests for KeyVaultSection (EXP-038) — the storage-mode gating
 * (FUNKTION-NICHT-VERFUEGBAR) of the encrypted key export entry.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import KeyVaultSection from "./KeyVaultSection";
import { VaultDecryptError } from "../../../lib/crypto/passphrase-vault";

const exportApiKeysMock = vi.fn();
const resolveStorageModeMock = vi.fn<() => "api" | "dexie">();
const buildEncryptedKeyVaultMock = vi.fn();
const importEncryptedKeyVaultMock = vi.fn();
const notifyErrorMock = vi.fn();
const notifyWarningMock = vi.fn();
const notifySuccessMock = vi.fn();

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
    notify: {
        success: (m: string) => notifySuccessMock(m),
        error: (m: string) => notifyErrorMock(m),
        warning: (m: string) => notifyWarningMock(m),
    },
}));

vi.mock("../../../lib/keys/key-vault-io", () => ({
    buildEncryptedKeyVault: (...args: unknown[]) =>
        buildEncryptedKeyVaultMock(...args),
    importEncryptedKeyVault: (...args: unknown[]) =>
        importEncryptedKeyVaultMock(...args),
}));

vi.mock("../../../lib/crypto/passphrase-vault", () => {
    class VaultDecryptError extends Error {}
    return { VaultDecryptError };
});

beforeEach(() => {
    exportApiKeysMock.mockReset().mockResolvedValue({});
    resolveStorageModeMock.mockReset().mockReturnValue("dexie");
    buildEncryptedKeyVaultMock.mockReset().mockResolvedValue("ENVELOPE");
    importEncryptedKeyVaultMock.mockReset().mockResolvedValue({
        providers: ["anthropic"],
    });
    notifyErrorMock.mockReset();
    notifyWarningMock.mockReset();
    notifySuccessMock.mockReset();
    // happy-dom lacks object-URL helpers used by the download path.
    globalThis.URL.createObjectURL = vi.fn(() => "blob:fake");
    globalThis.URL.revokeObjectURL = vi.fn();
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
        // Import stays disabled until a file + passphrase are supplied
        // (inline validation, not an error toast).
        expect(screen.getByTestId("key-vault-import-button")).toBeDisabled();
    });

    it("Dexie mode, a key present: export enabled once a valid passphrase is entered", async () => {
        exportApiKeysMock.mockResolvedValue({ anthropic: "sk-ant-AAA" });
        render(<KeyVaultSection />);
        // The no-keys gate is cleared, but a valid passphrase is still required.
        await waitFor(() =>
            expect(
                screen.queryByTestId("key-vault-no-keys"),
            ).not.toBeInTheDocument(),
        );
        expect(screen.getByTestId("key-vault-export-button")).toBeDisabled();

        fireEvent.change(screen.getByTestId("key-vault-export-pass"), {
            target: { value: "longenough1" },
        });
        fireEvent.change(screen.getByTestId("key-vault-export-confirm"), {
            target: { value: "longenough1" },
        });
        expect(
            screen.getByTestId("key-vault-export-button"),
        ).not.toBeDisabled();
    });
});

describe("KeyVaultSection passphrase fields do not trigger the password manager (#1238)", () => {
    const PASSPHRASE_FIELDS = [
        "key-vault-export-pass",
        "key-vault-export-confirm",
        "key-vault-import-pass",
    ] as const;

    it.each(PASSPHRASE_FIELDS)(
        "%s is a text input, never a password field",
        async (testid) => {
            render(<KeyVaultSection />);
            const input = await screen.findByTestId(testid);
            expect(input).toHaveAttribute("type", "text");
            expect(input).not.toHaveAttribute("type", "password");
        },
    );

    it.each(PASSPHRASE_FIELDS)(
        "%s opts out of every common password manager",
        async (testid) => {
            render(<KeyVaultSection />);
            const input = await screen.findByTestId(testid);
            expect(input).toHaveAttribute("autocomplete", "off");
            expect(input).toHaveAttribute("autocorrect", "off");
            expect(input).toHaveAttribute("autocapitalize", "off");
            expect(input).toHaveAttribute("spellcheck", "false");
            expect(input).toHaveAttribute("data-1p-ignore"); // 1Password
            expect(input).toHaveAttribute("data-lpignore", "true"); // LastPass
            expect(input).toHaveAttribute("data-bwignore", "true"); // Bitwarden
            expect(input).toHaveAttribute("data-form-type", "other"); // Dashlane
        },
    );

    it.each(PASSPHRASE_FIELDS)(
        "%s masks its value by default",
        async (testid) => {
            render(<KeyVaultSection />);
            const input = await screen.findByTestId(testid);
            expect(input.className).toContain("[-webkit-text-security:disc]");
        },
    );

    it("reveals the export passphrase on the toggle", async () => {
        render(<KeyVaultSection />);
        const input = await screen.findByTestId("key-vault-export-pass");
        fireEvent.change(input, { target: { value: "correct horse" } });
        expect((input as HTMLInputElement).value).toBe("correct horse");

        const toggles = screen.getAllByRole("button", { name: "Show value" });
        fireEvent.click(toggles[0]);
        expect(
            (await screen.findByTestId("key-vault-export-pass")).className,
        ).not.toContain("[-webkit-text-security:disc]");
    });
});

describe("KeyVaultSection passphrase validation is inline, not a toast (#1244)", () => {
    /** Render with a key present so the export form is otherwise enabled. */
    async function renderWithKey() {
        exportApiKeysMock.mockResolvedValue({ anthropic: "sk-ant-AAA" });
        render(<KeyVaultSection />);
        await screen.findByTestId("key-vault-export-pass");
    }

    function setExport(pass: string, confirm: string) {
        fireEvent.change(screen.getByTestId("key-vault-export-pass"), {
            target: { value: pass },
        });
        fireEvent.change(screen.getByTestId("key-vault-export-confirm"), {
            target: { value: confirm },
        });
    }

    it("too-short passphrase: inline hint + disabled submit, NO error toast", async () => {
        await renderWithKey();
        setExport("short", "short");

        // Inline hint at the field — not a toast.
        expect(
            screen.getByTestId("key-vault-export-pass-hint"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("key-vault-export-pass")).toHaveAttribute(
            "aria-invalid",
            "true",
        );
        // Submit cannot be triggered.
        expect(screen.getByTestId("key-vault-export-button")).toBeDisabled();
        // No error toast / no "Report Issue" path for normal validation.
        expect(notifyErrorMock).not.toHaveBeenCalled();
    });

    it("mismatched passphrases: inline hint + disabled submit, NO error toast", async () => {
        await renderWithKey();
        setExport("longenough1", "longenough2");

        expect(
            screen.getByTestId("key-vault-export-confirm-hint"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("key-vault-export-confirm")).toHaveAttribute(
            "aria-invalid",
            "true",
        );
        expect(screen.getByTestId("key-vault-export-button")).toBeDisabled();
        expect(notifyErrorMock).not.toHaveBeenCalled();
    });

    it("valid + matching (boundary 8 chars): submit enabled and export runs", async () => {
        await renderWithKey();
        setExport("12345678", "12345678"); // exactly the minimum

        expect(
            screen.queryByTestId("key-vault-export-pass-hint"),
        ).not.toBeInTheDocument();
        const button = screen.getByTestId("key-vault-export-button");
        expect(button).not.toBeDisabled();

        fireEvent.click(button);
        await waitFor(() =>
            expect(buildEncryptedKeyVaultMock).toHaveBeenCalledTimes(1),
        );
        expect(notifyErrorMock).not.toHaveBeenCalled();
    });

    it("empty fields: export submit stays disabled, no hint clutter", async () => {
        await renderWithKey();
        expect(
            screen.queryByTestId("key-vault-export-pass-hint"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("key-vault-export-button")).toBeDisabled();
    });

    it("import: submit disabled until a file and a passphrase are present", async () => {
        await renderWithKey();
        const importButton = screen.getByTestId("key-vault-import-button");
        expect(importButton).toBeDisabled();

        fireEvent.change(screen.getByTestId("key-vault-import-file"), {
            target: { files: [new File(["envelope"], `keys.alk`)] },
        });
        // File present but passphrase still empty → still disabled.
        expect(importButton).toBeDisabled();

        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "whatever" },
        });
        expect(importButton).not.toBeDisabled();
    });

    it("import wrong passphrase: understandable message, no error/report-issue toast", async () => {
        importEncryptedKeyVaultMock.mockRejectedValue(
            new VaultDecryptError("nope"),
        );
        await renderWithKey();
        fireEvent.change(screen.getByTestId("key-vault-import-file"), {
            target: { files: [new File(["envelope"], `keys.alk`)] },
        });
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "wrong-pass" },
        });
        fireEvent.click(screen.getByTestId("key-vault-import-button"));

        await waitFor(() =>
            expect(notifyWarningMock).toHaveBeenCalledTimes(1),
        );
        // A wrong passphrase is expected user input, not a defect.
        expect(notifyErrorMock).not.toHaveBeenCalled();
    });
});

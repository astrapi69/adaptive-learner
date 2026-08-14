/**
 * Cross-app key-vault import through the real provider wiring (#2512).
 *
 * Mirrors the Topos-side test in reverse: a Topos-format envelope
 * (format "topos-ai-keys", key stored under "google") pasted into the
 * kit's KeyVaultImportForm must decrypt with the FILE's own format
 * label and land on this app's "gemini" provider via
 * ``importProviderAliases={ google: "gemini" }``.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildKeyVaultPayload, encryptToVault } from "@astrapi69/ai-key-vault";
import { KeyVaultSection } from "@astrapi69/ai-key-vault-react";

import { AiKeyVaultProvider } from "./AiKeyVaultProvider";
import type { UserSettings } from "../../../types";

const notifySuccess = vi.fn();
const notifyWarning = vi.fn();
const notifyError = vi.fn();
vi.mock("../../../utils/notify", () => ({
    notify: {
        success: (m: string) => notifySuccess(m),
        warning: (m: string) => notifyWarning(m),
        error: (m: string) => notifyError(m),
        info: vi.fn(),
    },
}));

vi.mock("../../../hooks/ui/useI18n", () => ({
    useI18n: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k, lang: "en" }),
}));

vi.mock("../../../contexts/ConfirmContext", () => ({
    useConfirm: () => vi.fn(async () => true),
}));

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({ userId: "user-1" }),
}));

// Dexie-mode storage fake: keys land in an in-memory record via the same
// ``getStorage().settings`` surface the adapter uses in production.
const storedKeys = vi.hoisted(() => ({ current: {} as Record<string, string> }));
const setApiKey = vi.hoisted(() => vi.fn());
vi.mock("../../../storage", async () => {
    const actual =
        await vi.importActual<typeof import("../../../storage")>("../../../storage");
    const snapshot = (): UserSettings =>
        ({
            user_id: "user-1",
            active_provider: "anthropic",
            has_anthropic_key: "anthropic" in storedKeys.current,
            has_openai_key: "openai" in storedKeys.current,
            has_gemini_key: "gemini" in storedKeys.current,
            key_source_anthropic: "database",
            key_source_openai: "database",
            key_source_gemini: "database",
            key_preview_anthropic: null,
            key_preview_openai: null,
            key_preview_gemini: null,
            model_override_anthropic: null,
            model_override_openai: null,
            model_override_gemini: null,
        }) as unknown as UserSettings;
    return {
        ...actual,
        resolveStorageMode: () => "dexie" as const,
        getStorage: () => ({
            settings: {
                get: async () => snapshot(),
                update: async () => snapshot(),
                setApiKey: async (
                    _userId: string,
                    body: { provider: string; key: string },
                ) => {
                    setApiKey(body);
                    storedKeys.current[body.provider] = body.key;
                    return snapshot();
                },
                deleteApiKey: async (_userId: string, provider: string) => {
                    delete storedKeys.current[provider];
                    return snapshot();
                },
                exportApiKeys: async () => ({ ...storedKeys.current }),
                testApiKey: async () => ({ ok: true }),
                backupApiKey: async () => undefined,
                getApiKeyBackup: async () => ({ has: false, tested_at: null }),
                restoreApiKeyBackup: async () => snapshot(),
            },
        }),
    };
});

/** A Topos-shaped envelope: format "topos-ai-keys", key under "google". */
async function buildToposEnvelope(passphrase: string, key: string): Promise<string> {
    const payload = buildKeyVaultPayload(
        ["anthropic", "openai", "google"] as const,
        { google: key },
        { activeProvider: "google", modelOverride: {} },
    );
    return encryptToVault(payload, passphrase, { format: "topos-ai-keys" });
}

function renderVaultSection() {
    return render(
        <MemoryRouter>
            <AiKeyVaultProvider>
                <KeyVaultSection />
            </AiKeyVaultProvider>
        </MemoryRouter>,
    );
}

describe("cross-app key import (Topos envelope -> adaptive-learner)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storedKeys.current = {};
    });

    it("imports a Topos vault and remaps its google key onto gemini", async () => {
        const envelope = await buildToposEnvelope("topos-pass-12", "AIza-topos-key");

        renderVaultSection();
        fireEvent.change(await screen.findByTestId("key-vault-import-text"), {
            target: { value: envelope },
        });
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "topos-pass-12" },
        });
        fireEvent.click(screen.getByTestId("key-vault-import-button"));

        await waitFor(() =>
            expect(storedKeys.current.gemini).toBe("AIza-topos-key"),
        );
        // Remapped, not stored under the foreign id.
        expect(storedKeys.current).not.toHaveProperty("google");
        expect(setApiKey).toHaveBeenCalledWith({
            provider: "gemini",
            key: "AIza-topos-key",
        });
        expect(notifySuccess).toHaveBeenCalled();
    });

    it("still rejects a wrong passphrase without writing any key", async () => {
        const envelope = await buildToposEnvelope("topos-pass-12", "AIza-topos-key");

        renderVaultSection();
        fireEvent.change(await screen.findByTestId("key-vault-import-text"), {
            target: { value: envelope },
        });
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "wrong-pass-99" },
        });
        fireEvent.click(screen.getByTestId("key-vault-import-button"));

        await waitFor(() => expect(notifyWarning).toHaveBeenCalled());
        expect(setApiKey).not.toHaveBeenCalled();
        expect(storedKeys.current).toEqual({});
    });
});

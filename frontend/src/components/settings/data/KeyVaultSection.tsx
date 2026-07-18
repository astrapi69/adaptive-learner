/**
 * KeyVaultSection — passphrase-encrypted export/import of the AI keys +
 * provider settings (EXP-038, #1165). Separate from the normal `.alb` backup,
 * which never carries keys.
 *
 * Storage-mode aware (DEXIE-MODE-REGEL):
 *   - Dexie mode: keys live in IndexedDB → full export/import. Export is enabled
 *     only when at least one key exists (FUNKTION-NICHT-VERFUEGBAR otherwise).
 *   - API mode: keys are server-side (Fernet) and unreadable as plaintext on
 *     the client → the section shows a disabled notice instead of a dead form.
 *
 * Tailwind-only, token-backed. All strings via i18n. Errors are friendly and
 * never leak key material or a stack trace.
 */

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SecretInput } from "../../../shared/forms/SecretInput";
import KeyVaultImportForm from "./KeyVaultImportForm";
import { useI18n } from "../../../hooks/ui/useI18n";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { KEY_VAULT_EXTENSION } from "../../../lib/keys/key-vault";
import { buildEncryptedKeyVault } from "../../../lib/keys/key-vault-io";
import { getStorage, resolveStorageMode } from "../../../storage";
import { notify } from "../../../utils/notify";

const MIN_PASSPHRASE_LENGTH = 8;

function downloadText(content: string, filename: string): void {
    const blob = new Blob([content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export default function KeyVaultSection() {
    const { t } = useI18n();
    const mode = resolveStorageMode();
    const { userId } = readLearnerState();

    const [hasKeys, setHasKeys] = useState<boolean | null>(null);
    const [exportPass, setExportPass] = useState("");
    const [exportConfirm, setExportConfirm] = useState("");
    const [busy, setBusy] = useState<"export" | null>(null);

    useEffect(() => {
        if (mode !== "dexie" || !userId) {
            setHasKeys(false);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const keys = await getStorage().settings.exportApiKeys(userId);
                if (!cancelled) setHasKeys(Object.keys(keys).length > 0);
            } catch {
                if (!cancelled) setHasKeys(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [mode, userId]);

    // Input validation (not error handling): a too-short or non-matching
    // passphrase is normal user input, surfaced inline with the submit
    // disabled — never as a red "Report Issue" error toast.
    const exportTooShort =
        exportPass.length > 0 && exportPass.length < MIN_PASSPHRASE_LENGTH;
    const exportMismatch =
        exportConfirm.length > 0 && exportConfirm !== exportPass;
    const exportValid =
        exportPass.length >= MIN_PASSPHRASE_LENGTH &&
        exportConfirm === exportPass;

    async function handleExport(): Promise<void> {
        if (!userId || !exportValid) return;
        setBusy("export");
        try {
            const envelope = await buildEncryptedKeyVault(
                getStorage().settings,
                userId,
                exportPass,
            );
            if (envelope === null) {
                // State condition, not a defect (the button is already
                // disabled without keys) — warn rather than error-report.
                notify.warning(
                    t(
                        "settings.key_vault.no_keys",
                        "There are no AI keys to export yet.",
                    ),
                );
                return;
            }
            downloadText(
                envelope,
                `adaptive-learner-keys${KEY_VAULT_EXTENSION}`,
            );
            setExportPass("");
            setExportConfirm("");
            notify.success(
                t(
                    "settings.key_vault.success_export",
                    "Encrypted key file downloaded.",
                ),
            );
        } catch {
            notify.error(
                t("settings.key_vault.error_export", "Could not create the export."),
            );
        } finally {
            setBusy(null);
        }
    }

    return (
        <section
            className="settings-section"
            data-testid="key-vault-section"
        >
            <h2 className="settings-section-title inline-flex items-center gap-2">
                <KeyRound size={18} aria-hidden="true" />
                {t(
                    "settings.key_vault.title",
                    "AI keys — encrypted export",
                )}
            </h2>
            <p className="text-sm text-muted-foreground">
                {t(
                    "settings.key_vault.intro",
                    "Move your AI keys to another device in one encrypted file, separate from the normal backup (which never contains keys).",
                )}
            </p>

            {mode === "api" ? (
                <div className="flex flex-col gap-6">
                    {/* Export is genuinely server-side (keys never leave the
                        backend as plaintext); import only needs setApiKey,
                        which works in both modes (#1812). */}
                    <p
                        className="rounded-app border border-border bg-muted p-3 text-sm text-muted-foreground"
                        data-testid="key-vault-api-notice"
                    >
                        {t(
                            "settings.key_vault.api_export_disabled",
                            "In server mode keys cannot be exported - they are managed encrypted on the server. Importing a key file still works.",
                        )}
                    </p>
                    <KeyVaultImportForm
                        userId={userId}
                        onImported={() => setHasKeys(true)}
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {/* Export */}
                    <div className="flex flex-col gap-2" data-testid="key-vault-export">
                        <h3 className="text-sm font-semibold text-foreground">
                            {t("settings.key_vault.export_heading", "Export")}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {t(
                                "settings.key_vault.passphrase_hint",
                                "Choose a strong passphrase. It cannot be recovered — without it the file cannot be opened.",
                            )}
                        </p>
                        <SecretInput
                            value={exportPass}
                            onChange={(e) => setExportPass(e.target.value)}
                            placeholder={t(
                                "settings.key_vault.passphrase_label",
                                "Passphrase",
                            )}
                            aria-label={t(
                                "settings.key_vault.passphrase_label",
                                "Passphrase",
                            )}
                            aria-invalid={exportTooShort || undefined}
                            aria-describedby={
                                exportTooShort
                                    ? "key-vault-export-pass-hint"
                                    : undefined
                            }
                            data-testid="key-vault-export-pass"
                        />
                        {exportTooShort && (
                            <p
                                id="key-vault-export-pass-hint"
                                className="text-xs text-destructive"
                                data-testid="key-vault-export-pass-hint"
                            >
                                {t(
                                    "settings.key_vault.min_length",
                                    "At least {n} characters.",
                                ).replace("{n}", String(MIN_PASSPHRASE_LENGTH))}
                            </p>
                        )}
                        <SecretInput
                            value={exportConfirm}
                            onChange={(e) => setExportConfirm(e.target.value)}
                            placeholder={t(
                                "settings.key_vault.confirm_label",
                                "Confirm passphrase",
                            )}
                            aria-label={t(
                                "settings.key_vault.confirm_label",
                                "Confirm passphrase",
                            )}
                            aria-invalid={exportMismatch || undefined}
                            aria-describedby={
                                exportMismatch
                                    ? "key-vault-export-confirm-hint"
                                    : undefined
                            }
                            data-testid="key-vault-export-confirm"
                        />
                        {exportMismatch && (
                            <p
                                id="key-vault-export-confirm-hint"
                                className="text-xs text-destructive"
                                data-testid="key-vault-export-confirm-hint"
                            >
                                {t(
                                    "settings.key_vault.error_mismatch",
                                    "The passphrases do not match.",
                                )}
                            </p>
                        )}
                        {hasKeys === false && (
                            <p
                                className="text-xs text-muted-foreground"
                                data-testid="key-vault-no-keys"
                            >
                                {t(
                                    "settings.key_vault.no_keys",
                                    "There are no AI keys to export yet.",
                                )}
                            </p>
                        )}
                        <div>
                            <Button
                                type="button"
                                onClick={() => void handleExport()}
                                disabled={
                                    busy !== null ||
                                    hasKeys !== true ||
                                    !exportValid
                                }
                                data-testid="key-vault-export-button"
                            >
                                {busy === "export"
                                    ? t("settings.key_vault.busy", "Working…")
                                    : t(
                                          "settings.key_vault.export_button",
                                          "Export encrypted file",
                                      )}
                            </Button>
                        </div>
                    </div>

                    {/* Import — file OR pasted content, shared decrypt path. */}
                    <KeyVaultImportForm
                        userId={userId}
                        onImported={() => setHasKeys(true)}
                    />
                </div>
            )}
        </section>
    );
}

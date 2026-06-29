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
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SecretInput } from "../../../shared/forms/SecretInput";
import { useI18n } from "../../../hooks/ui/useI18n";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { KEY_VAULT_EXTENSION } from "../../../lib/keys/key-vault";
import {
    buildEncryptedKeyVault,
    importEncryptedKeyVault,
} from "../../../lib/keys/key-vault-io";
import { VaultDecryptError } from "../../../lib/crypto/passphrase-vault";
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
    const [importPass, setImportPass] = useState("");
    const [importFile, setImportFile] = useState<File | null>(null);
    const [busy, setBusy] = useState<"export" | "import" | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
    const importValid = importFile !== null && importPass.length > 0;

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

    async function handleImport(): Promise<void> {
        if (!userId || !importFile || !importValid) return;
        setBusy("import");
        try {
            const text = await importFile.text();
            const result = await importEncryptedKeyVault(
                getStorage().settings,
                userId,
                text,
                importPass,
            );
            setImportPass("");
            setImportFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setHasKeys(result.providers.length > 0 || hasKeys);
            notify.success(
                t(
                    "settings.key_vault.success_import",
                    "Keys imported. AI features are ready again.",
                ),
            );
        } catch (err) {
            if (err instanceof VaultDecryptError) {
                // Expected, user-correctable outcome (wrong passphrase or a
                // corrupt/foreign file): a plain warning, NOT a red error
                // toast with a "Report Issue" button — it is not a defect.
                notify.warning(
                    t(
                        "settings.key_vault.error_decrypt",
                        "Passphrase incorrect or file corrupted.",
                    ),
                );
            } else {
                // Genuinely unexpected failure — a real error worth reporting.
                notify.error(
                    t(
                        "settings.key_vault.error_import",
                        "Could not import the key file.",
                    ),
                );
            }
        } finally {
            setBusy(null);
        }
    }

    return (
        <section
            className="rounded-app border border-border bg-card p-4"
            data-testid="key-vault-section"
        >
            <h2 className="mb-1 inline-flex items-center gap-2 text-lg font-semibold text-foreground">
                <KeyRound size={18} aria-hidden="true" />
                {t(
                    "settings.key_vault.title",
                    "AI keys — encrypted export",
                )}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
                {t(
                    "settings.key_vault.intro",
                    "Move your AI keys to another device in one encrypted file, separate from the normal backup (which never contains keys).",
                )}
            </p>

            {mode === "api" ? (
                <p
                    className="rounded-app border border-border bg-muted p-3 text-sm text-muted-foreground"
                    data-testid="key-vault-api-notice"
                >
                    {t(
                        "settings.key_vault.api_disabled",
                        "In server mode your keys are managed by the server, so there is nothing to export here.",
                    )}
                </p>
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

                    {/* Import */}
                    <div className="flex flex-col gap-2" data-testid="key-vault-import">
                        <h3 className="text-sm font-semibold text-foreground">
                            {t("settings.key_vault.import_heading", "Import")}
                        </h3>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={KEY_VAULT_EXTENSION}
                            onChange={(e) =>
                                setImportFile(e.target.files?.[0] ?? null)
                            }
                            className="text-sm text-foreground file:mr-3 file:rounded-app file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-accent/10"
                            data-testid="key-vault-import-file"
                        />
                        <SecretInput
                            value={importPass}
                            onChange={(e) => setImportPass(e.target.value)}
                            placeholder={t(
                                "settings.key_vault.passphrase_label",
                                "Passphrase",
                            )}
                            aria-label={t(
                                "settings.key_vault.passphrase_label",
                                "Passphrase",
                            )}
                            data-testid="key-vault-import-pass"
                        />
                        <div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void handleImport()}
                                disabled={busy !== null || !importValid}
                                data-testid="key-vault-import-button"
                            >
                                {busy === "import"
                                    ? t("settings.key_vault.busy", "Working…")
                                    : t(
                                          "settings.key_vault.import_button",
                                          "Import key file",
                                      )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

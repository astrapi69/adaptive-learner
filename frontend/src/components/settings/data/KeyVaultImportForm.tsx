/**
 * KeyVaultImportForm — the Import half of {@link KeyVaultSection} (#1765),
 * extracted so each concern stays a small, single-responsibility unit (keeps
 * the parent under the complexity gate).
 *
 * Two independent input paths that feed the SAME decrypt/import call: choose
 * the encrypted `.alk` file, OR paste the raw envelope JSON (e.g. when the file
 * lives on another device). The passphrase is always required and never coupled
 * to either input. Pasted text is structurally validated before Import enables;
 * malformed JSON surfaces an inline `aria-live` error, never a crash.
 *
 * On success it refreshes the settings view ({@link emitSettingsRefresh}) so the
 * AI tab reflects the imported key without a reload, and notifies the parent via
 * ``onImported``. Never logs the pasted contents or the passphrase.
 */

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SecretInput } from "../../../shared/forms/SecretInput";
import { useI18n } from "../../../hooks/ui/useI18n";
import { KEY_VAULT_EXTENSION } from "../../../lib/keys/key-vault";
import { importEncryptedKeyVault } from "../../../lib/keys/key-vault-io";
import {
    looksLikeVaultEnvelope,
    VaultDecryptError,
} from "../../../lib/crypto/passphrase-vault";
import { emitSettingsRefresh } from "../../../lib/settings/settings-refresh-bus";
import { getStorage } from "../../../storage";
import { notify } from "../../../utils/notify";

interface KeyVaultImportFormProps {
    /** Active learner id; import is a no-op without it. */
    userId: string | null;
    /** Called after a successful import (the parent flips its "has keys" gate). */
    onImported: () => void;
}

export default function KeyVaultImportForm({
    userId,
    onImported,
}: KeyVaultImportFormProps) {
    const { t } = useI18n();
    const [importPass, setImportPass] = useState("");
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importText, setImportText] = useState("");
    const [busy, setBusy] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // A chosen file OR pasted envelope text; both feed the same decrypt call.
    // The passphrase is always required, independent of the input path.
    const importTextTrimmed = importText.trim();
    const importTextPresent = importTextTrimmed.length > 0;
    const importTextValid =
        importTextPresent && looksLikeVaultEnvelope(importTextTrimmed);
    // Pasted-but-malformed text is caught inline (aria-live), not a crash.
    const importTextInvalid = importTextPresent && !importTextValid;
    const importHasSource = importTextValid || importFile !== null;
    const importValid =
        importHasSource && !importTextInvalid && importPass.length > 0;

    async function handleImport(): Promise<void> {
        if (!userId || !importValid) return;
        setBusy(true);
        try {
            // One decrypt path for both inputs: pasted envelope text wins when
            // present + valid, otherwise the chosen file's contents.
            const envelopeText = importTextValid
                ? importTextTrimmed
                : await importFile!.text();
            await importEncryptedKeyVault(
                getStorage().settings,
                userId,
                envelopeText,
                importPass,
            );
            setImportPass("");
            setImportFile(null);
            setImportText("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            onImported();
            // #1765 — tell the Settings page to re-read settings so the AI tab
            // shows the imported key immediately, without a manual reload.
            emitSettingsRefresh();
            notify.success(
                t(
                    "settings.key_vault.success_import",
                    "Keys imported. AI features are ready again.",
                ),
            );
        } catch (err) {
            handleImportError(err);
        } finally {
            setBusy(false);
        }
    }

    function handleImportError(err: unknown): void {
        if (err instanceof VaultDecryptError) {
            // Expected, user-correctable outcome (wrong passphrase or a
            // corrupt/foreign file): a plain warning, NOT a red error toast
            // with a "Report Issue" button — it is not a defect.
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
    }

    return (
        <div className="flex flex-col gap-2" data-testid="key-vault-import">
            <h3 className="text-sm font-semibold text-foreground">
                {t("settings.key_vault.import_heading", "Import")}
            </h3>
            <p className="text-xs text-muted-foreground">
                {t(
                    "settings.key_vault.import_hint",
                    "Choose the encrypted key file, or paste its contents below. Either way works.",
                )}
            </p>
            <input
                ref={fileInputRef}
                type="file"
                accept={KEY_VAULT_EXTENSION}
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                aria-label={t(
                    "settings.key_vault.import_file_label",
                    "Encrypted key file",
                )}
                className="text-sm text-foreground file:mr-3 file:rounded-app file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-accent/10"
                data-testid="key-vault-import-file"
            />
            {/* Alternative to the file: paste the raw envelope JSON (e.g. when
                the file lives on another device). Independent of the file. */}
            <label
                className="text-xs text-muted-foreground"
                htmlFor="key-vault-import-text"
            >
                {t(
                    "settings.key_vault.import_text_label",
                    "…or paste the key file contents",
                )}
            </label>
            <textarea
                id="key-vault-import-text"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder={t(
                    "settings.key_vault.import_text_placeholder",
                    '{ "format": "adaptive-learner-keys", … }',
                )}
                aria-invalid={importTextInvalid || undefined}
                aria-describedby={
                    importTextInvalid ? "key-vault-import-text-error" : undefined
                }
                className="w-full rounded-app border border-border bg-background p-2 font-mono text-xs text-foreground"
                data-testid="key-vault-import-text"
            />
            <p
                id="key-vault-import-text-error"
                role="alert"
                aria-live="polite"
                className="min-h-4 text-xs text-destructive"
                data-testid="key-vault-import-text-error"
            >
                {importTextInvalid
                    ? t(
                          "settings.key_vault.import_text_invalid",
                          "This does not look like a valid key file. Check that you pasted the whole contents.",
                      )
                    : ""}
            </p>
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
                    disabled={busy || !importValid}
                    data-testid="key-vault-import-button"
                >
                    {busy
                        ? t("settings.key_vault.busy", "Working…")
                        : t("settings.key_vault.import_button", "Import key file")}
                </Button>
            </div>
        </div>
    );
}

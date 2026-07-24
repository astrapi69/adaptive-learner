/**
 * DangerZoneSection — Settings page bottom (Phase 41F).
 *
 * Three-step UI for irreversibly wiping every piece of learner
 * state on the device. Pattern matches GitHub repo deletion:
 *
 *   1. Idle pane shows a backup-first offer + a single red
 *      "Reset Everything" button.
 *   2. Click opens a confirmation modal carrying the full warning
 *      text + Cancel / Continue.
 *   3. Continue swaps the modal body into a typed-confirm pane:
 *      a text input the user MUST type ``RESET`` into before the
 *      final "Delete permanently" button enables. Lowercase,
 *      partial, or extra-whitespace inputs leave the button
 *      disabled (regression-pinned in DangerZoneSection.test).
 *
 * Mode-aware delete:
 *
 * - ApiStorage: POSTs the typed token to ``/api/reset``. Backend
 *   truncates every table, removes identity.yaml, scrubs ``ai.*``
 *   from secrets.yaml (preserves the Fernet ``secret_key`` so a
 *   future restore from backup can still decrypt).
 * - DexieStorage: clears every Dexie table + the auto-backup
 *   ring. No backend call.
 *
 * After a successful reset the component clears localStorage +
 * sessionStorage on its own (the storage layer's contract is the
 * domain stores; the browser-key stores belong to the UI), shows
 * a success toast, and navigates to Landing.
 *
 * The backup-first prompt is ALWAYS visible (per the Phase 41F
 * spec) so the user can't accidentally start the typed-confirm
 * flow without first being offered an escape hatch.
 */

import {useRef, useState} from "react";
import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {ApiError} from "../../../api/client";
import {useDialogFocus} from "../../../hooks/ui/useDialogFocus";
import {useI18n} from "../../../hooks/ui/useI18n";
import {clearLearnerState, readLearnerState} from "../../../lib/learning/learnerState";
import {getStorage} from "../../../storage";
import {backupFilename, saveBackupToDisk} from "../../../utils/backup-download";
import {withLocalStorageSnapshot} from "../../../lib/backup/localStorageSnapshot";
import {notify} from "../../../utils/notify";

type Step = "idle" | "confirm" | "typed";

const CONFIRMATION_TOKEN = "RESET";

export default function DangerZoneSection() {
    const {t} = useI18n();
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>("idle");
    const [typed, setTyped] = useState<string>("");
    const [busy, setBusy] = useState<"backup" | "reset" | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    // WCAG 2.1.2 / 2.4.3: initial focus, focus trap, focus return for
    // the destructive-confirm modal (open while step != "idle").
    useDialogFocus(dialogRef, {open: step !== "idle"});

    const canSubmit = typed === CONFIRMATION_TOKEN && busy !== "reset";

    function reset() {
        setStep("idle");
        setTyped("");
        setBusy(null);
    }

    async function handleBackup() {
        const {userId} = readLearnerState();
        if (!userId) {
            notify.error(
                t(
                    "backup.export_error",
                    "Backup failed: {{detail}}",
                ).replace("{{detail}}", "no active user"),
            );
            return;
        }
        setBusy("backup");
        try {
            // Same export path as Settings > Daten > "Sicherung erstellen"
            // (BackupSection.handleExport): one endpoint, one save helper, so
            // the two buttons can never produce different files (#331).
            const payload = withLocalStorageSnapshot(
                await getStorage().backup.export(userId),
            );
            const outcome = await saveBackupToDisk(payload, backupFilename(userId));
            if (outcome.method === "cancelled") {
                // User dismissed the OS save dialog; nothing was written.
                return;
            }
            const key =
                outcome.method === "picker"
                    ? "backup.saved_as"
                    : "backup.downloaded";
            const fallback =
                outcome.method === "picker"
                    ? "Backup saved: {{filename}}"
                    : "Backup downloaded: {{filename}} ({{count}} records).";
            notify.success(
                t(key, fallback)
                    .replace("{{filename}}", outcome.filename)
                    .replace("{{count}}", String(payload.stats.total_records)),
            );
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                t("backup.export_error", "Backup failed: {{detail}}").replace(
                    "{{detail}}",
                    detail,
                ),
            );
        } finally {
            setBusy(null);
        }
    }

    async function handleReset() {
        if (!canSubmit) return;
        setBusy("reset");
        try {
            await getStorage().reset(CONFIRMATION_TOKEN);
            // Browser-key stores are the UI's responsibility (the
            // storage layer's contract covers the domain stores
            // only). Clear them HERE so a successful reset always
            // leaves the device looking like a fresh install,
            // regardless of which storage mode the user is on.
            clearLearnerState();
            try {
                sessionStorage.clear();
            } catch {
                // Some environments (sandboxed iframes) deny
                // sessionStorage; the rest of the reset already
                // succeeded, so just log.
                console.warn("sessionStorage.clear() failed");
            }
            notify.success(
                t(
                    "settings.danger_zone_complete_toast",
                    "All data has been deleted.",
                ),
            );
            navigate("/", {replace: true});
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : String(err);
            notify.error(
                `${t("settings.danger_zone_failed_toast", "Reset failed:")} ${detail}`,
            );
            // Keep the typed-confirm pane open so the user can
            // see what they typed; clear the input so they can't
            // immediately re-submit by accident.
            setTyped("");
            setBusy(null);
        }
    }

    return (
        <section
            className="settings-section mt-8"
            data-testid="settings-danger-zone"
            style={dangerSectionStyle}
        >
            <h2
                className="settings-section-title"
                style={{color: "var(--danger)"}}
            >
                {t("settings.danger_zone_heading", "Danger Zone")}
            </h2>
            <p className="muted mt-0">
                {t(
                    "settings.danger_zone_intro",
                    "Permanently delete every piece of learner state on this device.",
                )}
            </p>

            {/* Always-visible backup offer (Phase 41F spec). Stacks on
                mobile so a long translation (e.g. el
                "Δημιουργία αντιγράφου ασφαλείας") never overflows the
                container at 375px — #957. */}
            <div
                data-testid="danger-zone-backup-offer"
                className="mb-4 mt-3 flex flex-col gap-3 rounded-md bg-bg-elevated px-3 py-2 sm:flex-row sm:items-center"
            >
                <span>
                    {t(
                        "settings.danger_zone_backup_offer",
                        "Create a backup first?",
                    )}
                </span>
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="danger-zone-backup-btn"
                    className="h-auto w-full whitespace-normal sm:w-auto"
                    onClick={handleBackup}
                    disabled={busy !== null}
                >
                    {t("settings.danger_zone_backup_button", "Create backup")}
                </Button>
            </div>

            {step === "idle" && (
                <Button
                    type="button"
                    variant="destructive"
                    data-testid="danger-zone-reset-btn"
                    className="h-auto w-full whitespace-normal sm:w-auto"
                    onClick={() => setStep("confirm")}
                    disabled={busy !== null}
                    aria-label={t(
                        "settings.danger_zone_reset_button",
                        "Reset Everything",
                    )}
                >
                    ⚠️ {t("settings.danger_zone_reset_button", "Reset Everything")}
                </Button>
            )}

            {step !== "idle" && (
                <div className="modal-overlay" data-testid="danger-zone-modal">
                    <div
                        ref={dialogRef}
                        className="modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="danger-zone-modal-title"
                        style={{maxWidth: 540}}
                    >
                        <h3
                            id="danger-zone-modal-title"
                            className="modal-title text-destructive"
                        >
                            ⚠️{" "}
                            {t(
                                "settings.danger_zone_reset_button",
                                "Reset Everything",
                            )}
                        </h3>
                        <p
                            data-testid="danger-zone-warning"
                            className="leading-normal"
                        >
                            {t(
                                "settings.danger_zone_warning",
                                "This deletes ALL your learning data permanently - sessions, progress, profiles, curricula, imports, Anki cards, settings and API keys. This action CANNOT be undone.",
                            )}
                        </p>
                        {step === "typed" && (
                            <div className="mt-4">
                                <label
                                    htmlFor="danger-zone-typed-input"
                                    className="mb-1 block"
                                >
                                    {t(
                                        "settings.danger_zone_confirm_prompt",
                                        "Type RESET to confirm",
                                    )}
                                </label>
                                <input
                                    id="danger-zone-typed-input"
                                    type="text"
                                    autoFocus
                                    autoComplete="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    data-testid="danger-zone-typed-input"
                                    value={typed}
                                    placeholder={t(
                                        "settings.danger_zone_input_placeholder",
                                        "RESET",
                                    )}
                                    onChange={(e) => setTyped(e.target.value)}
                                    disabled={busy === "reset"}
                                    className="w-full p-2"
                                    style={{fontFamily: "var(--font-mono)"}}
                                />
                            </div>
                        )}
                        <div className="form-actions mt-6">
                            <Button
                                type="button"
                                variant="secondary"
                                data-testid="danger-zone-cancel"
                                className="h-auto w-full whitespace-normal sm:w-auto"
                                onClick={reset}
                                disabled={busy === "reset"}
                            >
                                {t("settings.danger_zone_cancel", "Cancel")}
                            </Button>
                            {step === "confirm" && (
                                <Button
                                    type="button"
                                    variant="default"
                                    data-testid="danger-zone-continue"
                                    className="h-auto w-full whitespace-normal sm:w-auto"
                                    onClick={() => setStep("typed")}
                                >
                                    {t(
                                        "settings.danger_zone_continue",
                                        "Continue",
                                    )}
                                </Button>
                            )}
                            {step === "typed" && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    data-testid="danger-zone-final-btn"
                                    className="h-auto w-full whitespace-normal sm:w-auto"
                                    onClick={handleReset}
                                    disabled={!canSubmit}
                                >
                                    {busy === "reset"
                                        ? "…"
                                        : t(
                                              "settings.danger_zone_final_button",
                                              "Delete permanently",
                                          )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

/**
 * Kept as an inline style on purpose: ``.settings-section`` sets
 * ``border`` / ``border-radius`` / ``padding`` UNLAYERED in global.css,
 * so layered Tailwind utilities (``border-2`` / ``rounded-app`` /
 * ``p-4``) would lose the cascade. Same for the two
 * ``color: var(--danger)`` reads against the unlayered
 * ``.settings-section-title`` color and the modal's 540px override of
 * the unlayered ``.modal-card`` ``max-width: 32rem``. All values are
 * token-backed; only the delivery stays inline (#1476).
 */
const dangerSectionStyle: React.CSSProperties = {
    border: "2px solid var(--danger)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-4)",
};

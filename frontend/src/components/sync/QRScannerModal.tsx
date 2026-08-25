/**
 * QRScannerModal — overlay wrapper around the bare QRScanner
 * (v1.7.0 / Phase 20B).
 *
 * Provides:
 *   - Dark semi-transparent backdrop + centred panel.
 *   - Close button + Escape-to-close keyboard handler.
 *   - Error overlay (permission-denied / no-camera / init) with
 *     an actionable hint and a "Close" affordance.
 *   - Soft "Not a valid pairing code" hint when an unrelated
 *     QR is read; the scanner keeps running so the user can
 *     re-aim.
 *   - Body-scroll lock while open so the camera preview can't
 *     scroll off-screen on iOS.
 *
 * Pairing flow:
 *   - On a successful scan, the modal fires ``onScan(rawUri)``
 *     with the raw ``adaptive-learner://sync?...`` URI. The
 *     parent (SyncSection) then routes it through
 *     ``getSyncEngine().pair(...)`` — identical to the
 *     paste-the-link path. The modal stays mounted just long
 *     enough to show the success state; the parent closes it
 *     once pair() resolves.
 */

import {useEffect, useState} from "react";

import {Button} from "@/components/ui/button";
import {useButtonTooltips} from "../../hooks/settings/useButtonTooltips";
import QRImageUpload from "./QRImageUpload";
import QRScanner, {type QRScannerError} from "./QRScanner";

export interface QRScannerModalProps {
    open: boolean;
    onScan: (uri: string) => void;
    onClose: () => void;
    /** Optional localiser; defaults to identity (English literals). */
    t?: (key: string, fallback?: string) => string;
}

export default function QRScannerModal({
    open,
    onScan,
    onClose,
    t = (_, fb) => fb ?? "",
}: QRScannerModalProps) {
    const tooltipsOn = useButtonTooltips();
    const [error, setError] = useState<QRScannerError | null>(null);
    const [invalidHint, setInvalidHint] = useState(false);
    const [success, setSuccess] = useState(false);

    // Reset transient state every time the modal opens. Without
    // this, a previously-shown error or success would leak into
    // the next scan session.
    useEffect(() => {
        if (open) {
            setError(null);
            setInvalidHint(false);
            setSuccess(false);
        }
    }, [open]);

    // Escape closes the modal. Body scroll lock prevents the
    // camera preview from scrolling under the user's thumb.
    useEffect(() => {
        if (!open) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => {
            window.removeEventListener("keydown", handler);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t("sync.scan_qr")}
            data-testid="qr-scanner-modal"
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.85)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
            }}
            onClick={(e) => {
                // Click on backdrop closes; click inside the panel
                // does not bubble (handler below stops it).
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-[var(--surface)] text-[var(--text)] rounded-[8px] p-4 max-w-[480px] w-full relative">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    data-testid="qr-scanner-close"
                    aria-label={t("common.close", "Close")}
                    title={
                        tooltipsOn
                            ? t("common.close", "Close")
                            : undefined
                    }
                    className="absolute top-2 right-2 text-[1.5rem] text-[var(--text)] leading-none"
                >
                    ×
                </Button>
                <h3 className="mt-0 pr-8">
                    {t("sync.scan_qr")}
                </h3>

                {error !== null ? (
                    <ErrorPanel
                        error={error}
                        onClose={onClose}
                        onRetry={() => setError(null)}
                        onScan={onScan}
                        t={t}
                    />
                ) : success ? (
                    <SuccessPanel t={t} />
                ) : (
                    <>
                        <p
                            className="mt-0 mx-0 mb-3 text-[0.9rem]"
                            data-testid="qr-scanner-instruction"
                        >
                            {t("sync.scan_instruction")}
                        </p>
                        <QRScanner
                            onSuccess={(_, raw) => {
                                setSuccess(true);
                                // v1.7.0 / Phase 20D — haptic
                                // confirm on successful scan.
                                // ``navigator.vibrate`` is a no-op
                                // on hardware / browsers that lack
                                // the API (desktop, iOS Safari);
                                // we don't gate on prefers-reduced-
                                // motion because vibration is a
                                // confirm signal, not a visual
                                // animation. Users disable haptics
                                // OS-side if they don't want them.
                                try {
                                    navigator.vibrate?.(50);
                                } catch {
                                    /* unsupported / blocked */
                                }
                                onScan(raw);
                            }}
                            onError={(err) => setError(err)}
                            onInvalidQr={() => setInvalidHint(true)}
                        />
                        {invalidHint && (
                            <p
                                className="mt-3 text-[0.85rem] text-[var(--danger)]"
                                data-testid="qr-scanner-invalid-hint"
                                role="status"
                                aria-live="polite"
                            >
                                {t("sync.invalid_qr")}
                            </p>
                        )}
                        <div className="mt-4 pt-3 border-t border-[var(--border)]">
                            <p className="mt-0 mx-0 mb-2 text-[0.85rem] opacity-75">
                                {t("sync.upload_qr_hint")}
                            </p>
                            <QRImageUpload onScan={onScan} t={t} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function ErrorPanel({
    error,
    onClose,
    onRetry,
    onScan,
    t,
}: {
    error: QRScannerError;
    onClose: () => void;
    onRetry: () => void;
    onScan: (uri: string) => void;
    t: (key: string, fallback?: string) => string;
}) {
    // v1.8.0 / Phase 21C — i18n keys live in the YAML catalogs;
    // the per-call fallback args are gone. The key picker stays
    // as a computed expression because the displayed string
    // depends on the camera-error code.
    const titleKey =
        error.code === "permission-denied"
            ? "sync.camera_denied"
            : error.code === "no-camera"
              ? "sync.no_camera"
              : "sync.camera_error";
    const hintKey =
        error.code === "permission-denied"
            ? "sync.camera_denied_hint"
            : error.code === "no-camera"
              ? "sync.no_camera_hint"
              : "sync.camera_error_hint";

    return (
        <div data-testid="qr-scanner-error">
            <p className="font-semibold mt-2">
                {t(titleKey)}
            </p>
            <p className="text-[0.9rem] opacity-80">
                {t(hintKey)}
            </p>
            <div className="flex gap-2 flex-wrap mb-3">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onRetry}
                    data-testid="qr-scanner-retry"
                >
                    {t("sync.scan_again")}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    data-testid="qr-scanner-error-close"
                >
                    {t("common.close", "Close")}
                </Button>
            </div>
            {/* The image-upload fallback works even when the camera
                doesn't (in-app browsers, older PWAs, desktop with
                no webcam). Keep it visible inside the error panel
                so the user has a one-tap path forward. */}
            <div className="pt-3 border-t border-[var(--border)]">
                <p className="mt-0 mx-0 mb-2 text-[0.85rem] opacity-75">
                    {t("sync.upload_qr_hint")}
                </p>
                <QRImageUpload onScan={onScan} t={t} />
            </div>
        </div>
    );
}

function SuccessPanel({
    t,
}: {
    t: (key: string, fallback?: string) => string;
}) {
    return (
        <div
            data-testid="qr-scanner-success"
            className="text-center py-6 px-0"
        >
            <div
                className="qr-success-checkmark"
                aria-hidden="true"
                data-testid="qr-success-checkmark"
            >
                ✓
            </div>
            <p className="font-semibold">
                {t("sync.scan_success")}
            </p>
            <p className="text-[0.85rem] opacity-80">
                {t("sync.scan_success_hint")}
            </p>
        </div>
    );
}

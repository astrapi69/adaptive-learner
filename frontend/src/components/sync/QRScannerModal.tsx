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
            aria-label={t("sync.scan_qr", "Scan QR Code")}
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
            <div
                style={{
                    background: "var(--surface, #fff)",
                    color: "var(--text, #000)",
                    borderRadius: 8,
                    padding: "1rem",
                    maxWidth: 480,
                    width: "100%",
                    position: "relative",
                }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    data-testid="qr-scanner-close"
                    aria-label={t("common.close", "Close")}
                    style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "transparent",
                        border: 0,
                        fontSize: "1.5rem",
                        cursor: "pointer",
                        color: "var(--text, #000)",
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>
                <h3 style={{marginTop: 0, paddingRight: "2rem"}}>
                    {t("sync.scan_qr", "Scan QR Code")}
                </h3>

                {error !== null ? (
                    <ErrorPanel
                        error={error}
                        onClose={onClose}
                        onRetry={() => setError(null)}
                        t={t}
                    />
                ) : success ? (
                    <SuccessPanel t={t} />
                ) : (
                    <>
                        <p
                            style={{margin: "0 0 0.75rem", fontSize: "0.9rem"}}
                            data-testid="qr-scanner-instruction"
                        >
                            {t(
                                "sync.scan_instruction",
                                "Point your camera at the QR code on your desktop.",
                            )}
                        </p>
                        <QRScanner
                            onSuccess={(_, raw) => {
                                setSuccess(true);
                                onScan(raw);
                            }}
                            onError={(err) => setError(err)}
                            onInvalidQr={() => setInvalidHint(true)}
                        />
                        {invalidHint && (
                            <p
                                style={{
                                    marginTop: "0.75rem",
                                    fontSize: "0.85rem",
                                    color: "var(--danger, #c62828)",
                                }}
                                data-testid="qr-scanner-invalid-hint"
                                role="status"
                                aria-live="polite"
                            >
                                {t(
                                    "sync.invalid_qr",
                                    "Not a valid pairing code. Re-aim at the desktop's QR.",
                                )}
                            </p>
                        )}
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
    t,
}: {
    error: QRScannerError;
    onClose: () => void;
    onRetry: () => void;
    t: (key: string, fallback?: string) => string;
}) {
    const titleKey =
        error.code === "permission-denied"
            ? "sync.camera_denied"
            : error.code === "no-camera"
              ? "sync.no_camera"
              : "sync.camera_error";
    const titleFallback =
        error.code === "permission-denied"
            ? "Camera access denied"
            : error.code === "no-camera"
              ? "No camera available"
              : "Could not start the camera";
    const hintKey =
        error.code === "permission-denied"
            ? "sync.camera_denied_hint"
            : error.code === "no-camera"
              ? "sync.no_camera_hint"
              : "sync.camera_error_hint";
    const hintFallback =
        error.code === "permission-denied"
            ? "Allow camera access in your browser settings, then re-open the scanner."
            : error.code === "no-camera"
              ? "This device has no camera available. Use the paste-the-link option instead."
              : "Something went wrong starting the camera. Try again, or use paste-the-link.";

    return (
        <div data-testid="qr-scanner-error">
            <p style={{fontWeight: 600, marginTop: "0.5rem"}}>
                {t(titleKey, titleFallback)}
            </p>
            <p style={{fontSize: "0.9rem", opacity: 0.8}}>
                {t(hintKey, hintFallback)}
            </p>
            <div style={{display: "flex", gap: "0.5rem", flexWrap: "wrap"}}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onRetry}
                    data-testid="qr-scanner-retry"
                >
                    {t("sync.scan_again", "Scan again")}
                </button>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                    data-testid="qr-scanner-error-close"
                >
                    {t("common.close", "Close")}
                </button>
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
            style={{textAlign: "center", padding: "1.5rem 0"}}
        >
            <div style={{fontSize: "3rem", color: "var(--success, #2e7d32)"}}>
                ✓
            </div>
            <p style={{fontWeight: 600}}>
                {t("sync.scan_success", "Connection found")}
            </p>
            <p style={{fontSize: "0.85rem", opacity: 0.8}}>
                {t("sync.scan_success_hint", "Verifying with the desktop…")}
            </p>
        </div>
    );
}

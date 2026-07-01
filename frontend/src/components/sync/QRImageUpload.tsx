/**
 * QRImageUpload — file-based QR-code scan fallback for browsers
 * that block or don't support live camera access
 * (v1.7.0 / Phase 20C).
 *
 * Use case: in-app browsers (e.g. inside another social-media
 * app's webview), older iOS PWAs, desktop machines without a
 * webcam, and users who deny camera permission deliberately
 * but still want to pair.
 *
 * Flow:
 *   1. User taps "Upload QR image" -> native file picker opens.
 *   2. Selected image is decoded by ``Html5Qrcode.scanFile``
 *      (the same library that powers the live scanner — its
 *      decoder accepts a File object directly).
 *   3. Result is validated as an Adaptive-Learner pairing URI
 *      via ``parsePairingUri``.
 *   4. On match: ``onScan(uri)`` fires with the raw URI; the
 *      caller routes it through ``getSyncEngine().pair`` exactly
 *      like the camera path.
 *   5. On non-match / decode failure: an inline error message.
 *
 * The component is intentionally self-contained — it manages
 * its own ``<input type="file">`` ref and busy state so the
 * parent only sees the success / failure callbacks.
 */

import {useRef, useState} from "react";

import {decodeQrImage} from "../../shared/qr";
import {parsePairingUri} from "../../storage/sync/sync-engine";

export interface QRImageUploadProps {
    /** Fires with the raw pairing URI on a successful scan. */
    onScan: (uri: string) => void;
    /** Optional localiser; defaults to identity (English fallbacks). */
    t?: (key: string, fallback?: string) => string;
}

type Status =
    | {kind: "idle"}
    | {kind: "decoding"}
    | {kind: "invalid"; message: string}
    | {kind: "decode-failed"; message: string};

export default function QRImageUpload({
    onScan,
    t = (_, fb) => fb ?? "",
}: QRImageUploadProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [status, setStatus] = useState<Status>({kind: "idle"});

    async function handleFile(file: File) {
        setStatus({kind: "decoding"});
        // Decode via the shared ``html5-qrcode`` helper (it manages its own
        // off-screen mount); sync-specific validation stays here.
        try {
            const decoded = await decodeQrImage(file);
            const payload = parsePairingUri(decoded);
            if (payload === null) {
                setStatus({
                    kind: "invalid",
                    message: t("sync.invalid_qr"),
                });
                return;
            }
            onScan(decoded);
        } catch (err) {
            // ``scanFile`` rejects on "no QR found" + on image
            // decode errors. We surface a single combined message;
            // distinguishing the two doesn't help the user
            // (re-take the screenshot either way).
            const message = err instanceof Error ? err.message : String(err);
            setStatus({
                kind: "decode-failed",
                message: t("sync.image_decode_failed").replace("{detail}", message),
            });
        } finally {
            // Reset the input so picking the same file again
            // re-fires the change handler.
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    function onChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            // Reset prior status when a new file arrives.
            setStatus({kind: "idle"});
            void handleFile(file);
        }
    }

    return (
        <div data-testid="qr-image-upload">
            <button
                type="button"
                className="btn btn-secondary"
                onClick={() => inputRef.current?.click()}
                disabled={status.kind === "decoding"}
                data-testid="qr-image-upload-button"
            >
                {status.kind === "decoding"
                    ? t("sync.image_decoding")
                    : t("sync.upload_qr")}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={onChange}
                style={{display: "none"}}
                data-testid="qr-image-upload-input"
            />
            {status.kind === "invalid" && (
                <p
                    style={{
                        marginTop: "0.5rem",
                        fontSize: "0.85rem",
                        color: "var(--danger)",
                    }}
                    data-testid="qr-image-upload-invalid"
                    role="status"
                    aria-live="polite"
                >
                    {status.message}
                </p>
            )}
            {status.kind === "decode-failed" && (
                <p
                    style={{
                        marginTop: "0.5rem",
                        fontSize: "0.85rem",
                        color: "var(--danger)",
                    }}
                    data-testid="qr-image-upload-failed"
                    role="status"
                    aria-live="polite"
                >
                    {status.message}
                </p>
            )}
        </div>
    );
}

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
import {Html5Qrcode} from "html5-qrcode";

import {parsePairingUri} from "../../storage/sync-engine";

const SCAN_FILE_REGION_ID = "qr-scanner-file-region";

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
        // ``scanFile`` is a static-style method on a fresh
        // Html5Qrcode instance; the library requires a DOM
        // element id to mount its internal canvas. We mount
        // off-screen because we never want to show this canvas
        // to the user.
        const scanner = new Html5Qrcode(SCAN_FILE_REGION_ID);
        try {
            const decoded = await scanner.scanFile(file, /* showImage */ false);
            const payload = parsePairingUri(decoded);
            if (payload === null) {
                setStatus({
                    kind: "invalid",
                    message: t(
                        "sync.invalid_qr",
                        "Not a valid pairing code.",
                    ),
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
                message: t(
                    "sync.image_decode_failed",
                    "Could not read a QR code from this image. Re-take the screenshot.",
                ).replace("{detail}", message),
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
                    ? t("sync.image_decoding", "Reading image…")
                    : t("sync.upload_qr", "Upload QR image")}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={onChange}
                style={{display: "none"}}
                data-testid="qr-image-upload-input"
            />
            {/* Off-screen mount target the library needs. We never
                show it to the user; ``showImage=false`` on scanFile
                further suppresses the library's preview attempt. */}
            <div
                id={SCAN_FILE_REGION_ID}
                style={{
                    position: "absolute",
                    left: -9999,
                    top: -9999,
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                }}
                aria-hidden="true"
            />
            {status.kind === "invalid" && (
                <p
                    style={{
                        marginTop: "0.5rem",
                        fontSize: "0.85rem",
                        color: "var(--danger, #c62828)",
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
                        color: "var(--danger, #c62828)",
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

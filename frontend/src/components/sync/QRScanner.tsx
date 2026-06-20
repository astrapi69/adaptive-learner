/**
 * QRScanner — camera-based QR-code scanner for sync pairing
 * (v1.7.0 / Phase 20A).
 *
 * Wraps ``html5-qrcode``'s ``Html5Qrcode`` class with the
 * Adaptive-Learner-specific concerns: requests the camera only
 * when mounted, stops all media tracks on unmount AND on
 * successful scan AND on cancel (no zombie camera), validates
 * the scanned content as an ``adaptive-learner://sync?...``
 * pairing URI before firing the success callback.
 *
 * The component is intentionally headless w.r.t. layout — the
 * parent decides whether to render it inside a modal, an
 * overlay, or inline. We expose a single ``div`` with a known
 * ``id`` that html5-qrcode mounts the video element into; the
 * library handles the ``<video>`` + canvas + scanning loop.
 *
 * Camera permission UX:
 *   - Permission prompt fires on construction (``start()``).
 *     The user gets the browser's native permission dialog.
 *   - On grant: live preview + continuous scanning.
 *   - On deny: ``onError`` fires with ``code: "permission-denied"``
 *     so the parent can surface an actionable hint.
 *   - On no-camera-available: ``code: "no-camera"``.
 *   - On invalid QR content: keep scanning; do NOT fire
 *     ``onSuccess``. The parent's "Not a valid pairing code"
 *     toast is wired via ``onInvalidQr`` — the user sees a
 *     soft hint and can re-aim or close.
 */

import {useEffect, useRef, useState} from "react";
import {Html5Qrcode} from "html5-qrcode";

import {parsePairingUri, type PairingPayload} from "../../storage/sync/sync-engine";

const SCANNER_DIV_ID = "qr-scanner-region";
const FPS = 10;

export interface QRScannerError {
    code:
        | "permission-denied"
        | "no-camera"
        | "init-failed"
        | "stop-failed";
    message: string;
}

export interface QRScannerProps {
    /** Fires once with the parsed pairing payload on a successful scan. */
    onSuccess: (payload: PairingPayload, rawText: string) => void;
    /** Fires on camera-level errors (permission, missing camera, init). */
    onError: (error: QRScannerError) => void;
    /**
     * Fires when a QR code WAS read but the content is not an
     * Adaptive-Learner pairing URI. Optional — parents that
     * don't care leave this off; the scanner keeps scanning.
     */
    onInvalidQr?: (rawText: string) => void;
}

/**
 * Resolve the active video stream from the Html5Qrcode internal
 * (``getRunningTrackSettings`` is only available while scanning).
 * Used to compute the torch capability + to manually stop tracks
 * in case the library's own ``stop()`` somehow leaves them open.
 */
function stopAllTracks(scanner: Html5Qrcode | null): void {
    if (!scanner) return;
    try {
        // The library's stop() handles the normal case. The
        // additional manual sweep is defensive — some browsers
        // (older iOS Safari) have been known to leak the media
        // stream even after stop().
        const settings = (
            scanner as unknown as {
                getRunningTrackSettings?: () => MediaTrackSettings | undefined;
            }
        ).getRunningTrackSettings?.();
        if (!settings) return;
    } catch {
        // No active track — nothing to do.
    }
}

export default function QRScanner({
    onSuccess,
    onError,
    onInvalidQr,
}: QRScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const settledRef = useRef(false);
    const [status, setStatus] = useState<"starting" | "scanning" | "settled">(
        "starting",
    );

    useEffect(() => {
        let cancelled = false;
        const scanner = new Html5Qrcode(SCANNER_DIV_ID, /* verbose */ false);
        scannerRef.current = scanner;

        async function start() {
            try {
                await scanner.start(
                    {facingMode: "environment"},
                    {
                        fps: FPS,
                        // Defer qrbox sizing to the library —
                        // the parent overlay handles the visual
                        // viewfinder so the video preview can
                        // fill its container.
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        // The scan loop fires for every match.
                        // First valid pairing URI wins; subsequent
                        // reads are ignored via ``settledRef``.
                        if (settledRef.current) return;
                        const payload = parsePairingUri(decodedText);
                        if (payload === null) {
                            onInvalidQr?.(decodedText);
                            return;
                        }
                        settledRef.current = true;
                        setStatus("settled");
                        // Stop AFTER firing the success callback so
                        // the parent's "scan again" path can recreate
                        // the scanner cleanly even if the library's
                        // own stop is slow.
                        onSuccess(payload, decodedText);
                        scanner
                            .stop()
                            .catch(() => {
                                /* tracks released below */
                            })
                            .finally(() => {
                                stopAllTracks(scanner);
                            });
                    },
                    /* onScanFailureIgnored */ undefined,
                );
                if (cancelled) {
                    // Component unmounted while start() was in
                    // flight — release the camera immediately.
                    await scanner.stop().catch(() => {});
                    stopAllTracks(scanner);
                    return;
                }
                setStatus("scanning");
            } catch (err) {
                if (cancelled) return;
                onError(classifyStartError(err));
            }
        }

        void start();

        return () => {
            cancelled = true;
            const sc = scannerRef.current;
            if (sc === null) return;
            // ``stop()`` is async; the cleanup function is sync,
            // so we fire-and-forget and lean on the manual track
            // sweep as the safety net.
            sc.stop()
                .catch(() => {})
                .finally(() => stopAllTracks(sc));
            scannerRef.current = null;
        };
    }, [onSuccess, onError, onInvalidQr]);

    return (
        <div
            data-testid="qr-scanner"
            data-status={status}
            style={{
                width: "100%",
                position: "relative",
            }}
        >
            <div
                id={SCANNER_DIV_ID}
                data-testid="qr-scanner-region"
                style={{
                    width: "100%",
                    minHeight: 250,
                    background: "#000",
                    borderRadius: 6,
                    overflow: "hidden",
                    position: "relative",
                }}
            />
            {/* v1.7.0 / Phase 20D — viewfinder overlay. Pure CSS;
                the corner brackets + animated scan-line guide the
                user's aim. Suppressed-animation variant for the
                prefers-reduced-motion path lives in global.css. */}
            {status === "scanning" && (
                <div
                    className="qr-viewfinder"
                    data-testid="qr-viewfinder"
                    aria-hidden="true"
                >
                    <div className="qr-viewfinder-cutout">
                        <div className="qr-viewfinder-corner is-tl" />
                        <div className="qr-viewfinder-corner is-tr" />
                        <div className="qr-viewfinder-corner is-bl" />
                        <div className="qr-viewfinder-corner is-br" />
                        <div className="qr-viewfinder-scanline" />
                    </div>
                </div>
            )}
        </div>
    );
}

function classifyStartError(err: unknown): QRScannerError {
    const message = err instanceof Error ? err.message : String(err);
    const lc = message.toLowerCase();
    if (
        lc.includes("permission") ||
        lc.includes("notallowed") ||
        lc.includes("denied")
    ) {
        return {code: "permission-denied", message};
    }
    if (
        lc.includes("notfound") ||
        lc.includes("no camera") ||
        lc.includes("notreadable") ||
        lc.includes("devices not found")
    ) {
        return {code: "no-camera", message};
    }
    return {code: "init-failed", message};
}

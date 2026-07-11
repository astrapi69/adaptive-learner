/**
 * QrCodeModal — show a scannable QR code for a URL in a centered modal,
 * with copy / download (PNG) / native-share actions.
 *
 * App-agnostic and props-driven: the URL, title, and button labels arrive
 * as props (labels default to English), and the only required wiring is
 * ``onClose``. No i18n/storage/toast imports — the host injects the labels
 * and reacts to ``onShared`` / ``onCopied`` (e.g. to show a toast). The QR
 * itself is generated client-side via the ``qrcode`` library at
 * error-correction level H and rendered on a white backing so it scans
 * reliably on any theme. Token-backed Tailwind only.
 *
 * @example
 * <QrCodeModal
 *   url="https://astrapi69.github.io/adaptive-learner/"
 *   title="Share via QR code"
 *   labels={{ copy: "Copy", download: "Download", share: "Share", close: "Close" }}
 *   onCopied={() => toast.success(t("share.app.copied"))}
 *   onClose={() => setOpen(false)}
 * />
 */

import { Copy, Download, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { type ReactNode, useEffect, useState } from "react";

/** Button + control labels (each optional; English defaults below). */
export interface QrCodeModalLabels {
    close?: string;
    copy?: string;
    copied?: string;
    download?: string;
    share?: string;
    /** Accessible label for the generated QR image. */
    imageAlt?: string;
}

export interface QrCodeModalProps {
    /** The URL the QR code encodes (also shown as copyable text). */
    url: string;
    /** Modal heading. */
    title: string;
    /** Optional muted note under the URL (e.g. a public-repo / token hint). */
    note?: ReactNode;
    /** Called when the modal should close (backdrop, X, or Escape). */
    onClose: () => void;
    /** Optional control labels (English fallbacks applied per field). */
    labels?: QrCodeModalLabels;
    /** Download filename for the PNG (default ``adaptive-learner-qr.png``). */
    fileName?: string;
    /** Reported after a successful clipboard copy of the URL. */
    onCopied?: () => void;
    /** Reported after a native share resolves ("shared" | "cancelled"). */
    onShared?: (method: "shared" | "cancelled") => void;
    testId?: string;
}

/** Best-effort clipboard write (secure-context only). */
async function copyText(value: string): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
}

/** Turn the QR PNG data URL into a File for the Web Share API. */
async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], fileName, { type: "image/png" });
}

/**
 * Centered, dismissible QR modal. Presentational + the native
 * clipboard/share/download behaviours; all copy comes from props.
 */
export default function QrCodeModal({
    url,
    title,
    note,
    onClose,
    labels,
    fileName = "adaptive-learner-qr.png",
    onCopied,
    onShared,
    testId = "qr-code-modal",
}: QrCodeModalProps) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [canShareFiles, setCanShareFiles] = useState(false);

    const text = {
        close: labels?.close ?? "Close",
        copy: labels?.copy ?? "Copy URL",
        copied: labels?.copied ?? "Copied",
        download: labels?.download ?? "Download",
        share: labels?.share ?? "Share",
        imageAlt: labels?.imageAlt ?? "QR code",
    };

    useEffect(() => {
        let cancelled = false;
        QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 256 })
            .then((generated) => {
                if (!cancelled) setDataUrl(generated);
            })
            .catch(() => {
                /* A QR we cannot render simply leaves the image area empty;
                   the copyable URL below still lets the user share. */
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    // Probe Web-Share-with-files once a QR PNG exists.
    useEffect(() => {
        let cancelled = false;
        if (!dataUrl || typeof navigator === "undefined") return;
        const nav = navigator as Navigator & {
            canShare?: (data: ShareData) => boolean;
        };
        if (!nav.canShare) return;
        void dataUrlToFile(dataUrl, fileName).then((file) => {
            if (!cancelled && nav.canShare?.({ files: [file] })) {
                setCanShareFiles(true);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [dataUrl, fileName]);

    const handleCopy = async () => {
        const ok = await copyText(url);
        if (ok) {
            setCopied(true);
            onCopied?.();
            window.setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleShare = async () => {
        const nav =
            typeof navigator !== "undefined"
                ? (navigator as Navigator & {
                      share?: (data: ShareData) => Promise<void>;
                      canShare?: (data: ShareData) => boolean;
                  })
                : undefined;
        if (!nav?.share) return;
        try {
            if (dataUrl && canShareFiles) {
                const file = await dataUrlToFile(dataUrl, fileName);
                await nav.share({ title, text: title, url, files: [file] });
            } else {
                await nav.share({ title, text: title, url });
            }
            onShared?.("shared");
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                onShared?.("cancelled");
            }
        }
    };

    const canShare =
        typeof navigator !== "undefined" &&
        typeof (navigator as Navigator & { share?: unknown }).share === "function";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${testId}-title`}
            data-testid={testId}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-sm rounded-lg border border-border bg-[var(--bg-elevated)] p-6 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={text.close}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded text-fg-secondary hover:bg-muted hover:text-fg-primary"
                    data-testid={`${testId}-close`}
                >
                    <X size={18} aria-hidden="true" />
                </button>

                <h2
                    id={`${testId}-title`}
                    className="mb-4 pr-8 text-lg font-semibold text-fg-primary"
                >
                    {title}
                </h2>

                <div className="flex flex-col items-center gap-4">
                    <div className="rounded-md bg-white p-3">
                        {dataUrl && (
                            <img
                                src={dataUrl}
                                alt={text.imageAlt}
                                width={224}
                                height={224}
                                className="block h-56 w-56"
                                data-testid={`${testId}-image`}
                            />
                        )}
                    </div>

                    <code
                        className="w-full break-all rounded bg-muted px-2 py-1 text-center text-xs text-fg-secondary"
                        data-testid={`${testId}-url`}
                    >
                        {url}
                    </code>

                    {note && (
                        <p
                            className="w-full text-center text-xs text-fg-muted"
                            data-testid={`${testId}-note`}
                        >
                            {note}
                        </p>
                    )}

                    {/* Screen-reader announcement for the copy action. */}
                    <span
                        role="status"
                        aria-live="polite"
                        className="sr-only"
                        data-testid={`${testId}-copied-status`}
                    >
                        {copied ? text.copied : ""}
                    </span>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
                            data-testid={`${testId}-copy`}
                        >
                            <Copy size={14} aria-hidden="true" />
                            {copied ? text.copied : text.copy}
                        </button>

                        {dataUrl && (
                            <a
                                href={dataUrl}
                                download={fileName}
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
                                data-testid={`${testId}-download`}
                            >
                                <Download size={14} aria-hidden="true" />
                                {text.download}
                            </a>
                        )}

                        {canShare && (
                            <button
                                type="button"
                                onClick={handleShare}
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90"
                                data-testid={`${testId}-share`}
                            >
                                <Share2 size={14} aria-hidden="true" />
                                {text.share}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

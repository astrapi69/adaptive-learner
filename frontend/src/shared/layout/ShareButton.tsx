/**
 * ShareButton — share a short text + URL via the native Web Share API,
 * falling back to copying to the clipboard when the API is absent
 * (typical on desktop browsers).
 *
 * App-agnostic and props-driven: the text, URL, and labels arrive as
 * props, and the outcome is reported through ``onShared(method)`` — the
 * seam an app uses to show a toast ("copied to clipboard") or record an
 * analytics event. No i18n/storage/toast imports. Token-backed Tailwind,
 * 44px touch target.
 *
 * Privacy: this component only transmits the ``text``/``url`` it is
 * given; it never reads user data. Callers must pass PII-free text.
 *
 * @example
 * <ShareButton
 *   text='I am on a 30-day streak! #AdaptiveLearner'
 *   url="https://astrapi69.github.io/adaptive-learner/"
 *   label="Share"
 *   onShared={(how) => how === "copied" && toast.success(t("share.achievement.copied"))}
 * />
 */

import {Share2} from "lucide-react";
import {useState} from "react";

/** How the share resolved, surfaced to the host via ``onShared``. */
export type ShareMethod = "shared" | "copied" | "cancelled" | "unavailable";

export interface ShareButtonProps {
    /** PII-free text to share. */
    text: string;
    /** URL appended to the share / copied to the clipboard. */
    url: string;
    /** Button label. */
    label: string;
    /** Outcome callback — the host shows a toast / records the event. */
    onShared?: (method: ShareMethod) => void;
    /** Visual variant: a bordered button (default) or a compact link. */
    variant?: "button" | "link";
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

/** Share/copy control (presentational + native-API behavior). */
export default function ShareButton({
    text,
    url,
    label,
    onShared,
    variant = "button",
    testId = "share-button",
}: ShareButtonProps) {
    const [busy, setBusy] = useState(false);

    const handleShare = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const nav =
                typeof navigator !== "undefined"
                    ? (navigator as Navigator & {
                          share?: (data: ShareData) => Promise<void>;
                      })
                    : undefined;
            if (nav?.share) {
                try {
                    await nav.share({text, url});
                    onShared?.("shared");
                    return;
                } catch (err) {
                    // User dismissed the native sheet — not an error.
                    if (err instanceof DOMException && err.name === "AbortError") {
                        onShared?.("cancelled");
                        return;
                    }
                    // Any other failure: fall through to the clipboard path.
                }
            }
            const ok = await copyText(`${text} ${url}`);
            onShared?.(ok ? "copied" : "unavailable");
        } finally {
            setBusy(false);
        }
    };

    const className =
        variant === "link"
            ? "inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            : "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted disabled:opacity-60";

    return (
        <button
            type="button"
            onClick={handleShare}
            disabled={busy}
            className={className}
            data-testid={testId}
        >
            <Share2 size={14} aria-hidden="true" />
            {label}
        </button>
    );
}

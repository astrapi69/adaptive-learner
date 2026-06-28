/**
 * ShareButton — share a short text + URL via the native Web Share API,
 * falling back on desktop (where `navigator.share` is absent) to a small
 * accessible popover with explicit social share-intent links + a copy
 * action.
 *
 * Library-First: `navigator.share()` is the primary path — on mobile it
 * opens the system share sheet (WhatsApp, Instagram, LinkedIn, Facebook, X,
 * …, everything installed), so no custom menu is shown there. Only when the
 * native API is missing does the desktop fallback render: Facebook /
 * LinkedIn / X / WhatsApp share-intent links (Instagram has no web intent
 * URL, so it is reachable ONLY via the native sheet, never as a desktop
 * link) plus "copy to clipboard". When no `menuLabels` are supplied the
 * fallback degrades to clipboard-only (backward compatible).
 *
 * App-agnostic and props-driven: the text, URL, and all labels arrive as
 * props (so this stays free of i18n/storage/toast imports), and the outcome
 * is reported through `onShared(method)`. The popover is a lightweight
 * custom implementation (not a Radix DropdownMenu) — deliberately, because
 * Radix's portal + focus-scope is brittle under happy-dom unit tests (see
 * .claude/rules/lessons-learned.md). Token-backed Tailwind, 44px targets.
 *
 * Privacy: this component only transmits the `text`/`url` it is given; it
 * never reads user data. Callers must pass PII-free text.
 *
 * @example
 * <ShareButton
 *   text='I am on a 30-day streak! #AdaptiveLearner'
 *   url="https://astrapi69.github.io/adaptive-learner/"
 *   label="Share"
 *   menuLabels={{facebook: "…", linkedin: "…", x: "…", whatsapp: "…", copy: "…"}}
 *   onShared={(how) => how === "copied" && toast.success(t("share.achievement.copied"))}
 * />
 */

import {Copy, ExternalLink, Share2} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import {buildShareIntentUrls} from "../../lib/share/share-intent-urls";

/** How the share resolved, surfaced to the host via `onShared`. */
export type ShareMethod = "shared" | "copied" | "cancelled" | "unavailable";

/**
 * Localized labels for the desktop fallback popover. Supplying this enables
 * the social-link menu; omitting it keeps the clipboard-only fallback.
 */
export interface ShareMenuLabels {
    facebook: string;
    linkedin: string;
    x: string;
    whatsapp: string;
    /** Label for the "copy to clipboard" item. */
    copy: string;
    /** Accessible name for the menu (defaults to the button `label`). */
    heading?: string;
}

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
    /** Optional async producer of files (e.g. a generated PNG card) to share
     *  alongside the text. When it resolves to files AND the platform can
     *  share them (`navigator.canShare`), they are attached; otherwise the
     *  share degrades to text-only. PII-free by contract, like `text`.
     *  Only used on the native-share path. */
    getFiles?: () => Promise<File[] | null>;
    /** Desktop-fallback popover labels. Present → the social-link menu is
     *  shown when `navigator.share` is missing; absent → clipboard-only. */
    menuLabels?: ShareMenuLabels;
    /** Render only the icon (the `label` becomes the accessible name) —
     *  for dense rows like the dashboard. */
    iconOnly?: boolean;
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

/** The native Web Share surface, when present. */
function getNativeShare():
    | ((data: ShareData) => Promise<void>)
    | undefined {
    if (typeof navigator === "undefined") return undefined;
    const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
    };
    return typeof nav.share === "function" ? nav.share.bind(nav) : undefined;
}

/** Share/copy control (presentational + native-API behavior). */
export default function ShareButton({
    text,
    url,
    label,
    onShared,
    variant = "button",
    getFiles,
    menuLabels,
    iconOnly = false,
    testId = "share-button",
}: ShareButtonProps) {
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const firstItemRef = useRef<HTMLAnchorElement>(null);

    const closeMenu = (returnFocus = true) => {
        setMenuOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    };

    // Escape + outside-click close the popover; first item gets focus on open.
    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeMenu();
        };
        const onPointer = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                !menuRef.current?.contains(target) &&
                !triggerRef.current?.contains(target)
            ) {
                closeMenu(false);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onPointer);
        firstItemRef.current?.focus();
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onPointer);
        };
    }, [menuOpen]);

    const shareNatively = async (
        share: (data: ShareData) => Promise<void>,
    ): Promise<void> => {
        if (busy) return;
        setBusy(true);
        try {
            const nav = navigator as Navigator & {
                canShare?: (data: ShareData) => boolean;
            };
            let files: File[] | null = null;
            if (getFiles) {
                try {
                    files = await getFiles();
                } catch {
                    files = null;
                }
            }
            const withFiles =
                files && files.length > 0 && nav.canShare?.({files})
                    ? {text, url, files}
                    : {text, url};
            try {
                await share(withFiles);
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
            const ok = await copyText(`${text} ${url}`);
            onShared?.(ok ? "copied" : "unavailable");
        } finally {
            setBusy(false);
        }
    };

    const handleTrigger = async () => {
        const share = getNativeShare();
        if (share) {
            await shareNatively(share);
            return;
        }
        // No native share: open the social-link menu when localized, else
        // keep the clipboard-only fallback.
        if (menuLabels) {
            setMenuOpen((open) => !open);
            return;
        }
        const ok = await copyText(`${text} ${url}`);
        onShared?.(ok ? "copied" : "unavailable");
    };

    const handleMenuCopy = async () => {
        const ok = await copyText(`${text} ${url}`);
        onShared?.(ok ? "copied" : "unavailable");
        closeMenu();
    };

    const handlePlatformClick = () => {
        // The anchor opens the share page in a new tab natively; we just
        // report the outcome and close the menu.
        onShared?.("shared");
        closeMenu(false);
    };

    // Roving focus among the menu items (honors the role="menu" contract).
    const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        const items = Array.from(
            menuRef.current?.querySelectorAll<HTMLElement>(
                '[role="menuitem"]',
            ) ?? [],
        );
        if (items.length === 0) return;
        e.preventDefault();
        const current = items.indexOf(document.activeElement as HTMLElement);
        let next = current;
        if (e.key === "ArrowDown") next = (current + 1) % items.length;
        else if (e.key === "ArrowUp")
            next = (current - 1 + items.length) % items.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = items.length - 1;
        items[next]?.focus();
    };

    const className = iconOnly
        ? "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-fg-secondary hover:bg-muted disabled:opacity-60"
        : variant === "link"
          ? "inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          : "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted disabled:opacity-60";

    const itemClass =
        "flex w-full min-h-[44px] items-center gap-2 rounded px-3 text-sm text-fg-secondary hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

    const intents = menuLabels ? buildShareIntentUrls(text, url) : [];

    return (
        <div className="relative inline-block">
            <button
                type="button"
                ref={triggerRef}
                onClick={handleTrigger}
                disabled={busy}
                className={className}
                data-testid={testId}
                aria-label={iconOnly ? label : undefined}
                title={iconOnly ? label : undefined}
                aria-haspopup={menuLabels ? "menu" : undefined}
                aria-expanded={menuLabels ? menuOpen : undefined}
            >
                <Share2 size={iconOnly ? 16 : 14} aria-hidden="true" />
                {!iconOnly && label}
            </button>

            {menuOpen && menuLabels && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={menuLabels.heading ?? label}
                    onKeyDown={handleMenuKeyDown}
                    className="absolute right-0 z-50 mt-1 min-w-[14rem] rounded-md border border-border bg-bg-elevated p-1 shadow-elevated"
                    data-testid={`${testId}-menu`}
                >
                    {intents.map((intent, index) => (
                        <a
                            key={intent.platform}
                            ref={index === 0 ? firstItemRef : undefined}
                            role="menuitem"
                            href={intent.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handlePlatformClick}
                            className={itemClass}
                            data-testid={`${testId}-${intent.platform}`}
                        >
                            <ExternalLink size={14} aria-hidden="true" />
                            {menuLabels[intent.platform]}
                        </a>
                    ))}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={handleMenuCopy}
                        className={itemClass}
                        data-testid={`${testId}-copy`}
                    >
                        <Copy size={14} aria-hidden="true" />
                        {menuLabels.copy}
                    </button>
                </div>
            )}
        </div>
    );
}

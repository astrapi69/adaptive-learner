/**
 * IosInstallHint — the iOS counterpart to {@link InstallPrompt}.
 *
 * iOS Safari fires no ``beforeinstallprompt``, so the install banner never
 * shows there. Instead we surface a short, dismissable instruction —
 * "Share → Add to Home Screen" — but ONLY on iOS Safari and ONLY before the app
 * is installed (FUNKTION-NICHT-VERFUEGBAR: never shown where it cannot apply).
 *
 * Dezent + bottom-anchored, dismissable once (persisted). Client-only and
 * storage-mode-agnostic — it reads nothing but the platform + a localStorage
 * flag.
 */

import { Share, X } from "lucide-react";
import { useState } from "react";

import { useI18n } from "../../hooks/ui/useI18n";
import { isStandalone } from "../../lib/pwa/install";
import { shouldShowIosInstallHint } from "../../lib/pwa/ios-install";

const STORAGE_KEY = "adaptive-learner.ios_install_dismissed";

function readDismissed(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function writeDismissed(): void {
    try {
        localStorage.setItem(STORAGE_KEY, "1");
    } catch {
        /* private mode: non-load-bearing flag, ignore */
    }
}

/** Resolve the initial visibility from the real platform + dismissal state. */
function computeInitialVisible(): boolean {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & { maxTouchPoints?: number };
    return shouldShowIosInstallHint({
        userAgent: nav.userAgent ?? "",
        platform: nav.platform ?? "",
        maxTouchPoints: nav.maxTouchPoints ?? 0,
        standalone: isStandalone(),
        dismissed: readDismissed(),
    });
}

export default function IosInstallHint() {
    const { t } = useI18n();
    const [visible, setVisible] = useState<boolean>(computeInitialVisible);

    if (!visible) return null;

    const dismiss = () => {
        writeDismissed();
        setVisible(false);
    };

    return (
        <div
            className="fixed inset-x-0 bottom-0 z-[9998] flex items-start gap-3 border-t border-border bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm shadow-[var(--shadow-elevated)]"
            role="region"
            aria-label={t("install.ios.aria_label", "Install on your iPhone")}
            data-testid="ios-install-hint"
        >
            <Share
                size={20}
                className="mt-0.5 shrink-0 text-accent"
                aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
                <strong className="block text-foreground">
                    {t("install.ios.title", "Install as an app")}
                </strong>
                <span className="text-muted-foreground">
                    {t(
                        "install.ios.steps",
                        "Tap the Share icon, then “Add to Home Screen” - it opens without the Safari bar.",
                    )}
                </span>
            </div>
            <button
                type="button"
                onClick={dismiss}
                aria-label={t("install.ios.dismiss", "Dismiss")}
                className="shrink-0 rounded-app p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                data-testid="ios-install-hint-dismiss"
            >
                <X size={18} aria-hidden="true" />
            </button>
        </div>
    );
}

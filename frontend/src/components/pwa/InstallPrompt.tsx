import {useEffect, useState} from "react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../hooks/ui/useI18n";

/**
 * v0.6.0 / 9B — "Add to Home Screen" prompt.
 *
 * Browsers expose a ``beforeinstallprompt`` event when the app
 * meets PWA install criteria (manifest + SW registered + user
 * engagement signal). We capture it, prevent the browser's
 * default mini-bar, and surface our own dismissable banner at
 * the bottom of the viewport.
 *
 * The banner is intentionally bottom-anchored on mobile so
 * the user's primary content area isn't shoved down on first
 * paint.
 *
 * S5 (PWA hardening): dismissal is now time-boxed to 7 days (a
 * "Later", not a permanent "no thanks") so a user who skips it once
 * still gets re-offered the install — but not naggingly. We also never
 * show it when the app is ALREADY installed (running in
 * display-mode: standalone, or iOS ``navigator.standalone``). A legacy
 * permanent dismissal (the old ``"1"`` flag) is still honoured.
 *
 * Renders ``null`` when:
 *   - the browser hasn't fired beforeinstallprompt yet
 *   - the user dismissed it within the last 7 days (or legacy permanent)
 *   - the app is already installed (standalone display mode)
 *   - the user accepted (the prompt resolves and we hide)
 *   - the platform doesn't support it (Safari iOS, older browsers)
 */
const STORAGE_KEY = "adaptive-learner.install_dismissed";
/** S5 — re-offer the install after this many ms (a "Later", not forever). */
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
}

/** True if the app is running as an installed PWA (standalone). */
function isStandalone(): boolean {
    try {
        if (
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(display-mode: standalone)").matches
        ) {
            return true;
        }
        // iOS Safari exposes a non-standard ``navigator.standalone``.
        return (
            (navigator as unknown as {standalone?: boolean}).standalone === true
        );
    } catch {
        return false;
    }
}

/** True if dismissed within the last 7 days, or legacy-permanently. */
function isDismissedRecently(): boolean {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        if (raw === "1") return true; // legacy permanent dismissal
        const ts = Number(raw);
        return Number.isFinite(ts) && Date.now() - ts < DISMISS_MS;
    } catch {
        return false;
    }
}

export default function InstallPrompt() {
    const {t} = useI18n();
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [dismissed, setDismissed] = useState<boolean>(
        // Hide if dismissed in the last 7 days OR already installed.
        () => isDismissedRecently() || isStandalone(),
    );

    useEffect(() => {
        const handler = (e: Event) => {
            // Stop the browser's own mini-bar; we render our
            // styled banner instead.
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener("beforeinstallprompt", handler);
        // Also listen for ``appinstalled`` so we hide if the
        // user installs through the browser's own UI.
        const onInstalled = () => setDeferredPrompt(null);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    if (!deferredPrompt || dismissed) return null;

    const handleInstall = async () => {
        try {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === "dismissed") {
                // User dismissed the native prompt — treat it as
                // a permanent "no thanks" so we don't keep nagging.
                writeDismissed();
                setDismissed(true);
            }
        } catch {
            // Safest default: hide on any error.
            writeDismissed();
            setDismissed(true);
        } finally {
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        writeDismissed();
        setDismissed(true);
        setDeferredPrompt(null);
    };

    return (
        <div
            className="install-prompt"
            data-testid="install-prompt"
            role="region"
            aria-label={t("install.aria_label", "Install Adaptive Learner")}
        >
            <div className="install-prompt-text">
                <strong>{t("install.title", "Add to home screen")}</strong>
                <span className="muted install-prompt-subtitle">
                    {t(
                        "install.subtitle",
                        "Open Adaptive Learner like a real app - no browser tab needed.",
                    )}
                </span>
            </div>
            <div className="install-prompt-actions">
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="install-prompt-dismiss"
                    onClick={handleDismiss}
                >
                    {t("install.dismiss", "Not now")}
                </Button>
                <Button
                    type="button"
                    variant="default"
                    data-testid="install-prompt-install"
                    onClick={handleInstall}
                >
                    {t("install.install", "Install")}
                </Button>
            </div>
        </div>
    );
}

function writeDismissed(): void {
    try {
        // S5 — store a timestamp so the dismissal expires after 7 days
        // (see DISMISS_MS) instead of being permanent.
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
        // Some private-browsing modes block localStorage; silently
        // accept the loss — the dismissed flag is non-load-bearing.
    }
}

import {useEffect, useState} from "react";

import {useI18n} from "../hooks/useI18n";

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
 * paint. Dismissal persists in localStorage so a "no thanks" is
 * permanent — re-prompting is a hostile pattern.
 *
 * Renders ``null`` when:
 *   - the browser hasn't fired beforeinstallprompt yet
 *   - the user already dismissed it
 *   - the user accepted (the prompt resolves and we hide)
 *   - the platform doesn't support it (Safari iOS, older browsers)
 */
const STORAGE_KEY = "adaptive-learner.install_dismissed";

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
}

export default function InstallPrompt() {
    const {t} = useI18n();
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [dismissed, setDismissed] = useState<boolean>(() => {
        // Initialise from localStorage so a returning user who
        // previously dismissed never sees the banner again.
        try {
            return localStorage.getItem(STORAGE_KEY) === "1";
        } catch {
            return false;
        }
    });

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
                        "Open Adaptive Learner like a real app — no browser tab needed.",
                    )}
                </span>
            </div>
            <div className="install-prompt-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="install-prompt-dismiss"
                    onClick={handleDismiss}
                >
                    {t("install.dismiss", "Not now")}
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    data-testid="install-prompt-install"
                    onClick={handleInstall}
                >
                    {t("install.install", "Install")}
                </button>
            </div>
        </div>
    );
}

function writeDismissed(): void {
    try {
        localStorage.setItem(STORAGE_KEY, "1");
    } catch {
        // Some private-browsing modes block localStorage; silently
        // accept the loss — the dismissed flag is non-load-bearing.
    }
}

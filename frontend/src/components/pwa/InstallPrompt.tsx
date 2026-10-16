import {useState} from "react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../hooks/ui/useI18n";
import {useInstallAvailable} from "../../hooks/system/useInstallAvailable";
import {isStandalone, promptInstall} from "../../lib/pwa/install";

/**
 * "Add to Home Screen" banner for browsers that fire
 * ``beforeinstallprompt`` (Chromium).
 *
 * A dismissable card in the page flow at the top of the dashboard,
 * next to its iOS counterpart (#3765). It used to sit ``fixed`` at the
 * bottom of every page and covered whatever ended up there, on a phone
 * the assessment's "next question" (#3782). The event is captured
 * app-wide by ``lib/pwa/install`` at module load, so the card still
 * shows when the browser fired it before the dashboard mounted.
 *
 * Dismissal is time-boxed to 7 days (a "Later", not a permanent "no
 * thanks"); a legacy permanent dismissal (the old ``"1"`` flag) is
 * still honoured. Renders ``null`` when the browser offers no install,
 * when dismissed within the last 7 days, when the app is already
 * installed (standalone) or after the user accepted.
 *
 * @example
 *   <InstallPrompt />
 */
const STORAGE_KEY = "adaptive-learner.install_dismissed";
/** Re-offer the install after this many ms (a "Later", not forever). */
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

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
    const available = useInstallAvailable();
    const [dismissed, setDismissed] = useState<boolean>(
        () => isDismissedRecently() || isStandalone(),
    );

    if (!available || dismissed) return null;

    const dismiss = () => {
        writeDismissed();
        setDismissed(true);
    };

    const handleInstall = async () => {
        try {
            // An accepted install clears the captured event, which hides
            // the card; a declined native prompt counts as "Later".
            if ((await promptInstall()) === "dismissed") dismiss();
        } catch {
            dismiss();
        }
    };

    return (
        <div
            className="mb-4 flex flex-col gap-3 rounded-app border border-border bg-card p-3 text-sm sm:flex-row sm:items-center"
            data-testid="install-prompt"
            role="region"
            aria-label={t("install.aria_label", "Install Adaptive Learner")}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <strong>{t("install.title", "Add to home screen")}</strong>
                <span className="text-muted-foreground">
                    {t(
                        "install.subtitle",
                        "Open Adaptive Learner like a real app - no browser tab needed.",
                    )}
                </span>
            </div>
            <div className="flex shrink-0 gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="install-prompt-dismiss"
                    onClick={dismiss}
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

/**
 * Settings > General "Install app" entry (#604; moved from the Data tab
 * in #1455 - installing configures HOW the app runs, not WHAT it stores).
 *
 * A manual install button (visible-but-disabled per the feature-state
 * policy): enabled only when the browser has offered installation and
 * the app isn't already installed. Independent of the timed
 * ``InstallPrompt`` banner — this is the "I want to install it now"
 * affordance. The offline-content cache in the Data tab is a different
 * thing: it stores learning content; installing makes the PWA a
 * standalone application.
 */

import {Download} from "lucide-react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../hooks/ui/useI18n";
import {useInstallAvailable} from "../../../hooks/system/useInstallAvailable";
import {isStandalone, promptInstall} from "../../../lib/pwa/install";
import {notify} from "../../../utils/notify";

export default function InstallAppSection() {
    const {t} = useI18n();
    const available = useInstallAvailable();
    const installed = isStandalone();

    const handleInstall = async () => {
        const outcome = await promptInstall();
        if (outcome === "accepted") {
            notify.success(t("settings.install.installed", "App installed."));
        }
    };

    const reason = installed
        ? t("settings.install.already", "Already installed")
        : t(
              "settings.install.unavailable",
              "Your browser hasn't offered installation yet.",
          );

    return (
        <div
            className="settings-subsection mt-6"
            data-testid="settings-install-section"
        >
            <h3 className="mb-1 mt-0 text-base font-semibold">
                {t("settings.install.heading", "Install app")}
            </h3>
            <p className="mb-3 mt-0 text-sm text-fg-muted">
                {t(
                    "settings.install.description",
                    "Install Adaptive Learner as its own application: a standalone window, an icon on your home screen, and it starts even without a network. Your learning content is not affected.",
                )}
            </p>
            <Button
                type="button"
                onClick={handleInstall}
                disabled={!available}
                data-testid="settings-install-button"
                title={available ? undefined : reason}
                className="gap-1.5"
            >
                <Download size={16} />
                {installed
                    ? t("settings.install.already", "Already installed")
                    : t("settings.install.button", "Install app")}
            </Button>
        </div>
    );
}

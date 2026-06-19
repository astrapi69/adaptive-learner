/**
 * Settings > Data "Install app" entry (#604).
 *
 * A manual install button (visible-but-disabled per the feature-state
 * policy): enabled only when the browser has offered installation and
 * the app isn't already installed. Independent of the timed
 * ``InstallPrompt`` banner — this is the "I want to install it now"
 * affordance.
 */

import {Download} from "lucide-react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../hooks/ui/useI18n";
import {useInstallAvailable} from "../hooks/system/useInstallAvailable";
import {isStandalone, promptInstall} from "../lib/pwa/install";
import {notify} from "../utils/notify";

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
            className="settings-subsection"
            data-testid="settings-install-section"
            style={{marginTop: "1.5rem"}}
        >
            <h3 style={{margin: "0 0 0.25rem", fontSize: "1rem"}}>
                {t("settings.install.heading", "Install app")}
            </h3>
            <p
                style={{
                    margin: "0 0 0.75rem",
                    fontSize: "0.875rem",
                    color: "var(--fg-muted)",
                }}
            >
                {t(
                    "settings.install.description",
                    "Install Adaptive Learner as an app for offline access and a full-screen experience.",
                )}
            </p>
            <Button
                type="button"
                onClick={handleInstall}
                disabled={!available}
                data-testid="settings-install-button"
                title={available ? undefined : reason}
                style={{gap: 6}}
            >
                <Download size={16} />
                {installed
                    ? t("settings.install.already", "Already installed")
                    : t("settings.install.button", "Install app")}
            </Button>
        </div>
    );
}

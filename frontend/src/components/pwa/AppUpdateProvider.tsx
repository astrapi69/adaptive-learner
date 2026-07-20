/**
 * AppUpdateProvider — app glue between the i18n catalogs, the shadcn button,
 * and ``@astrapi69/pwa-update-react`` (#1873).
 *
 * The messages are mapped from the app's EXISTING i18n keys rather than the
 * package's own ``pwa.update.*`` key set (via ``messagesFromTranslate``), so
 * the translations already shipped in all 11 catalogs keep working — no key
 * migration, no re-translation.
 */

import { useMemo, type ReactNode } from "react";

import { PwaUpdateProvider, type UpdateMessages } from "@astrapi69/pwa-update-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../hooks/ui/useI18n";
import { appUpdateStore } from "../../lib/pwa/update-store";

/** Map the app's i18n keys onto the kit's message object. */
function buildMessages(t: (key: string, fallback?: string) => string): UpdateMessages {
    return {
        bannerMessage: t("pwa.update.message", "A new version is available."),
        apply: t("pwa.update.action", "Update"),
        later: t("pwa.update.later", "Later"),
        fullRestartHint: t(
            "pwa.update.ios_restart_hint",
            "If nothing changes, close the app and reopen it.",
        ),
        checkForUpdates: t("about.check_update", "Check for updates"),
        checking: t("about.checking", "Checking…"),
        updateAvailable: t("about.update_available", "Version {version} is available!"),
        updatePreparing: t(
            "about.update_preparing",
            "A new build is available and is being prepared. Check again in a moment.",
        ),
        upToDate: t("about.up_to_date", "You're using the latest version."),
        checkFailed: t("about.check_failed", "Check failed. Are you online?"),
        lastChecked: t("about.last_checked", "Last checked: {when}"),
        neverChecked: t("about.never_checked", "Never checked"),
        versionHeading: t("about.version_heading", "Version"),
        versionLabel: t("about.app_label", "Adaptive Learner"),
        buildLabel: t("about.build_hash_label", "Build"),
        buildDateLabel: t("about.build_date_label", "Build date"),
    };
}

export default function AppUpdateProvider({ children }: { children: ReactNode }) {
    const { t, lang } = useI18n();
    // Memoised on the language, NOT rebuilt per render: this provider sits
    // above the whole route tree, and a fresh messages object on every render
    // would change the context identity each time and re-render every
    // descendant.
    const messages = useMemo(
        () => buildMessages(t),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ``t`` is a
        // fresh closure per render; the catalog it reads is keyed by ``lang``.
        [lang],
    );
    return (
        <PwaUpdateProvider
            store={appUpdateStore}
            messages={messages}
            Button={Button}
            locale={lang}
        >
            {children}
        </PwaUpdateProvider>
    );
}

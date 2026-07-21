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
    // Memoised on ``t``, NOT on ``lang`` (#1894): the i18n catalogs load as
    // lazy per-language chunks, so on first paint ``t`` returns the English
    // caller-fallbacks and only later resolves the real strings. That async
    // load changes ``t``'s identity WITHOUT changing ``lang``, so a
    // ``[lang]``-keyed memo would freeze the messages on the first-paint
    // English fallbacks for the whole session (the About-view bug: the update
    // control stayed English while its ``locale``-formatted timestamp was
    // German). ``t`` is a stable ``useCallback`` keyed on ``[strings, lang]``,
    // so it only changes when the catalog OR the language changes — exactly
    // when the messages must be rebuilt — and is otherwise referentially
    // stable, so this does not churn the context identity per render.
    const messages = useMemo(() => buildMessages(t), [t]);
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

/**
 * Proactive "Create error report" entry (EXP-028, EVT-04).
 *
 * Opens the {@link ErrorReportDialog} without a preceding error
 * toast, so a user whose app merely "feels off" (no exception) can
 * still send the developer their recent action history. Dispatches
 * the same ``adaptive-learner:open-error-report`` window event the
 * reactive error-toast path uses; the dialog is mounted once at the
 * App root.
 */

import {LifeBuoy} from "lucide-react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../hooks/useI18n";

export default function SupportSection() {
    const {t} = useI18n();

    const openReport = () => {
        window.dispatchEvent(
            new CustomEvent("adaptive-learner:open-error-report", {
                detail: {
                    message: t(
                        "settings.support.report_default_message",
                        "User-initiated report",
                    ),
                    proactive: true,
                },
            }),
        );
    };

    return (
        <div
            className="settings-subsection"
            data-testid="settings-support-section"
            style={{marginTop: "1.5rem"}}
        >
            <h3 style={{margin: "0 0 0.25rem", fontSize: "1rem"}}>
                {t("settings.support.heading", "Support")}
            </h3>
            <p
                style={{
                    margin: "0 0 0.75rem",
                    fontSize: "0.875rem",
                    color: "var(--fg-muted)",
                }}
            >
                {t(
                    "settings.support.description",
                    "Something not working as expected? Create a report of your recent actions to help the developer reproduce it. You review everything before it leaves your browser.",
                )}
            </p>
            <Button
                type="button"
                variant="outline"
                onClick={openReport}
                data-testid="settings-create-error-report"
                style={{gap: 6}}
            >
                <LifeBuoy size={16} />
                {t("settings.support.create_report", "Create error report")}
            </Button>
        </div>
    );
}

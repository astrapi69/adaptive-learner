import {useNavigate} from "react-router";

import MethodBadge from "../session/MethodBadge";
import {useI18n} from "../../hooks/ui/useI18n";
import type {LearningMethod} from "../../lib/constants";

interface QuickStartButtonProps {
    /**
     * Suggested method to highlight on the button. Pulled from
     * the latest LearningProfile's ``dominant_method``. May be
     * null when the profile hasn't loaded yet — the button still
     * renders but without the method dot + label.
     */
    suggestedMethod: LearningMethod | null;
    disabled?: boolean;
}

/**
 * Primary CTA on the Dashboard: starts a new learning session.
 * The session backend defaults to the profile's dominant method
 * when ``method`` is omitted from the start body, so the actual
 * dispatching of the method happens server-side; this button
 * just hints which method is queued so the user isn't surprised
 * by what the session page opens with.
 */
export default function QuickStartButton({
    suggestedMethod,
    disabled = false,
}: QuickStartButtonProps) {
    const {t} = useI18n();
    const navigate = useNavigate();
    return (
        <button
            type="button"
            data-testid="quick-start"
            className="quick-start-btn"
            disabled={disabled}
            onClick={() => navigate("/session")}
        >
            <span className="quick-start-title">
                {t("dashboard.quick_start", "Start a new session")}
            </span>
            <span className="quick-start-subtitle">
                {t("dashboard.quick_start_subtitle")}
            </span>
            {suggestedMethod && (
                <MethodBadge method={suggestedMethod} testId="quick-start-method" />
            )}
        </button>
    );
}

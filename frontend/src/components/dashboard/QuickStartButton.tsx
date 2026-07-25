import {useNavigate} from "react-router";

import {useI18n} from "../../hooks/ui/useI18n";
import {METHOD_COLORS, type LearningMethod} from "../../lib/constants";
import {bestTextOn} from "../../styles/contrast";

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
                <span
                    className="method-badge"
                    data-testid="quick-start-method"
                    style={{
                        background: METHOD_COLORS[suggestedMethod],
                        color: bestTextOn(METHOD_COLORS[suggestedMethod]),
                    }}
                >
                    <span
                        className="method-dot"
                        style={{
                            background:
                                bestTextOn(METHOD_COLORS[suggestedMethod]) === "#000000"
                                    ? "rgba(0,0,0,0.85)"
                                    : "rgba(255,255,255,0.85)",
                        }}
                        aria-hidden="true"
                    />
                    {t(`methods.${suggestedMethod}.label`, suggestedMethod)}
                </span>
            )}
        </button>
    );
}

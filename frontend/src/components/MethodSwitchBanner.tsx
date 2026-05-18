import {useI18n} from "../hooks/useI18n";
import {METHOD_COLORS, type LearningMethod} from "../lib/constants";

interface MethodSwitchBannerProps {
    /** Method the recommender suggests switching to. */
    suggested: LearningMethod;
    /** Optional rationale string from the backend recommender. */
    reason?: string;
    onAccept: () => void;
    onDismiss: () => void;
}

/**
 * Banner that surfaces a "consider switching method" suggestion
 * from the ``recommend_method_switch`` hook. The parent decides
 * whether to render it (state-driven); accept/dismiss are
 * declarative callbacks, no own state.
 *
 * Component is wired but currently has no backend dispatch path
 * to populate it — the v0.1.0 backend doesn't expose an endpoint
 * to query the hook output. Phase 5 wires a route; flipping the
 * banner on then needs no UI changes.
 */
export default function MethodSwitchBanner({
    suggested,
    reason,
    onAccept,
    onDismiss,
}: MethodSwitchBannerProps) {
    const {t} = useI18n();
    return (
        <aside
            className="method-switch-banner"
            data-testid="method-switch-banner"
            role="status"
        >
            <header className="method-switch-banner-head">
                <strong>{t("session.switch_recommended", "Method switch recommended")}</strong>
                <span
                    className="method-badge"
                    style={{background: METHOD_COLORS[suggested], color: "#ffffff"}}
                    data-testid="method-switch-suggested"
                >
                    {t(`methods.${suggested}.label`, suggested)}
                </span>
            </header>
            <p className="method-switch-banner-body">
                {reason ?? t("session.switch_recommended_subtitle")}
            </p>
            <div className="method-switch-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="method-switch-dismiss"
                    onClick={onDismiss}
                >
                    {t("session.switch_dismiss", "Keep current method")}
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    data-testid="method-switch-accept"
                    onClick={onAccept}
                >
                    {t("session.switch_accept", "Switch method")}
                </button>
            </div>
        </aside>
    );
}

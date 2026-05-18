import {useI18n} from "../hooks/useI18n";
import {METHOD_COLORS, type LearningMethod} from "../lib/constants";

interface MethodBadgeProps {
    method: LearningMethod;
    /** ``compact`` drops the label and renders only the colour dot
     *  + method key (for tight surfaces like a session header). */
    compact?: boolean;
}

/**
 * Small pill rendering a method's localized label, prefixed with
 * a colour dot whose hex is the method's entry in METHOD_COLORS.
 */
export default function MethodBadge({method, compact = false}: MethodBadgeProps) {
    const {t} = useI18n();
    const label = t(`methods.${method}.label`, method);
    return (
        <span
            className="method-badge"
            data-testid={`method-badge-${method}`}
            style={
                compact
                    ? {}
                    : {background: METHOD_COLORS[method], color: "#ffffff"}
            }
        >
            <span
                className="method-dot"
                aria-hidden="true"
                style={{background: compact ? METHOD_COLORS[method] : "rgba(255,255,255,0.85)"}}
            />
            {label}
        </span>
    );
}

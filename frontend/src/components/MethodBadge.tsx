import {useI18n} from "../hooks/ui/useI18n";
import {METHOD_COLORS, type LearningMethod} from "../lib/constants";
import {bestTextOn} from "../styles/contrast";

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
    const bg = METHOD_COLORS[method];
    // WCAG 2.1 SC 1.4.3: pick black-or-white text per method so
    // the colored pill passes AA without changing the brand
    // palette. Every entry in METHOD_COLORS picks "#000000" on
    // its current pin; the helper keeps the contract honest if
    // a future tweak shifts a color.
    const textColor = bestTextOn(bg);
    const dotInsetColor = textColor === "#000000" ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)";
    return (
        <span
            className="method-badge"
            data-testid={`method-badge-${method}`}
            style={compact ? {} : {background: bg, color: textColor}}
        >
            <span
                className="method-dot"
                aria-hidden="true"
                style={{background: compact ? bg : dotInsetColor}}
            />
            {label}
        </span>
    );
}

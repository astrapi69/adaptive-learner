import {useI18n} from "../../hooks/ui/useI18n";
import {METHOD_COLORS, type LearningMethod} from "../../lib/constants";
import {bestTextOn} from "../../styles/contrast";

interface MethodBadgeProps {
    method: LearningMethod;
    /** ``compact`` drops the label and renders only the colour dot
     *  + method key (for tight surfaces like a session header). */
    compact?: boolean;
    /** Render the leading colour dot. Default true; set false for a
     *  plain colour-filled pill with no dot. */
    dot?: boolean;
    /** Overrides the default ``method-badge-${method}`` testid. */
    testId?: string;
}

/**
 * Small pill rendering a method's localized label, prefixed with
 * a colour dot whose hex is the method's entry in METHOD_COLORS.
 */
export default function MethodBadge({
    method,
    compact = false,
    dot = true,
    testId,
}: MethodBadgeProps) {
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
            className="inline-flex items-center gap-2 rounded-full bg-bg-elevated px-3 py-1 text-[0.85rem] font-medium text-fg-primary"
            data-testid={testId ?? `method-badge-${method}`}
            style={compact ? {} : {background: bg, color: textColor}}
        >
            {dot && (
                <span
                    className="inline-block h-[0.55rem] w-[0.55rem] rounded-full bg-accent"
                    aria-hidden="true"
                    style={{background: compact ? bg : dotInsetColor}}
                />
            )}
            {label}
        </span>
    );
}

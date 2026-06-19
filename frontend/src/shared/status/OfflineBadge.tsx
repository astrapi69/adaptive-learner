/**
 * OfflineBadge — a generic online/offline status indicator.
 *
 * App-agnostic and props-driven: pass the boolean ``online`` state and
 * the two labels; it renders a status dot + label with a polite live
 * region so assistive tech announces connectivity changes. Headless on
 * styling — the caller supplies class names (so existing themed CSS or
 * token-backed Tailwind both work). Reusable for nav bars, headers, any
 * connectivity surface.
 *
 * @example
 * <OfflineBadge
 *   online={online}
 *   onlineLabel="Online"
 *   offlineLabel="Offline"
 *   className="nav-online-indicator"
 *   dotClassName="nav-online-dot"
 *   labelClassName="nav-online-label"
 * />
 */

export interface OfflineBadgeProps {
    online: boolean;
    onlineLabel: string;
    offlineLabel: string;
    /** Tooltip text; defaults to the active label. */
    title?: string;
    className?: string;
    dotClassName?: string;
    labelClassName?: string;
    testId?: string;
}

export default function OfflineBadge({
    online,
    onlineLabel,
    offlineLabel,
    title,
    className,
    dotClassName,
    labelClassName,
    testId = "offline-badge",
}: OfflineBadgeProps) {
    const label = online ? onlineLabel : offlineLabel;
    return (
        <span
            className={className}
            data-testid={testId}
            data-online={online ? "true" : "false"}
            role="status"
            aria-live="polite"
            title={title ?? label}
        >
            <span className={dotClassName} aria-hidden="true" />
            <span className={labelClassName}>{label}</span>
        </span>
    );
}

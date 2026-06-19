/**
 * SyncStatusBadge — a small count badge for pending (un-synced)
 * changes.
 *
 * App-agnostic and props-driven: renders the ``pendingCount`` as a
 * compact badge when it is positive, and **nothing** when it is zero
 * (so a fully-synced device shows no clutter). The caller decides
 * whether to render it at all — e.g. only in a mode where sync exists
 * (SYNC-UI-GATE). Headless styling via ``className``.
 *
 * @example
 * <SyncStatusBadge pendingCount={3} ariaLabel="3 changes pending sync" />
 */

export interface SyncStatusBadgeProps {
    pendingCount: number;
    /** Cap the rendered number (e.g. show "9+"). Default 99. */
    max?: number;
    ariaLabel?: string;
    className?: string;
    testId?: string;
}

export default function SyncStatusBadge({
    pendingCount,
    max = 99,
    ariaLabel,
    className,
    testId = "sync-status-badge",
}: SyncStatusBadgeProps) {
    if (pendingCount <= 0) return null;
    const shown = pendingCount > max ? `${max}+` : String(pendingCount);
    return (
        <span
            className={className}
            data-testid={testId}
            data-pending={pendingCount}
            role="status"
            aria-label={ariaLabel ?? shown}
        >
            {shown}
        </span>
    );
}

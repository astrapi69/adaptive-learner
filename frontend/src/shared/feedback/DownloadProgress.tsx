/**
 * DownloadProgress — a generic labelled progress bar for "current of
 * total" download / cache progress.
 *
 * App-agnostic and props-driven: pass ``current`` / ``total`` and an
 * optional label; it renders an accessible progress bar (token-backed
 * colors) with a "current / total" readout. ``total <= 0`` renders an
 * empty (0%) bar. Reusable for set downloads, cache warming, batch
 * imports, any "N of M" progress.
 *
 * @example
 * <DownloadProgress current={3} total={5} label="Sets available offline" />
 */

export interface DownloadProgressProps {
    current: number;
    total: number;
    label?: string;
    /** Accessible name for the bar; defaults to the label. */
    ariaLabel?: string;
    className?: string;
    testId?: string;
}

export default function DownloadProgress({
    current,
    total,
    label,
    ariaLabel,
    className,
    testId = "download-progress",
}: DownloadProgressProps) {
    const safeTotal = total > 0 ? total : 0;
    const clamped = safeTotal > 0 ? Math.min(Math.max(current, 0), safeTotal) : 0;
    const pct = safeTotal > 0 ? Math.round((clamped / safeTotal) * 100) : 0;

    return (
        <div className={className} data-testid={testId}>
            {label != null && (
                <div className="mb-1 flex justify-between gap-2 text-[0.8125rem] text-[var(--fg-muted)]">
                    <span>{label}</span>
                    <span data-testid={`${testId}-count`}>
                        {clamped} / {safeTotal}
                    </span>
                </div>
            )}
            <div
                role="progressbar"
                aria-label={ariaLabel ?? label}
                aria-valuenow={clamped}
                aria-valuemin={0}
                aria-valuemax={safeTotal}
                className="h-1.5 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]"
            >
                <div
                    data-testid={`${testId}-fill`}
                    className="h-full bg-[var(--accent)] [transition:width_300ms_ease]"
                    style={{width: `${pct}%`}}
                />
            </div>
        </div>
    );
}

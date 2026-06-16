/**
 * DueReviewCard — a "you have N things to review" card with an overdue
 * sub-count and a single start action.
 *
 * App-agnostic and props-driven: all numbers, labels, and the start
 * callback are supplied by the caller; no i18n/storage/router imports.
 * Renders nothing when ``total`` is 0 (callers can rely on that to hide
 * an empty widget). Token-backed Tailwind, 44px start button.
 *
 * @example
 * <DueReviewCard
 *   total={12}
 *   overdue={5}
 *   totalLabel="elements due"
 *   overdueLabel="overdue"
 *   startLabel="Start review"
 *   onStart={() => navigate("/review/es-a1")}
 *   secondaryLabel="Quick review"
 *   onSecondary={() => navigate("/review/es-a1?quick=1")}
 * />
 */

export interface DueReviewCardProps {
    /** Total items due for review. The card renders null when 0. */
    total: number;
    /** Subset of ``total`` that is overdue. */
    overdue: number;
    /** Unit phrase after ``total``, e.g. "elements due for review". */
    totalLabel: string;
    /** Phrase after the overdue count, e.g. "overdue". */
    overdueLabel: string;
    /** Label on the start button. */
    startLabel: string;
    onStart: () => void;
    /** Optional leading icon node (caller-supplied, aria-hidden). */
    icon?: React.ReactNode;
    /** Optional secondary action label, e.g. "Quick review". Rendered as a
     *  bordered button beside the primary one only when paired with
     *  ``onSecondary``. */
    secondaryLabel?: string;
    onSecondary?: () => void;
    /** Optional leading icon for the secondary action (aria-hidden). */
    secondaryIcon?: React.ReactNode;
    testId?: string;
}

/** "N due for review" card with an overdue sub-count + start action. */
export default function DueReviewCard({
    total,
    overdue,
    totalLabel,
    overdueLabel,
    startLabel,
    onStart,
    icon,
    secondaryLabel,
    onSecondary,
    secondaryIcon,
    testId,
}: DueReviewCardProps) {
    if (total <= 0) return null;
    return (
        <div data-testid={testId}>
            <p className="text-base">
                <strong data-testid={testId ? `${testId}-total` : undefined}>
                    {total}
                </strong>{" "}
                {totalLabel}
            </p>
            {overdue > 0 && (
                <p
                    className="mt-0.5 text-sm text-warning"
                    data-testid={testId ? `${testId}-overdue` : undefined}
                >
                    <strong>{overdue}</strong> {overdueLabel}
                </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onStart}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-accent px-4 font-medium text-accent-fg hover:bg-accent-hover"
                    data-testid={testId ? `${testId}-start` : undefined}
                >
                    {icon}
                    {startLabel}
                </button>
                {secondaryLabel && onSecondary && (
                    <button
                        type="button"
                        onClick={onSecondary}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-4 font-medium text-fg-secondary hover:bg-muted"
                        data-testid={testId ? `${testId}-secondary` : undefined}
                    >
                        {secondaryIcon}
                        {secondaryLabel}
                    </button>
                )}
            </div>
        </div>
    );
}

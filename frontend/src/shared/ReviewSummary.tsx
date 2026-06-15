/**
 * ReviewSummary — the end screen of a review session: how many missed
 * items were corrected, an optional improvement-trend line, and an
 * optional "review again in N days" suggestion + an exit action.
 *
 * App-agnostic and props-driven: all numbers, labels, and the exit
 * callback are caller-supplied; no i18n/storage/router imports. Reusable
 * for any "you reviewed N things" recap. Token-backed Tailwind, 44px
 * exit button.
 *
 * @example
 * <ReviewSummary
 *   heading="Review complete"
 *   corrected={5}
 *   total={8}
 *   correctedLabel="{corrected} of {total} corrected"
 *   trendLabel="Your frequent mistakes are getting rarer."
 *   nextReviewLabel="Review again in about 2 days."
 *   exitLabel="Back to dashboard"
 *   onExit={() => navigate("/dashboard")}
 * />
 */

import type {ReactNode} from "react";

export interface ReviewSummaryProps {
    heading: string;
    corrected: number;
    total: number;
    /** Pre-formatted "{corrected} of {total} corrected" string. */
    correctedLabel: string;
    /** Optional improvement-trend line. */
    trendLabel?: string;
    /** Optional next-review suggestion line. */
    nextReviewLabel?: string;
    exitLabel: string;
    onExit: () => void;
    /** Optional extra content (e.g. an SRS note). */
    children?: ReactNode;
    testId?: string;
}

/** Review-session recap (presentational, token-backed). */
export default function ReviewSummary({
    heading,
    corrected,
    total,
    correctedLabel,
    trendLabel,
    nextReviewLabel,
    exitLabel,
    onExit,
    children,
    testId,
}: ReviewSummaryProps) {
    const pct = total > 0 ? Math.round((corrected / total) * 100) : 0;
    return (
        <section
            className="lesson-summary"
            data-testid={testId}
            aria-label={heading}
        >
            <h2>{heading}</h2>
            <p
                className="text-lg font-semibold text-fg-primary"
                data-testid={testId ? `${testId}-corrected` : undefined}
            >
                {correctedLabel} ({pct}%)
            </p>
            {trendLabel && (
                <p
                    className="mt-1 text-sm text-success"
                    data-testid={testId ? `${testId}-trend` : undefined}
                >
                    {trendLabel}
                </p>
            )}
            {nextReviewLabel && (
                <p
                    className="mt-1 text-sm text-fg-muted"
                    data-testid={testId ? `${testId}-next` : undefined}
                >
                    {nextReviewLabel}
                </p>
            )}
            {children}
            <div className="lesson-summary-actions mt-3">
                <button
                    type="button"
                    onClick={onExit}
                    className="inline-flex min-h-[44px] items-center rounded-md bg-accent px-4 font-medium text-accent-fg hover:bg-accent-hover"
                    data-testid={testId ? `${testId}-exit` : undefined}
                >
                    {exitLabel}
                </button>
            </div>
        </section>
    );
}

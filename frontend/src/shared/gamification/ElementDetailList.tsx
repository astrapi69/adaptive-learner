/**
 * ElementDetailList — a per-element review-detail list: each row shows
 * the element, a status pill, a meta line (streak / errors / next
 * review), and optionally the learner's last wrong answer vs the
 * correct one.
 *
 * App-agnostic and props-driven: the caller maps its domain rows to
 * display-ready {@link ElementDetailItem}s (status label + tone + meta
 * are all pre-formatted); no i18n/storage imports. Reuses the shared
 * {@link SrsStatusBadge}. Token-backed Tailwind.
 *
 * @example
 * <ElementDetailList
 *   items={[{id: "el", element: "el libro", tone: "warning",
 *            statusLabel: "Due now", metaLabel: "Streak 0 · 3 errors",
 *            lastAnswer: "la libro", correctAnswer: "el libro"}]}
 *   lastAnswerLabel="Your answer:"
 *   correctLabel="Correct:"
 *   emptyLabel="No tracked elements yet."
 * />
 */

import SrsStatusBadge, {type SrsBadgeTone} from "./SrsStatusBadge";

export interface ElementDetailItem {
    id: string;
    element: string;
    tone: SrsBadgeTone;
    /** Short status pill text, e.g. "Mastered" / "Due now". */
    statusLabel: string;
    /** Meta line, e.g. "Streak 2 · 3 errors · review in 3 days". */
    metaLabel: string;
    /** Learner's last wrong answer (omit to hide the answer line). */
    lastAnswer?: string;
    correctAnswer?: string;
    /** #603 — the learning trajectory, e.g. "Attempt 5: correct" (omit
     *  to hide). */
    trajectoryLabel?: string;
}

export interface ElementDetailListProps {
    items: readonly ElementDetailItem[];
    /** Prefix before the last wrong answer. */
    lastAnswerLabel: string;
    /** Prefix before the correct answer. */
    correctLabel: string;
    emptyLabel: string;
    testId?: string;
}

/** Per-element SRS detail rows (presentational, token-backed). */
export default function ElementDetailList({
    items,
    lastAnswerLabel,
    correctLabel,
    emptyLabel,
    testId,
}: ElementDetailListProps) {
    if (items.length === 0) {
        return (
            <p className="text-sm text-fg-muted" data-testid={testId}>
                {emptyLabel}
            </p>
        );
    }
    return (
        <ul className="flex flex-col gap-2" data-testid={testId}>
            {items.map((item) => (
                <li
                    key={item.id}
                    className="rounded-md border border-border-subtle bg-bg-surface p-2"
                    data-testid={`element-detail-${item.id}`}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate font-medium text-fg-primary">
                            {item.element}
                        </span>
                        <SrsStatusBadge
                            label={item.statusLabel}
                            tone={item.tone}
                        />
                    </div>
                    <p className="mt-0.5 text-xs text-fg-muted">
                        {item.metaLabel}
                    </p>
                    {item.trajectoryLabel && (
                        <p
                            className="mt-0.5 text-xs text-fg-muted"
                            data-testid={`element-detail-trajectory-${item.id}`}
                        >
                            {item.trajectoryLabel}
                        </p>
                    )}
                    {item.lastAnswer && (
                        <p className="mt-0.5 truncate text-xs text-fg-muted">
                            {lastAnswerLabel}{" "}
                            <span className="text-error">
                                {item.lastAnswer}
                            </span>
                            {item.correctAnswer && (
                                <>
                                    {"  "}
                                    {correctLabel}{" "}
                                    <span className="text-success">
                                        {item.correctAnswer}
                                    </span>
                                </>
                            )}
                        </p>
                    )}
                </li>
            ))}
        </ul>
    );
}

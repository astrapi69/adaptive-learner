/**
 * WeakAreasList — a ranked list of the learner's weakest elements: the
 * element label, how many times it was missed, the most recent wrong
 * answer, and a "Practice" action per row.
 *
 * App-agnostic and props-driven: every label and the practice callback
 * are supplied by the caller; no i18n, storage, or routing imports. The
 * practice control is a token-backed, 44px-min button. Reusable for any
 * "things to work on" surface — a statistics page, a dashboard widget,
 * a review prompt.
 *
 * @example
 * <WeakAreasList
 *   items={[{id: "el-1", element: "el libro", errors: 4, last: "la libro", onPractice: () => nav("/review/es-a1")}]}
 *   practiceLabel="Practice"
 *   errorsLabel="errors"
 *   lastAnswerLabel="Your last answer:"
 *   emptyLabel="No mistakes tracked yet."
 *   testId="weak-areas"
 * />
 */

/** One row in the weak-areas list. */
export interface WeakAreaListItem {
    /** Stable key for the row. */
    id: string;
    /** The element label shown to the learner (e.g. ``"el libro"``). */
    element: string;
    /** How many times the element was answered wrong. */
    errors: number;
    /** The learner's most recent wrong answer (may be empty). */
    last: string;
    /** Invoked when the row's Practice button is pressed. Omit to hide
     *  the button (e.g. when no practice target exists). */
    onPractice?: () => void;
}

export interface WeakAreasListProps {
    items: readonly WeakAreaListItem[];
    /** Label on the per-row practice button. */
    practiceLabel: string;
    /** Unit word after the error count, e.g. "errors". */
    errorsLabel: string;
    /** Prefix before the last wrong answer, e.g. "Your last answer:". */
    lastAnswerLabel: string;
    /** Shown when there are no items. */
    emptyLabel: string;
    /** ``data-testid`` for the list root. */
    testId?: string;
}

/** Ranked weak-elements list with a per-row practice action. */
export default function WeakAreasList({
    items,
    practiceLabel,
    errorsLabel,
    lastAnswerLabel,
    emptyLabel,
    testId,
}: WeakAreasListProps) {
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
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-surface p-3"
                    data-testid={`weak-area-${item.id}`}
                >
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                            <span className="truncate font-medium text-fg-primary">
                                {item.element}
                            </span>
                            <span className="shrink-0 text-sm text-fg-muted">
                                {item.errors} {errorsLabel}
                            </span>
                        </div>
                        {item.last !== "" && (
                            <p className="mt-0.5 truncate text-sm text-fg-muted">
                                {lastAnswerLabel}{" "}
                                <span className="text-error">{item.last}</span>
                            </p>
                        )}
                    </div>
                    {item.onPractice && (
                        <button
                            type="button"
                            onClick={item.onPractice}
                            className="inline-flex min-h-[44px] shrink-0 items-center rounded-md bg-accent px-4 font-medium text-accent-fg hover:bg-accent-hover"
                            data-testid={`weak-area-practice-${item.id}`}
                        >
                            {practiceLabel}
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
}

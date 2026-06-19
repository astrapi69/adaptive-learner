/**
 * ProgressByPair — per-language-pair completion, broken down into
 * horizontal level bars (e.g. A1/A2/B1/B2). Each pair shows its overall
 * completion and a labelled bar per level.
 *
 * App-agnostic and props-driven: the caller supplies display-ready pair
 * names and pre-computed percentages; no i18n, storage, or app imports.
 * Bars are token-backed (they reuse the shared {@link ProgressBar}), so
 * they recolor across themes. Reusable for any "completion grouped by
 * category, split by sub-level" visual.
 *
 * @example
 * <ProgressByPair
 *   pairs={[{
 *     name: "German → Spanish",
 *     percent: 40,
 *     levels: [
 *       {level: "A1", percent: 80, barLabel: "A1: 80% complete"},
 *       {level: "A2", percent: 0, barLabel: "A2: 0% complete"},
 *     ],
 *   }]}
 *   emptyLabel="Download a lesson set to see progress."
 *   testId="progress-by-pair"
 * />
 */

import ProgressBar from "./ProgressBar";

/** One level's completion within a pair. */
export interface ProgressByPairLevel {
    /** Display level label, e.g. ``"A1"``. */
    level: string;
    /** Completion 0-100. */
    percent: number;
    /** Accessible name for this level's bar. */
    barLabel: string;
}

/** One source→target language pair. */
export interface ProgressByPairItem {
    /** Display-ready pair name, e.g. ``"German → Spanish"``. */
    name: string;
    /** Overall completion 0-100 across the pair's levels. */
    percent: number;
    levels: readonly ProgressByPairLevel[];
}

export interface ProgressByPairProps {
    pairs: readonly ProgressByPairItem[];
    /** Shown when there are no pairs. */
    emptyLabel: string;
    /** ``data-testid`` for the root. */
    testId?: string;
}

/** Per-pair, per-level completion bars (presentational, token-backed). */
export default function ProgressByPair({
    pairs,
    emptyLabel,
    testId,
}: ProgressByPairProps) {
    if (pairs.length === 0) {
        return (
            <p className="text-sm text-fg-muted" data-testid={testId}>
                {emptyLabel}
            </p>
        );
    }
    return (
        <div className="flex flex-col gap-5" data-testid={testId}>
            {pairs.map((pair) => (
                <div
                    key={pair.name}
                    className="flex flex-col gap-2"
                    data-testid={`pair-${pair.name}`}
                >
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-fg-primary">
                            {pair.name}
                        </span>
                        <span className="text-sm text-fg-muted">
                            {pair.percent}%
                        </span>
                    </div>
                    {pair.levels.map((level) => (
                        <div
                            key={level.level}
                            className="flex flex-col gap-1"
                        >
                            <div className="flex items-baseline justify-between gap-2">
                                <span
                                    className="min-w-0 break-words text-sm font-medium text-fg-secondary"
                                    title={level.level}
                                >
                                    {level.level}
                                </span>
                                <span className="shrink-0 text-sm text-fg-muted">
                                    {level.percent}%
                                </span>
                            </div>
                            <ProgressBar
                                valueNow={level.percent}
                                ariaLabel={level.barLabel}
                                className="relative h-3 w-full overflow-hidden rounded-full bg-bg-secondary"
                                fillClassName="h-full rounded-full bg-accent"
                                labelClassName="sr-only"
                                testId={`pair-${pair.name}-level-${level.level}`}
                            >
                                {level.percent}%
                            </ProgressBar>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

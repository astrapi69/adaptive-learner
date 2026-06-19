/**
 * CurriculumCard — a presentational card summarising one user-built
 * "custom path" (an ordered list of content lessons). Shows the path
 * name + optional description, a done/total progress line, and two
 * actions: Continue (jump to the next unfinished lesson) and Delete.
 *
 * App-agnostic and props-driven: it takes ready-to-display strings
 * (name, description, the next-lesson label) and labels, plus the
 * ``onContinue`` / ``onDelete`` callbacks the host wires to its
 * storage + router. No i18n / storage imports. Token-backed Tailwind,
 * 44px touch targets, stable testIds.
 *
 * Continue is disabled (and shows no next-lesson hint) when there is
 * no unfinished lesson — an empty or fully-completed path.
 *
 * @example
 * <CurriculumCard
 *   name="My French refresher"
 *   description="The lessons I keep forgetting"
 *   done={2}
 *   total={5}
 *   nextLabel="03 articles"
 *   progressLabel="2 of 5 done"
 *   continueLabel="Continue"
 *   deleteLabel="Delete"
 *   nextHintLabel="Next: 03 articles"
 *   onContinue={() => navigate(routeForNext)}
 *   onDelete={() => removePath(id)}
 * />
 */

import {Play, Trash2} from "lucide-react";

export interface CurriculumCardProps {
    /** The path's display name. */
    name: string;
    /** Optional description line under the name. */
    description?: string;
    /** Completed lesson count. */
    done: number;
    /** Total lesson count in the path. */
    total: number;
    /** Label of the next unfinished lesson, or undefined when the
     *  path is empty / fully completed (Continue is then disabled). */
    nextLabel?: string;
    /** Ready-to-display "N of M done" line. */
    progressLabel: string;
    /** Label on the Continue action. */
    continueLabel: string;
    /** Label on the Delete action. */
    deleteLabel: string;
    /** "Next: <lesson>" hint (already includes the lesson label).
     *  Shown only when ``nextLabel`` is set. */
    nextHintLabel?: string;
    /** Fired when Continue is pressed (only when enabled). */
    onContinue?: () => void;
    /** Fired when Delete is pressed. */
    onDelete?: () => void;
    testId?: string;
}

/** Presentational summary card for one custom path (token-backed). */
export default function CurriculumCard({
    name,
    description,
    done,
    total,
    nextLabel,
    progressLabel,
    continueLabel,
    deleteLabel,
    nextHintLabel,
    onContinue,
    onDelete,
    testId,
}: CurriculumCardProps) {
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const canContinue = !!nextLabel;

    return (
        <div
            className="flex flex-col gap-3 rounded-app border border-border bg-card p-4"
            data-testid={testId}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-fg-primary">
                        {name}
                    </h3>
                    {description && (
                        <p className="mt-0.5 text-sm text-fg-muted">
                            {description}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label={deleteLabel}
                    title={deleteLabel}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border text-fg-muted hover:bg-muted"
                    data-testid={testId ? `${testId}-delete` : undefined}
                >
                    <Trash2 size={16} aria-hidden="true" />
                </button>
            </div>

            <div className="flex flex-col gap-1">
                <div
                    className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={done}
                    aria-label={progressLabel}
                >
                    <div
                        className="h-full rounded-full bg-accent"
                        style={{width: `${percent}%`}}
                    />
                </div>
                <p className="text-xs text-fg-muted">{progressLabel}</p>
            </div>

            {canContinue && nextHintLabel && (
                <p
                    className="truncate text-sm text-fg-secondary"
                    data-testid={testId ? `${testId}-next` : undefined}
                >
                    {nextHintLabel}
                </p>
            )}

            <button
                type="button"
                onClick={onContinue}
                disabled={!canContinue}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid={testId ? `${testId}-continue` : undefined}
            >
                <Play size={16} aria-hidden="true" />
                {continueLabel}
            </button>
        </div>
    );
}

/**
 * Presentational parts for the Word-Tiles exercise (extracted from
 * WordTilesExercise.tsx to keep the renderer under the cohesion file-size
 * gate, mirroring matching-parts.tsx).
 *
 * Holds the shared tile-box styling constants and the read-only answer
 * view shown after checking. Pure presentation — no exercise state, no
 * network, no app-state imports.
 */

import {cn} from "@/lib/utils";

/** Shared tile box styling (was .word-tile / .word-tile-placed).
 *  Reused by the scrambled tile, the placed tile, and the floating
 *  DragOverlay copy so they render identically. 44px min touch target. */
export const WORD_TILE_BASE =
    "inline-flex min-h-11 items-center justify-center cursor-pointer rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-[0.9375rem] font-medium text-[var(--fg)] transition-[background,border-color] duration-150 enabled:hover:bg-[var(--surface-2)] disabled:cursor-not-allowed";

/** Placed-tile accent styling (overlaid on WORD_TILE_BASE). */
export const WORD_TILE_PLACED =
    "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))]";

/** Read-only tile row shown after checking. Each tile carries enough
 *  spacing (flex gap) to read as a sentence — replacing the old squished
 *  token-diff line (#1005). ``correctness === null`` paints every tile
 *  green (the all-correct solution view); otherwise per-position. */
export function WordTilesAnswerView({
    labels,
    correctness,
    testId,
    ariaLabel,
}: {
    labels: string[];
    correctness: boolean[] | null;
    testId: string;
    ariaLabel: string;
}) {
    return (
        <div
            className="rounded-sm border border-border bg-[var(--surface)] p-2"
            data-testid={testId}
            aria-label={ariaLabel}
        >
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {labels.map((label, i) => {
                    const ok = correctness ? correctness[i] : true;
                    return (
                        <li key={i}>
                            <span
                                className={cn(
                                    WORD_TILE_BASE,
                                    "cursor-default",
                                    ok
                                        ? "border-[var(--exercise-correct)] bg-[color-mix(in_srgb,var(--exercise-correct)_18%,var(--surface))]"
                                        : "border-[var(--exercise-wrong)] bg-[color-mix(in_srgb,var(--exercise-wrong)_12%,var(--surface))]",
                                )}
                                data-testid={`${testId}-tile-${i}`}
                                data-correct={ok}
                            >
                                {label}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

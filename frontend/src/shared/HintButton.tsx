/**
 * HintButton — a staged "reveal a hint" control. Shows a button that
 * reveals the next hint each press (light → strong); revealed hints
 * stack above it, and the button disappears once all are shown.
 *
 * App-agnostic and props-driven: hints arrive as ready-to-show strings,
 * labels are caller-supplied, and an optional ``onReveal(index)`` fires
 * each reveal (the seam an app uses to charge XP or record that help was
 * used). No i18n/storage imports. Renders nothing when there are no
 * hints. Token-backed Tailwind, 44px button.
 *
 * When ``disabled`` is set it renders a single non-interactive button
 * showing ``disabledLabel`` — the "feature off" affordance (visible but
 * unavailable, per the host's feature-state policy) instead of hiding.
 *
 * @example
 * <HintButton
 *   hints={["The answer has 5 letters", "It starts with “m” (5 letters)"]}
 *   revealLabel="Show a hint"
 *   costLabel="−5 XP"
 *   onReveal={(i) => spendXp(5, i)}
 * />
 */

import {Lightbulb} from "lucide-react";
import {useState} from "react";

export interface HintButtonProps {
    /** Ordered, ready-to-display hint strings (light first). */
    hints: readonly string[];
    /** Label on the reveal button. */
    revealLabel: string;
    /** Optional cost chip text (e.g. "−5 XP"); omitted when free. */
    costLabel?: string;
    /** Fired with the zero-based index each time a hint is revealed. */
    onReveal?: (index: number) => void;
    /** When true, render a single disabled button (no reveals) showing
     *  ``disabledLabel`` — the "hints are off" affordance. */
    disabled?: boolean;
    /** Label/tooltip for the disabled affordance (required when
     *  ``disabled``). */
    disabledLabel?: string;
    testId?: string;
}

/** Staged hint-reveal control (presentational, token-backed). */
export default function HintButton({
    hints,
    revealLabel,
    costLabel,
    onReveal,
    disabled = false,
    disabledLabel,
    testId,
}: HintButtonProps) {
    const [revealed, setRevealed] = useState(0);

    if (disabled) {
        return (
            <div
                className="flex flex-col items-start gap-1"
                data-testid={testId}
            >
                <button
                    type="button"
                    disabled
                    title={disabledLabel}
                    aria-label={disabledLabel}
                    className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-muted opacity-70"
                    data-testid={testId ? `${testId}-disabled` : undefined}
                >
                    <Lightbulb size={14} aria-hidden="true" />
                    {disabledLabel}
                </button>
            </div>
        );
    }

    if (hints.length === 0) return null;

    const handleReveal = () => {
        const index = revealed;
        setRevealed((n) => Math.min(n + 1, hints.length));
        onReveal?.(index);
    };

    return (
        <div className="flex flex-col items-start gap-1" data-testid={testId}>
            {revealed > 0 && (
                <ul
                    className="flex flex-col gap-1"
                    data-testid={testId ? `${testId}-revealed` : undefined}
                >
                    {hints.slice(0, revealed).map((hint, i) => (
                        <li
                            key={i}
                            className="rounded-md border border-border-subtle bg-bg-secondary px-2 py-1 text-sm text-fg-secondary"
                            data-testid={testId ? `${testId}-hint-${i}` : undefined}
                        >
                            {hint}
                        </li>
                    ))}
                </ul>
            )}
            {revealed < hints.length && (
                <button
                    type="button"
                    onClick={handleReveal}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
                    data-testid={testId ? `${testId}-reveal` : undefined}
                >
                    <Lightbulb size={14} aria-hidden="true" />
                    {revealLabel}
                    {costLabel && (
                        <span className="text-xs text-fg-muted">
                            {costLabel}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}

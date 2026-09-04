/**
 * ErrorCorrectionResolution (#2803).
 *
 * After the learner clicks "Solution" on a checked error-correction
 * exercise, this presentational component shows the correction IN the
 * token row: every token in authored order, the wrong token struck
 * through in red with the canonical correction (``accept[0]``) green
 * right beside it — so the learner sees WHERE in the sentence the error
 * sat, not just the target word. The sibling of ``MatchingResolution``
 * and ``CategorizationResolution`` for the error-correction type;
 * nothing here is editable.
 *
 * Accessibility: an ``aria-live`` region announces the corrected
 * sentence; the strike-through carries an X icon so the wrong token is
 * not marked by colour alone.
 */

import {Check, X} from "lucide-react";
import {Fragment} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";

export interface ErrorCorrectionResolutionProps {
    /** The sentence tokens in authored order. */
    tokens: readonly string[];
    /** Index of the wrong token (``payload.error_index``). */
    errorIndex: number;
    /** The canonical correction (``accept[0]``). */
    correction: string;
}

/**
 * Render the corrected sentence as a token row.
 *
 * @param props - See {@link ErrorCorrectionResolutionProps}.
 */
export default function ErrorCorrectionResolution({
    tokens,
    errorIndex,
    correction,
}: ErrorCorrectionResolutionProps) {
    const {t} = useI18n();
    const correctedSentence = tokens
        .map((token, index) => (index === errorIndex ? correction : token))
        .join(" ");
    const announcement = t(
        "lesson.exercise.al_error_correction.resolve_announce",
        "Solution shown. The corrected sentence is: {sentence}",
    ).replace("{sentence}", correctedSentence);

    return (
        <div data-testid="error-correction-resolution">
            <span
                className="sr-only"
                role="status"
                aria-live="polite"
                data-testid="error-correction-resolve-status"
            >
                {announcement}
            </span>
            <div className="flex flex-wrap items-center gap-2">
                {tokens.map((token, index) => {
                    if (index !== errorIndex) {
                        return (
                            <span
                                key={`${index}-${token}`}
                                className="min-h-11 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-base"
                            >
                                {token}
                            </span>
                        );
                    }
                    return (
                        <Fragment key={`${index}-${token}`}>
                            <span
                                className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] px-3 py-2 text-base line-through"
                                data-testid="error-correction-resolved-wrong"
                            >
                                <X
                                    size={12}
                                    aria-hidden="true"
                                    className="shrink-0 text-[var(--danger)]"
                                />
                                {token}
                            </span>
                            <span
                                className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] px-3 py-2 text-base font-medium"
                                data-testid="error-correction-resolved-correction"
                            >
                                <Check
                                    size={12}
                                    aria-hidden="true"
                                    className="shrink-0 text-[var(--success)]"
                                />
                                {correction}
                            </span>
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
}

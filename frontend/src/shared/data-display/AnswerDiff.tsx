/**
 * AnswerDiff — a labeled "your answer" vs "correct answer" comparison
 * that highlights the differing middle (the typo / wrong part) on each
 * side.
 *
 * App-agnostic and self-contained: it takes the two strings + the row
 * labels and computes a simple common-prefix/suffix diff inline (no app
 * imports), so it drops into any app. Token-backed Tailwind: the user's
 * differing part is error-coloured, the correct part success-coloured.
 * Reusable for any answer-feedback surface.
 *
 * @example
 * <AnswerDiff
 *   userAnswer="la libro"
 *   correctAnswer="el libro"
 *   yourLabel="Your answer:"
 *   correctLabel="Correct:"
 * />
 */

function commonPrefixLen(a: string, b: string): number {
    const max = Math.min(a.length, b.length);
    let i = 0;
    while (i < max && a[i] === b[i]) i++;
    return i;
}

function commonSuffixLen(a: string, b: string, cap: number): number {
    const max = Math.min(a.length, b.length) - cap;
    let i = 0;
    while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
    return i;
}

interface Split {
    prefix: string;
    middle: string;
    suffix: string;
}

/** Split a string into the shared prefix/suffix vs the differing middle. */
function split(self: string, other: string): Split {
    const p = commonPrefixLen(self, other);
    const s = commonSuffixLen(self, other, p);
    return {
        prefix: self.slice(0, p),
        middle: self.slice(p, self.length - s),
        suffix: self.slice(self.length - s),
    };
}

export interface AnswerDiffProps {
    userAnswer: string;
    correctAnswer: string;
    /** Label before the user's answer row. */
    yourLabel: string;
    /** Label before the correct answer row. */
    correctLabel: string;
    /** Shown in the user row when the user answer is empty. */
    emptyAnswerLabel?: string;
    testId?: string;
}

/** Labeled your-vs-correct answer comparison (presentational). */
export default function AnswerDiff({
    userAnswer,
    correctAnswer,
    yourLabel,
    correctLabel,
    emptyAnswerLabel,
    testId,
}: AnswerDiffProps) {
    const user = userAnswer.trim();
    const correct = correctAnswer.trim();
    const userSplit = split(user, correct);
    const correctSplit = split(correct, user);
    return (
        <span
            className="flex flex-col gap-0.5 text-sm"
            data-testid={testId}
        >
            <span data-testid={testId ? `${testId}-your` : undefined}>
                <span className="text-fg-muted">{yourLabel} </span>
                {user === "" ? (
                    <span className="italic text-fg-muted">
                        {emptyAnswerLabel ?? "-"}
                    </span>
                ) : (
                    <span className="font-mono">
                        {userSplit.prefix}
                        {userSplit.middle && (
                            <span className="rounded-sm bg-error/15 font-semibold text-error underline">
                                {userSplit.middle}
                            </span>
                        )}
                        {userSplit.suffix}
                    </span>
                )}
            </span>
            <span data-testid={testId ? `${testId}-correct` : undefined}>
                <span className="text-fg-muted">{correctLabel} </span>
                <span className="font-mono">
                    {correctSplit.prefix}
                    {correctSplit.middle && (
                        <span className="rounded-sm bg-success/15 font-semibold text-success">
                            {correctSplit.middle}
                        </span>
                    )}
                    {correctSplit.suffix}
                </span>
            </span>
        </span>
    );
}

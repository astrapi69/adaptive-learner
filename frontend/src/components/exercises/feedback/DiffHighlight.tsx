/**
 * Visual diff renderer for ``DiffToken[]``.
 *
 * Paints each token inline with theme-aware colour + a non-colour signal
 * (icon + decoration + aria-label) so the surface stays usable for
 * colourblind learners and screen-reader users. WCAG 2.1 SC 1.4.1 (use of
 * colour): every op type carries an icon AND a text decoration AND an
 * aria-label in addition to its colour.
 *
 * Phase 52B / v1.35.0 / F-112.
 */

import { type DiffToken } from "../../../lib/exercises/token-diff";

export interface DiffHighlightProps {
    tokens: DiffToken[];
    /** Extra class to merge onto the outer wrapper (e.g. for sizing context). */
    className?: string;
}

export default function DiffHighlight({ tokens, className }: DiffHighlightProps) {
    const wrapperClass = ["diff-highlight", className].filter(Boolean).join(" ");
    return (
        <span className={wrapperClass} data-testid="diff-highlight">
            {tokens.map((token, idx) => (
                <DiffTokenSpan key={idx} token={token} />
            ))}
        </span>
    );
}

function DiffTokenSpan({ token }: { token: DiffToken }) {
    if (token.type === "equal") {
        return (
            <span
                className="diff-token diff-token-equal"
                data-testid="diff-token-equal"
                data-type="equal"
            >
                {token.text}
            </span>
        );
    }
    if (token.type === "insert") {
        const trailing = token.text.endsWith(" ");
        const word = token.text.trimEnd();
        return (
            <>
                <span
                    className="diff-token diff-token-insert"
                    data-testid="diff-token-insert"
                    data-type="insert"
                    aria-label={`missing: ${word}`}
                >
                    <span className="diff-token-icon" aria-hidden="true">
                        +
                    </span>
                    <span className="diff-token-text">{word}</span>
                </span>
                {trailing ? " " : ""}
            </>
        );
    }
    if (token.type === "delete") {
        const trailing = token.text.endsWith(" ");
        const word = token.text.trimEnd();
        return (
            <>
                <span
                    className="diff-token diff-token-delete"
                    data-testid="diff-token-delete"
                    data-type="delete"
                    aria-label={`extra: ${word}`}
                >
                    <span className="diff-token-icon" aria-hidden="true">
                        ×
                    </span>
                    <span className="diff-token-text">{word}</span>
                </span>
                {trailing ? " " : ""}
            </>
        );
    }
    // replace
    const trailing = token.text.endsWith(" ");
    const userWord = token.text.trimEnd();
    const expectedWord = token.expected ?? "";
    return (
        <>
            <span
                className="diff-token diff-token-replace"
                data-testid="diff-token-replace"
                data-type="replace"
                aria-label={`wrote ${userWord}, expected ${expectedWord}`}
            >
                <span className="diff-token-user-word">{userWord}</span>
                <span className="diff-token-arrow" aria-hidden="true">
                    →
                </span>
                <span className="diff-token-expected-word">{expectedWord}</span>
            </span>
            {trailing ? " " : ""}
        </>
    );
}

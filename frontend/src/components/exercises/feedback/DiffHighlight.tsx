/**
 * Visual diff renderer for ``DiffToken[]``.
 *
 * Paints each token inline with theme-aware colour + a non-colour signal
 * (icon + decoration + screen-reader text) so the surface stays usable for
 * colourblind learners and screen-reader users. WCAG 2.1 SC 1.4.1 (use of
 * colour): every op type carries an icon AND a text decoration AND a
 * visually hidden sentence in the UI language in addition to its colour.
 * The sentence is real text, not an ``aria-label``: ARIA 1.2 does not let a
 * role-less span be named, so screen readers could skip the label, and the
 * visible parts are ``aria-hidden`` so nothing is read twice (#3425).
 *
 * Phase 52B / v1.35.0 / F-112.
 */

import { useI18n } from "../../../hooks/ui/useI18n";
import { type DiffToken } from "../../../lib/exercises/grading/token-diff";

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
    const { t } = useI18n();
    if (token.type === "equal") {
        // #1940 — emit the trailing space as an EXTERNAL text node (like
        // insert/delete/replace), not inside the span. `.diff-token` is
        // `display: inline-block`, whose box edge collapses trailing
        // whitespace, so a space kept inside the span vanished and equal-token
        // runs abutted ("Die KI übt" → "DieKIübt") in the summary answer diff.
        const trailing = token.text.endsWith(" ");
        const word = token.text.trimEnd();
        return (
            <>
                <span
                    className="diff-token diff-token-equal"
                    data-testid="diff-token-equal"
                    data-type="equal"
                >
                    {word}
                </span>
                {trailing ? " " : ""}
            </>
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
                >
                    <span className="sr-only">
                        {t("lesson.diff.missing", "Missing: {word}").replace("{word}", word)}
                    </span>
                    <span className="diff-token-icon" aria-hidden="true">
                        +
                    </span>
                    <span className="diff-token-text" aria-hidden="true">
                        {word}
                    </span>
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
                >
                    <span className="sr-only">
                        {t("lesson.diff.extra", "Extra: {word}").replace("{word}", word)}
                    </span>
                    <span className="diff-token-icon" aria-hidden="true">
                        ×
                    </span>
                    <span className="diff-token-text" aria-hidden="true">
                        {word}
                    </span>
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
            >
                <span className="sr-only">
                    {t("lesson.diff.replaced", "You wrote {wrote}, expected {expected}")
                        .replace("{wrote}", userWord)
                        .replace("{expected}", expectedWord)}
                </span>
                <span className="diff-token-user-word" aria-hidden="true">
                    {userWord}
                </span>
                <span className="diff-token-arrow" aria-hidden="true">
                    →
                </span>
                <span className="diff-token-expected-word" aria-hidden="true">
                    {expectedWord}
                </span>
            </span>
            {trailing ? " " : ""}
        </>
    );
}

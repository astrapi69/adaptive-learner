/**
 * ReadAlongText — renders plain speech text as word spans and
 * highlights the word the TTS engine is currently speaking
 * (TTS feature C5 — follow-along).
 *
 * The lesson read-aloud engine feeds the SAME plain text to
 * speechSynthesis and to this component, so the utterance's
 * ``onboundary`` charIndex maps directly onto the token offsets
 * here. The token whose [start, end) range contains the active
 * charIndex gets ``.tts-active``.
 *
 * Pure + presentational: the highlight styling (accent wash while
 * reading; a static underline under prefers-reduced-motion) lives
 * in CSS so the component stays trivial to test.
 */

export interface ReadAlongToken {
    text: string;
    start: number;
    isWord: boolean;
}

/** Split text into word + whitespace tokens, tagging each with its
 *  starting char offset so a boundary charIndex can locate the
 *  active word. Whitespace is preserved as its own tokens so the
 *  rendered text reads identically to the source. */
export function tokenizeForReadAlong(text: string): ReadAlongToken[] {
    const tokens: ReadAlongToken[] = [];
    const re = /\s+|\S+/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        const segment = match[0];
        tokens.push({
            text: segment,
            start: match.index,
            isWord: /\S/.test(segment),
        });
    }
    return tokens;
}

/** Index of the word token whose range contains ``activeChar``, or
 *  -1 when none (idle, between words, or out of range). */
export function activeTokenIndex(
    tokens: ReadAlongToken[],
    activeChar: number,
): number {
    if (activeChar < 0) return -1;
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (!tok.isWord) continue;
        if (activeChar >= tok.start && activeChar < tok.start + tok.text.length) {
            return i;
        }
    }
    return -1;
}

interface ReadAlongTextProps {
    text: string;
    /** charIndex of the word currently being spoken, or -1. */
    activeChar: number;
}

export default function ReadAlongText({text, activeChar}: ReadAlongTextProps) {
    const tokens = tokenizeForReadAlong(text);
    const active = activeTokenIndex(tokens, activeChar);
    return (
        <p className="lesson-read-along" data-testid="lesson-read-along">
            {tokens.map((tok, i) =>
                tok.isWord ? (
                    <span
                        key={i}
                        className={
                            i === active
                                ? "lesson-read-along-word tts-active"
                                : "lesson-read-along-word"
                        }
                        data-active={i === active ? "true" : undefined}
                    >
                        {tok.text}
                    </span>
                ) : (
                    <span key={i}>{tok.text}</span>
                ),
            )}
        </p>
    );
}

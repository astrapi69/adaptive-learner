/**
 * voice/chunk-text — split a long text into speakable chunks (#1928).
 *
 * WHY: iOS Safari silently stops a single ``SpeechSynthesisUtterance`` after
 * roughly 15 seconds. Read-aloud handed a whole theory run to the engine as
 * ONE utterance, so on iOS the reading broke off after ~12% of a typical
 * block (measured over the shipped content: 617 of 621 theory runs exceed the
 * 250-character mobile budget; median run 1551 characters). Chunking keeps
 * each utterance short enough that the engine finishes it and moves on to the
 * next one from its own queue.
 *
 * WHY NOT A LIBRARY: ``react-text-to-speech`` chunks too, but reports progress
 * only as an integer percentage — it cannot give back the absolute
 * ``charIndex`` that {@link useLessonAutoRead} needs to advance the lesson to
 * the next theory step while reading. Every chunk here therefore carries its
 * absolute ``offset``, so a boundary event can be reported in coordinates of
 * the ORIGINAL text and that feature keeps working exactly.
 *
 * Splitting prefers a sentence end, then a word boundary, and only cuts
 * mid-word when a single word is longer than the budget — so the engine never
 * pauses in the middle of a word.
 */

/** One speakable slice of a longer text. */
export interface TextChunk {
    /** The slice, spoken as its own utterance. */
    text: string;
    /**
     * Absolute character offset of this slice within the original text. Added
     * to an utterance-local ``charIndex`` it yields a boundary position in the
     * original text's coordinates.
     */
    offset: number;
}

/**
 * Default budget per utterance. Chosen to stay well inside the iOS cutoff at
 * normal speaking rates while keeping chunks long enough that the gaps
 * between them are not audible as stutter.
 */
export const DEFAULT_CHUNK_SIZE = 250;

/** Sentence terminators, including the CJK full stop and Greek question mark. */
const SENTENCE_END = /[.!?…。！？;:]/;

/**
 * Find the best split position inside ``window``, or ``-1`` when the window
 * has no usable boundary. Returns an index one PAST the last character that
 * belongs to the current chunk.
 */
function findSplit(window: string): number {
    // Prefer the last sentence end that is followed by whitespace, so an
    // abbreviation ("z. B.") or a decimal ("1.5") does not split the text.
    for (let i = window.length - 1; i > 0; i--) {
        if (SENTENCE_END.test(window[i]) && /\s/.test(window[i + 1] ?? " ")) {
            return i + 1;
        }
    }
    // Fall back to the last whitespace, so a chunk never ends mid-word.
    for (let i = window.length - 1; i > 0; i--) {
        if (/\s/.test(window[i])) return i + 1;
    }
    return -1;
}

/**
 * Split ``text`` into chunks of at most ``maxLength`` characters, each
 * carrying its absolute offset in the original text.
 *
 * A text at or under the budget is returned as a single chunk with offset 0,
 * so short prompts keep the previous single-utterance behaviour.
 *
 * @param text - The full text to speak.
 * @param maxLength - Character budget per chunk. Values below 1 fall back to
 *   the default.
 *
 * @example
 * chunkText("Erster Satz. Zweiter Satz.", 15);
 * // [{text: "Erster Satz. ", offset: 0}, {text: "Zweiter Satz.", offset: 13}]
 */
export function chunkText(
    text: string,
    maxLength: number = DEFAULT_CHUNK_SIZE,
): TextChunk[] {
    const budget = maxLength >= 1 ? maxLength : DEFAULT_CHUNK_SIZE;
    if (!text) return [];
    if (text.length <= budget) return [{ text, offset: 0 }];

    const chunks: TextChunk[] = [];
    let start = 0;
    while (start < text.length) {
        if (text.length - start <= budget) {
            chunks.push({ text: text.slice(start), offset: start });
            break;
        }
        const window = text.slice(start, start + budget);
        const split = findSplit(window);
        // No sentence end and no whitespace: a single word longer than the
        // budget. Cut it hard rather than blow the budget — the engine's own
        // limit is what we are protecting against.
        const end = start + (split > 0 ? split : budget);
        chunks.push({ text: text.slice(start, end), offset: start });
        start = end;
    }
    return chunks;
}

/**
 * reverseCloze — the Rückwärts-Modus cloze reversal (#1013).
 *
 * Reverse mode turns a cloze around: the original answer becomes visible
 * context, and a context word becomes the new blank ("Antwort sichtbar,
 * Kontext wird Lücke"). This is deterministic and gradeable — the new
 * blank's accepted answer is the exact context word, so the unmodified
 * ClozeExercise renderer plays it and the SRS records a real attempt.
 *
 * The reconstruction fills every original blank with its canonical answer
 * (``accept[0]``), then blanks the longest content word that is NOT one of
 * those answers (deterministic: longest wins, first occurrence on a tie;
 * words shorter than {@link MIN_CONTEXT_WORD_LEN} are skipped as likely
 * function words). When no suitable context word exists (a one-word gap, an
 * all-short sentence, malformed data) it returns ``null`` and the caller
 * leaves the cloze in its original direction.
 *
 * Pure + input-immutable.
 */

import type {ContentLessonExercise} from "../../storage/types";

/** Words shorter than this are skipped when choosing the new blank — they
 *  are usually articles / prepositions, not meaningful targets. */
export const MIN_CONTEXT_WORD_LEN = 4;

/** Unicode word matcher: letters/digits with internal apostrophes/hyphens.
 *  The ``g`` flag drives ``matchAll`` (positions feed the splice). */
const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/**
 * Reconstruct the full sentence with every blank filled by its canonical
 * answer. Returns ``null`` when the cloze is malformed (segment count does
 * not match the blanks, or a blank has no answer).
 */
function fillClozeBlanks(exercise: ContentLessonExercise): string | null {
    const {sentence, blanks} = exercise;
    if (!sentence || !blanks || blanks.length === 0) return null;
    const segments = sentence.split("___");
    if (segments.length !== blanks.length + 1) return null;
    let out = segments[0];
    for (let i = 0; i < blanks.length; i++) {
        const answer = blanks[i].accept?.[0];
        if (!answer) return null;
        out += answer + segments[i + 1];
    }
    return out;
}

/** The chosen new blank: the word + its character offset in the sentence. */
interface ContextWord {
    word: string;
    index: number;
}

/**
 * Pick the new blank: the longest whole word that is not one of the (now
 * visible) answers and is at least {@link MIN_CONTEXT_WORD_LEN} long.
 * Deterministic — longest wins, the earliest occurrence breaks ties. The
 * word position comes from the tokenizer, so the splice replaces a WHOLE
 * word (never a substring of a longer one) without a dynamic RegExp.
 */
function pickContextWord(
    fullSentence: string,
    answers: readonly string[],
): ContextWord | null {
    const answerSet = new Set(answers.map((a) => a.toLowerCase()));
    let best: ContextWord | null = null;
    for (const match of fullSentence.matchAll(WORD_RE)) {
        const word = match[0];
        if (word.length < MIN_CONTEXT_WORD_LEN) continue;
        if (answerSet.has(word.toLowerCase())) continue;
        if (best === null || word.length > best.word.length) {
            best = {word, index: match.index};
        }
    }
    return best;
}

/**
 * Reverse a cloze exercise: fill the original blanks, then blank a context
 * word. Returns a new ``type: "cloze"`` exercise (single blank, ``type``
 * mode) or ``null`` when no gradeable reversal exists. Never mutates input.
 *
 * @param exercise - A cloze exercise (any other type returns ``null``).
 */
export function reverseCloze(
    exercise: ContentLessonExercise,
): ContentLessonExercise | null {
    if (exercise.type !== "cloze") return null;
    const full = fillClozeBlanks(exercise);
    if (!full) return null;
    const answers = (exercise.blanks ?? [])
        .map((b) => b.accept?.[0] ?? "")
        .filter((a) => a !== "");
    const chosen = pickContextWord(full, answers);
    if (!chosen) return null;
    const sentence =
        full.slice(0, chosen.index) +
        "___" +
        full.slice(chosen.index + chosen.word.length);
    return {
        ...exercise,
        sentence,
        blanks: [{accept: [chosen.word]}],
        cloze_mode: "type",
        distractors: [],
    };
}

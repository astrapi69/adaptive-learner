/**
 * AI-suggested completion of a converted exercise's missing fields
 * (EXP-050 Stage 4, #2511).
 *
 * Stage 3 converts a ``free_text`` into a ``multiple_choice`` / ``cloze`` draft
 * (or a ``graded-quiz`` into a ``reading-comprehension`` draft) with the target
 * field left EMPTY for the author to fill. Stage 4 lets a model FILL that field
 * — the distractors, the cloze sentence, the passage — which the author then
 * reviews and edits in the existing inline editor before saving (the editor's
 * draft-plus-validator IS the preview, so there is no separate surface).
 *
 * Framework-free: each function takes the {@link AiProvider} seam
 * ({@link ../generation/generate-exercises}) so the prompt building, parsing and
 * the quality gate are deterministic and unit-testable with a fake provider; the
 * React side resolves a browser-direct provider and calls these.
 *
 * ## Two disciplines, both from EXP-041
 *
 * - **Non-destructive.** A suggestion only fills what is EMPTY. It never
 *   overwrites the correct answer or anything the author already typed —
 *   {@link suggestDistractors} skips existing option texts, the sentence/passage
 *   suggesters are offered by the caller only while the field is still the empty
 *   placeholder.
 * - **"Rather one fewer than one that does not hold."** A distractor that fails
 *   the gate (equals the answer, duplicates another, too short) is DROPPED, not
 *   shown. When nothing survives the caller tells the author to add one by hand.
 */

import type {ContentLessonExercise} from "../../../storage/types";
import type {AiProvider} from "../generation/generate-exercises";
import {asGradedQuizPayload} from "../../exercises/payload/graded-quiz";
import {asReadingComprehensionPayload} from "../../exercises/payload/reading-comprehension";

/** How many wrong options a multiple-choice question aims for (one correct +
 *  three distractors = four options, the common quiz shape). */
export const TARGET_DISTRACTOR_COUNT = 3;

/** The shortest answer worth accepting as a distractor / cloze word. */
const MIN_ANSWER_LENGTH = 2;

/** Reply-length caps — a short list of words / one sentence / a short passage. */
const DISTRACTOR_MAX_TOKENS = 300;
const SENTENCE_MAX_TOKENS = 200;
const PASSAGE_MAX_TOKENS = 500;

/** Case- and whitespace-insensitive equality for answer texts. */
function sameText(a: string, b: string): boolean {
    return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * Parse a model reply into a list of short answer strings. Accepts a JSON array
 * (the requested format) and falls back to line/bullet splitting, so a model
 * that ignores the format instruction still yields usable candidates.
 */
export function parseSuggestionList(reply: string): string[] {
    const trimmed = reply.trim();
    const fenced = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
        const parsed = JSON.parse(fenced);
        if (Array.isArray(parsed)) {
            return parsed
                .filter((entry): entry is string => typeof entry === "string")
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0);
        }
    } catch {
        // Not JSON — fall through to line splitting.
    }
    return fenced
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(?:[-*\d.)\]]+\s*)+/, "").trim())
        .map((line) => line.replace(/^["'`]|["'`]$/g, "").trim())
        .filter((line) => line.length > 0);
}

/**
 * Keep only distractors that HOLD: non-empty, at least {@link MIN_ANSWER_LENGTH}
 * characters, not equal to any accepted answer, and distinct from each other and
 * from the options already present. The reject list mirrors the deterministic
 * quality gate (``exercise-quality-gate.ts``) reduced to the distractor case.
 */
export function keepUsableDistractors(
    candidates: readonly string[],
    accepted: readonly string[],
    existing: readonly string[],
): string[] {
    const taken = [...accepted, ...existing].map((entry) => entry.trim());
    const kept: string[] = [];
    for (const raw of candidates) {
        const text = raw.trim();
        if (text.length < MIN_ANSWER_LENGTH) continue;
        if (taken.some((entry) => sameText(entry, text))) continue;
        if (kept.some((entry) => sameText(entry, text))) continue;
        kept.push(text);
    }
    return kept;
}

function buildDistractorPrompt(
    prompt: string,
    correctAnswer: string,
    count: number,
): string {
    return [
        "You help an author build a quiz question.",
        `Question: ${prompt}`,
        `Correct answer: ${correctAnswer}`,
        `Give exactly ${count} plausible but INCORRECT answer options for this question.`,
        "Use the SAME language and register as the question and answer.",
        "They must be clearly wrong, distinct from each other and from the correct answer, and not trivially silly.",
        'Return ONLY a JSON array of strings, e.g. ["...", "..."]. No explanation.',
    ].join("\n");
}

/**
 * The correct-answer text of a multiple-choice draft. A ``free_text`` converts
 * into an MC whose answer lives in the ``correct`` option's text (no ``accept``
 * field); a manually authored MC may also carry ``accept[0]``. Prefer the
 * correct option, fall back to ``accept[0]``.
 */
function multipleChoiceAnswer(exercise: ContentLessonExercise): string {
    const correctOption = (exercise.options ?? []).find(
        (option) => option.correct === true,
    );
    return (correctOption?.text ?? exercise.accept?.[0] ?? "").trim();
}

/**
 * Suggest wrong options for a ``multiple_choice`` draft converted from a
 * ``free_text``. Reads the correct answer from the ``correct`` option (or
 * ``accept[0]``), asks the model for enough distractors to reach
 * {@link TARGET_DISTRACTOR_COUNT} on top of the ones already filled, and returns
 * only those that pass {@link keepUsableDistractors}. Returns ``[]`` when there
 * is no answer to work from or nothing usable comes back (the caller then
 * prompts a manual add).
 */
export async function suggestDistractors(
    exercise: ContentLessonExercise,
    provider: AiProvider,
    options?: {signal?: AbortSignal},
): Promise<string[]> {
    const correctAnswer = multipleChoiceAnswer(exercise);
    if (!correctAnswer) return [];
    const existingWrong = (exercise.options ?? [])
        .filter((option) => option.correct !== true)
        .map((option) => option.text.trim())
        .filter((text) => text.length > 0);
    const needed = Math.max(0, TARGET_DISTRACTOR_COUNT - existingWrong.length);
    if (needed === 0) return [];
    const reply = await provider.complete(
        buildDistractorPrompt(exercise.prompt, correctAnswer, needed),
        {signal: options?.signal, maxTokens: DISTRACTOR_MAX_TOKENS},
    );
    const accepted = [correctAnswer, ...(exercise.accept ?? []).map((entry) => entry.trim())];
    return keepUsableDistractors(
        parseSuggestionList(reply),
        accepted,
        existingWrong,
    ).slice(0, needed);
}

/** Replace the FIRST case-insensitive occurrence of ``answer`` in ``sentence``
 *  with the cloze blank marker ``___``. Returns null when the answer does not
 *  appear (so a suggestion that ignored the word is rejected). */
export function blankOutAnswer(sentence: string, answer: string): string | null {
    const trimmed = sentence.trim();
    const index = trimmed.toLocaleLowerCase().indexOf(answer.trim().toLocaleLowerCase());
    if (index < 0) return null;
    return (
        trimmed.slice(0, index) + "___" + trimmed.slice(index + answer.trim().length)
    );
}

function buildSentencePrompt(answer: string): string {
    return [
        "You help an author build a fill-in-the-blank exercise.",
        `Write ONE natural example sentence that uses the word or phrase "${answer}" exactly once,`,
        "in the SAME language as that word, giving enough context to make it guessable.",
        "Return ONLY the sentence, with no quotes and no explanation.",
    ].join("\n");
}

/**
 * Suggest a cloze SENTENCE for a ``cloze`` draft converted from a ``free_text``.
 * The answer (``blanks[0].accept[0]``) is asked to appear in a natural sentence;
 * that occurrence is turned into ``___``. Returns the ``___``-bearing sentence,
 * or null when there is no answer or the model's sentence omitted it.
 */
export async function suggestClozeSentence(
    exercise: ContentLessonExercise,
    provider: AiProvider,
    options?: {signal?: AbortSignal},
): Promise<string | null> {
    const answer = (exercise.blanks?.[0]?.accept?.[0] ?? "").trim();
    if (answer.length < MIN_ANSWER_LENGTH) return null;
    const reply = await provider.complete(buildSentencePrompt(answer), {
        signal: options?.signal,
        maxTokens: SENTENCE_MAX_TOKENS,
    });
    // A model may wrap the sentence in quotes or add a trailing period line.
    const sentence = reply.trim().split(/\r?\n/)[0]?.replace(/^["'`]|["'`]$/g, "") ?? "";
    return blankOutAnswer(sentence, answer);
}

function buildPassagePrompt(questionPrompts: readonly string[]): string {
    return [
        "You help an author build a reading-comprehension exercise.",
        "Write a short passage (about 3 to 6 sentences) that a reader can use to answer these questions:",
        ...questionPrompts.map((prompt, index) => `${index + 1}. ${prompt}`),
        "Use the SAME language as the questions. Return ONLY the passage text, no title and no explanation.",
    ].join("\n");
}

/** The shortest passage worth accepting (a couple of sentences). */
const MIN_PASSAGE_LENGTH = 40;

/**
 * Suggest a PASSAGE from a list of question prompts. The payload-level entry
 * point — the reading-comprehension authoring fields own the payload directly,
 * so they call this instead of {@link suggestPassage}. Returns the trimmed
 * passage, or null when there are no usable questions or the reply is too short
 * to be a real passage.
 */
export async function suggestPassageForQuestions(
    questionPrompts: readonly string[],
    provider: AiProvider,
    options?: {signal?: AbortSignal},
): Promise<string | null> {
    const prompts = questionPrompts
        .map((prompt) => prompt.trim())
        .filter((prompt) => prompt.length > 0);
    if (prompts.length === 0) return null;
    const reply = await provider.complete(buildPassagePrompt(prompts), {
        signal: options?.signal,
        maxTokens: PASSAGE_MAX_TOKENS,
    });
    const passage = reply.trim();
    return passage.length >= MIN_PASSAGE_LENGTH ? passage : null;
}

/**
 * Suggest a PASSAGE for a ``reading-comprehension`` draft converted from a
 * ``graded-quiz`` (which carries no passage). The questions steer the passage.
 * Returns the trimmed passage, or null when there are no questions or the reply
 * is too short to be a real passage.
 */
export async function suggestPassage(
    exercise: ContentLessonExercise,
    provider: AiProvider,
    options?: {signal?: AbortSignal},
): Promise<string | null> {
    const payload =
        asReadingComprehensionPayload(exercise) ?? asGradedQuizPayload(exercise);
    const prompts = (payload?.questions ?? []).map((question) => question.prompt);
    return suggestPassageForQuestions(prompts, provider, options);
}

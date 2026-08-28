/**
 * AI fix suggestion for a mentor note (#2769, umbrella #2765).
 *
 * The author annotated a step while playing ("typo", "too easy", …);
 * this suggester asks the BYOK provider for a short, CONCRETE revision
 * proposal for exactly that step, in the author's UI language. The
 * proposal is displayed for the author to apply by hand in the editor —
 * deliberately never auto-applied to the draft (the EXP-041
 * non-destructive discipline).
 *
 * Framework-free: takes the {@link AiProvider} seam so prompt building
 * and reply cleaning stay deterministic and unit-testable with a fake
 * provider (the EXP-050 ``exercise-suggest`` pattern).
 */

import type {ContentLessonExercise} from "../../../storage/types";
import type {AiProvider} from "../generation/generate-exercises";
import type {MentorNoteCategory} from "../../lesson/mentor-notes-store";

/** A short proposal, not an essay. */
const SUGGESTION_MAX_TOKENS = 400;

/** What the suggester needs to know about the annotated step. */
export interface MentorFixInput {
    /** The note's category key (``typo`` / ``unclear`` / …). */
    category: MentorNoteCategory;
    /** The author's free-text note. */
    noteText: string;
    /** Title of the lesson being edited (context for the model). */
    lessonTitle: string;
    /** The annotated exercise, or ``null`` for a theory-step note. */
    exercise: ContentLessonExercise | null;
    /** BCP-47-ish UI language the proposal should be written in. */
    language: string;
}

/** Build the deterministic prompt for {@link suggestMentorFix}. */
export function buildMentorFixPrompt(input: MentorFixInput): string {
    const exercisePart = input.exercise
        ? `The annotated exercise, as JSON:\n${JSON.stringify(input.exercise, null, 2)}`
        : "The note refers to a theory step of the lesson (no exercise JSON available).";
    return [
        "You help the author of a learning lesson improve one step they flagged while playing it.",
        `Lesson title: ${input.lessonTitle}`,
        `Flag category: ${input.category}`,
        `Author's note: ${input.noteText}`,
        exercisePart,
        "Reply with a short, concrete revision proposal (at most 5 sentences):",
        "state exactly what to change and give the improved wording or values ready to copy.",
        `Write the proposal in the language with code "${input.language}".`,
        "No preamble, no repetition of the task.",
    ].join("\n\n");
}

/**
 * Ask the provider for a fix proposal. Returns the cleaned reply, or an
 * empty string when nothing usable came back (the caller shows the
 * "nothing usable" affordance, per "rather one fewer").
 */
export async function suggestMentorFix(
    provider: AiProvider,
    input: MentorFixInput,
): Promise<string> {
    const reply = await provider.complete(buildMentorFixPrompt(input), {
        maxTokens: SUGGESTION_MAX_TOKENS,
    });
    return reply
        .trim()
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/, "")
        .trim();
}

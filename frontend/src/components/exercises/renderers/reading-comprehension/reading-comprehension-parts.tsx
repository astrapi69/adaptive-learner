/**
 * Presentational parts for ReadingComprehensionExercise (#2633), extracted so
 * neither file crosses the 500-line size gate - the same split the matching
 * renderer already uses (``matching-parts.tsx``, #431). Holds the per-option
 * verdict vocabulary, one MC option tile, and the sub-question block.
 *
 * The pair lives in its own ``reading-comprehension/`` folder rather than flat
 * in ``renderers/``: that directory sits at the #809 god-folder ceiling (15
 * flat source files), so a second file there would trip the gate. Same shape
 * as the existing ``image-description/`` and ``word-tiles/`` renderer folders.
 *
 * The resolution speaks the SAME feedback language as the pairs
 * (``MatchingExercise``, #183/#191) and ``MultipleChoiceExercise``: after
 * checking, the authored-correct option is tinted GREEN and the learner's
 * wrong pick RED, drawing on the shared ``--exercise-correct`` /
 * ``--exercise-wrong`` tokens and their ``--matching-*-bg`` tints. Grading and
 * state stay in ``ReadingComprehensionExercise.tsx``; there is no import back
 * from it, so there is no cycle.
 */

import {Check, X} from "lucide-react";

import {cn} from "@/lib/utils";
import InlineMarkdown from "../../../../shared/data-display/InlineMarkdown";
import {
    canonicalAnswer,
    type RcQuestion,
} from "../../../../lib/exercises/payload/reading-comprehension";

/** Per-option resolution state for a checked multiple_choice sub-question,
 *  mirroring the ``MultipleChoiceExercise`` vocabulary:
 *
 *    - ``correct`` - an authored-correct option the learner picked (green).
 *    - ``missed``  - an authored-correct option they did NOT pick (green,
 *      dashed - it is the answer, but it is not what they chose).
 *    - ``wrong``   - their pick, which is not correct (red).
 *    - ``neutral`` - an untouched distractor.
 *
 *  Both green states carry a check icon and a text badge, so correctness is
 *  never conveyed by color alone. */
export type OptionVerdict = "correct" | "missed" | "wrong" | "neutral";

export function optionVerdict(
    isCorrectOption: boolean,
    chosen: boolean,
): OptionVerdict {
    if (isCorrectOption) return chosen ? "correct" : "missed";
    return chosen ? "wrong" : "neutral";
}

export interface OptionLabels {
    badgeCorrect: string;
    badgeWrong: string;
    badgeMissed: string;
}

export interface QuestionLabels extends OptionLabels {
    solution: string;
    inputLabel: string;
}

/** One MC option button. Before checking it is a plain selectable tile; after
 *  checking it carries its ``OptionVerdict`` as tint + badge, so the right
 *  answer is visible in place instead of only as prose below. */
function ReadingComprehensionOption({
    option,
    questionIndex,
    optionIndex,
    chosen,
    submitted,
    onSelect,
    labels,
}: {
    option: NonNullable<RcQuestion["options"]>[number];
    questionIndex: number;
    optionIndex: number;
    chosen: boolean;
    submitted: boolean;
    onSelect: () => void;
    labels: OptionLabels;
}) {
    const verdict = submitted
        ? optionVerdict(option.correct === true, chosen)
        : "neutral";
    const badge =
        verdict === "correct"
            ? labels.badgeCorrect
            : verdict === "wrong"
              ? labels.badgeWrong
              : labels.badgeMissed;
    return (
        <button
            type="button"
            aria-pressed={chosen}
            disabled={submitted}
            onClick={onSelect}
            className={cn(
                "flex min-h-11 items-center gap-3 rounded-sm border px-3 py-2 text-left text-base",
                "border-[var(--border-strong)] bg-[var(--surface)]",
                chosen &&
                    !submitted &&
                    "border-[var(--accent)] outline outline-2 outline-[var(--accent)]",
                verdict === "correct" &&
                    "border-[var(--exercise-correct)] bg-[var(--matching-correct-bg)] text-[var(--matching-correct-fg)]",
                verdict === "missed" &&
                    "border-dashed border-[var(--exercise-correct)] bg-[var(--matching-correct-bg)] text-[var(--matching-correct-fg)]",
                verdict === "wrong" &&
                    "border-[var(--exercise-wrong)] bg-[var(--matching-error-bg)] text-[var(--matching-error-fg)]",
            )}
            data-testid={`reading-comprehension-q${questionIndex}-option-${optionIndex}`}
            data-verdict={submitted ? verdict : undefined}
        >
            <span className="flex-1">{option.text}</span>
            {submitted && verdict !== "neutral" && (
                <span
                    className={cn(
                        "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
                        verdict === "wrong"
                            ? "text-[var(--exercise-wrong)]"
                            : "text-[var(--exercise-correct)]",
                    )}
                    data-testid={`reading-comprehension-q${questionIndex}-badge-${optionIndex}`}
                >
                    {verdict === "wrong" ? (
                        <X size={12} aria-hidden="true" />
                    ) : (
                        <Check size={12} aria-hidden="true" />
                    )}
                    {badge}
                </span>
            )}
        </button>
    );
}

/** One sub-question: MC option buttons or a free-text input, with a post-check
 *  verdict on the block, per-option green/red resolution (#2633) and the
 *  canonical solution when wrong. */
export function ReadingComprehensionQuestion({
    question,
    displayOptions,
    questionIndex,
    answer,
    submitted,
    correct,
    onSelect,
    labels,
}: {
    question: RcQuestion;
    /** #2317: the question's options in shuffled display order (grading is
     *  by text, so this is a pure presentation reorder). */
    displayOptions: RcQuestion["options"];
    questionIndex: number;
    answer: string;
    submitted: boolean;
    correct: boolean;
    onSelect: (value: string) => void;
    labels: QuestionLabels;
}) {
    const verdict = submitted ? (correct ? "correct" : "wrong") : undefined;
    return (
        <section
            className={cn(
                "flex flex-col gap-2 rounded-sm border p-2",
                submitted && correct && "border-[var(--exercise-correct)]",
                submitted && !correct && "border-[var(--exercise-wrong)]",
                !submitted && "border-[var(--border-strong)]",
            )}
            data-testid={`reading-comprehension-question-${questionIndex}`}
            data-verdict={verdict}
        >
            <p className="m-0 font-medium">
                <InlineMarkdown>{question.prompt}</InlineMarkdown>
            </p>

            {question.type === "multiple_choice" ? (
                <div className="flex flex-col gap-2">
                    {(displayOptions ?? []).map((option, optionIndex) => (
                        <ReadingComprehensionOption
                            key={optionIndex}
                            option={option}
                            questionIndex={questionIndex}
                            optionIndex={optionIndex}
                            chosen={answer === option.text}
                            submitted={submitted}
                            onSelect={() => onSelect(option.text)}
                            labels={labels}
                        />
                    ))}
                </div>
            ) : (
                <input
                    type="text"
                    value={answer}
                    disabled={submitted}
                    onChange={(changeEvent) => onSelect(changeEvent.target.value)}
                    aria-label={labels.inputLabel}
                    className={cn(
                        "min-h-11 w-full rounded-sm border bg-[var(--surface)] px-3 py-2 text-base",
                        !submitted && "border-[var(--border-strong)]",
                        submitted &&
                            correct &&
                            "border-[var(--exercise-correct)] bg-[var(--matching-correct-bg)] text-[var(--matching-correct-fg)]",
                        submitted &&
                            !correct &&
                            "border-[var(--exercise-wrong)] bg-[var(--matching-error-bg)] text-[var(--matching-error-fg)]",
                    )}
                    data-testid={`reading-comprehension-q${questionIndex}-input`}
                />
            )}

            {submitted && !correct && (
                <p
                    className="m-0 flex items-center gap-1.5 rounded-sm border-l-2 border-dashed border-[var(--exercise-correct)] bg-[var(--matching-correct-bg)] px-2 py-1 text-sm font-semibold text-[var(--matching-correct-fg)]"
                    data-testid={`reading-comprehension-q${questionIndex}-solution`}
                >
                    <Check
                        size={13}
                        aria-hidden="true"
                        className="shrink-0 text-[var(--exercise-correct)]"
                    />
                    <span>
                        {labels.solution}
                        {": "}
                        <strong>{canonicalAnswer(question)}</strong>
                    </span>
                </p>
            )}
        </section>
    );
}

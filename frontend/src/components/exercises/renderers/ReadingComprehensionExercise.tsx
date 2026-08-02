/**
 * ReadingComprehensionExercise (#1579, third adoption) - renderer for the
 * adopted extension type ``ext:al-reading-comprehension``: a shared passage
 * (stimulus) bound to N sub-questions that reuse the core multiple_choice /
 * free_text shapes.
 *
 * Each sub-question is graded with the EXISTING grading: multiple_choice by
 * exact correct-option text, free_text through the shared ``isFreeTextCorrect``
 * matcher (so it inherits the #1580 normalization + typo tolerance). The score
 * is the per-question tally; after a wrong sub-question its canonical answer
 * (accept[0] / first correct option) is surfaced - the same display contract
 * as the sibling extension types, and the reviewed (locked) reconstruction
 * shows exactly the same state as a fresh submit.
 *
 * Result contract: ``onComplete({correct, total, attempts, raw_answer})`` with
 * ``raw_answer.kind === "al_reading_comprehension"`` (one answer per question).
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {cn} from "@/lib/utils";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import {deriveReadingComprehensionAttempts} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {seededShuffle} from "../../../lib/exercises/grading/seeded-shuffle";
import {
    asReadingComprehensionPayload,
    canonicalAnswer,
    type RcQuestion,
} from "../../../lib/exercises/payload/reading-comprehension";
import {isFreeTextCorrect} from "../../../lib/exercises/grading/free-text-grading";
import type {ContentLessonExercise} from "../../../storage/types";
import AnswerCelebration from "../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../feedback/ExerciseSuccessAdvance";
import ExerciseFooter from "../shell/ExerciseFooter";
import ExerciseHint from "../feedback/ExerciseHint";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../shell/exercise-control";

export interface ReadingComprehensionExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Called on submit with the per-question score + one SRS attempt per
     *  sub-question. */
    onComplete: (result: ExerciseScored) => void;
}

/** Grade one sub-question: multiple_choice by exact correct-option text,
 *  free_text through the shared matcher. */
function gradeQuestion(question: RcQuestion, answer: string): boolean {
    if (question.type === "multiple_choice") {
        const correctTexts = (question.options ?? [])
            .filter((option) => option.correct === true)
            .map((option) => option.text);
        return correctTexts.includes(answer);
    }
    if (question.type === "free_text") {
        return isFreeTextCorrect(answer, question.accept ?? []);
    }
    return false;
}

function ReadingComprehensionExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        onAdvance,
        advanceLabel,
    }: ReadingComprehensionExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const payload = useMemo(
        () => asReadingComprehensionPayload(exercise),
        [exercise],
    );
    const reviewedAnswer =
        reviewed?.kind === "al_reading_comprehension" ? reviewed : null;
    const questions = useMemo(() => payload?.questions ?? [], [payload]);

    // #2317: shuffle each MC question's options for display so the correct
    // option isn't positionally predictable. Grading is by option TEXT, so the
    // display order is independent of correctness. Seeded per question by
    // ``${exercise.id}#${index}`` - deterministic and stable within a session.
    const displayOptions = useMemo(
        () =>
            questions.map((question, index) =>
                seededShuffle(question.options ?? [], `${exercise.id}#${index}`),
            ),
        [questions, exercise.id],
    );

    const [answers, setAnswers] = useState<string[]>(() =>
        reviewedAnswer ? [...reviewedAnswer.answers] : questions.map(() => ""),
    );

    const perQuestionCorrect = questions.map((question, index) =>
        gradeQuestion(question, answers[index] ?? ""),
    );
    const canCheck =
        questions.length > 0 && answers.every((answer) => answer.trim() !== "") &&
        answers.length === questions.length;

    const reviewedResult = reviewedAnswer
        ? {
              correct: questions.filter((question, index) =>
                  gradeQuestion(question, reviewedAnswer.answers[index] ?? ""),
              ).length,
              total: questions.length,
          }
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: canCheck,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const results = questions.map((question, index) => ({
                answer: answers[index] ?? "",
                correct: gradeQuestion(question, answers[index] ?? ""),
            }));
            return {
                correct: results.filter((questionResult) => questionResult.correct).length,
                total: questions.length,
                attempts: deriveReadingComprehensionAttempts(
                    exercise,
                    {setId, lessonId},
                    results,
                ),
                raw_answer: {
                    kind: "al_reading_comprehension",
                    answers: [...answers],
                },
            };
        },
        resetAnswer: () => setAnswers(questions.map(() => "")),
    });

    if (!payload || questions.length === 0) {
        return (
            <div data-testid="reading-comprehension-empty">
                {t(
                    "lesson.exercise.al_reading_comprehension.empty",
                    "This reading exercise has no questions.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct === result.total;

    const setAnswerAt = (index: number, value: string) => {
        if (submitted) return;
        setAnswers((previous) => {
            const next = [...previous];
            next[index] = value;
            return next;
        });
    };

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="reading-comprehension-exercise"
        >
            {exercise.prompt && (
                <p
                    className="m-0 font-medium"
                    data-testid="reading-comprehension-prompt"
                >
                    <InlineMarkdown>{exercise.prompt}</InlineMarkdown>
                </p>
            )}

            <div
                className="rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-base"
                data-testid="reading-comprehension-passage"
            >
                <InlineMarkdown>{payload.passage}</InlineMarkdown>
            </div>

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="reading-comprehension-hint-button"
            />

            {questions.map((question, questionIndex) => (
                <ReadingComprehensionQuestion
                    key={questionIndex}
                    question={question}
                    displayOptions={displayOptions[questionIndex] ?? []}
                    questionIndex={questionIndex}
                    answer={answers[questionIndex] ?? ""}
                    submitted={submitted}
                    correct={perQuestionCorrect[questionIndex] ?? false}
                    onSelect={(value) => setAnswerAt(questionIndex, value)}
                    labels={{
                        solution: t(
                            "lesson.exercise.al_reading_comprehension.solution_label",
                            "Solution",
                        ),
                        inputLabel: t(
                            "lesson.exercise.al_reading_comprehension.input_label",
                            "Answer",
                        ),
                    }}
                />
            ))}

            <ReadingComprehensionResult
                submitted={submitted}
                isCorrect={isCorrect}
                result={result}
                showAnswerToggle={showAnswerToggle}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
                controlled={controlled}
                canCheck={canCheck}
                onCheck={submit}
                onRetry={reset}
            />
        </section>
    );
}

/** One sub-question: MC option buttons or a free-text input, with a
 *  post-check verdict on the block and the canonical solution when wrong. */
function ReadingComprehensionQuestion({
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
    labels: {solution: string; inputLabel: string};
}) {
    const verdict = submitted ? (correct ? "correct" : "wrong") : undefined;
    return (
        <section
            className={cn(
                "flex flex-col gap-2 rounded-sm border p-2",
                submitted && correct && "border-[var(--success)]",
                submitted && !correct && "border-[var(--danger)]",
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
                        <button
                            key={optionIndex}
                            type="button"
                            aria-pressed={answer === option.text}
                            disabled={submitted}
                            onClick={() => onSelect(option.text)}
                            className={cn(
                                "min-h-11 rounded-sm border px-3 py-2 text-left text-base",
                                "border-[var(--border-strong)] bg-[var(--surface)]",
                                answer === option.text &&
                                    !submitted &&
                                    "border-[var(--accent)] outline outline-2 outline-[var(--accent)]",
                                answer === option.text &&
                                    submitted &&
                                    "border-[var(--fg-muted)]",
                            )}
                        >
                            {option.text}
                        </button>
                    ))}
                </div>
            ) : (
                <input
                    type="text"
                    value={answer}
                    disabled={submitted}
                    onChange={(changeEvent) => onSelect(changeEvent.target.value)}
                    aria-label={labels.inputLabel}
                    className="min-h-11 w-full rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-base"
                    data-testid={`reading-comprehension-q${questionIndex}-input`}
                />
            )}

            {submitted && !correct && (
                <p
                    className="m-0 text-sm text-[var(--fg-muted)]"
                    data-testid={`reading-comprehension-q${questionIndex}-solution`}
                >
                    {labels.solution}
                    {": "}
                    <strong>{canonicalAnswer(question)}</strong>
                </p>
            )}
        </section>
    );
}

/** Post-check aggregate feedback + the shared check/retry footer. */
function ReadingComprehensionResult({
    submitted,
    isCorrect,
    result,
    showAnswerToggle,
    onAdvance,
    advanceLabel,
    controlled,
    canCheck,
    onCheck,
    onRetry,
}: {
    submitted: boolean;
    isCorrect: boolean;
    result: {correct: number; total: number} | null;
    showAnswerToggle: boolean;
    onAdvance?: () => void;
    advanceLabel?: string;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
}) {
    const {t} = useI18n();
    return (
        <div className="flex flex-wrap items-center gap-2">
            {submitted && result && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 inline-flex items-center gap-1 font-medium",
                            isCorrect
                                ? "is-correct text-[var(--success)]"
                                : "is-wrong text-[var(--danger)]",
                        )}
                        data-testid="reading-comprehension-result"
                        data-result={isCorrect ? "correct" : "wrong"}
                    >
                        {isCorrect ? (
                            <Check size={14} aria-hidden="true" />
                        ) : (
                            <X size={14} aria-hidden="true" />
                        )}
                        {`${result.correct}/${result.total} `}
                        {isCorrect
                            ? t(
                                  "lesson.exercise.al_reading_comprehension.result_correct",
                                  "Correct!",
                              )
                            : t(
                                  "lesson.exercise.al_reading_comprehension.result_wrong",
                                  "Not quite. Review the highlighted questions.",
                              )}
                    </p>
                    {isCorrect && showAnswerToggle && onAdvance && (
                        <ExerciseSuccessAdvance
                            onAdvance={onAdvance}
                            label={advanceLabel}
                            testIdPrefix="reading-comprehension"
                        />
                    )}
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="reading-comprehension"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t(
                    "lesson.exercise.al_reading_comprehension.submit",
                    "Check answers",
                )}
                retryLabel={t(
                    "lesson.exercise.al_reading_comprehension.retry",
                    "Try again",
                )}
            />
        </div>
    );
}

export default forwardRef(ReadingComprehensionExercise);

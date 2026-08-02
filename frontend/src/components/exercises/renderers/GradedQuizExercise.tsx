/**
 * GradedQuizExercise (#1579, fourth adoption) - renderer for the adopted
 * extension type ``ext:al-graded-quiz``: a scored question set. Multi-select
 * ``multiple_choice`` (checkboxes, so partial credit is possible) and
 * ``free_text``, points per question, an aggregate points score and pass/fail
 * against ``pass_threshold``.
 *
 * The exercise SCORE reported to the app (``correct/total`` for XP) counts
 * correct QUESTIONS, keeping per-question learning granularity; the POINTS and
 * pass/fail are the formal test grade shown in the result. MC is graded by the
 * core points math (exact / proportional partial credit); free_text through
 * the shared ``isFreeTextCorrect`` matcher (inherits the #1580 normalization).
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {cn} from "@/lib/utils";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import {deriveGradedQuizAttempts} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {seededShuffle} from "../../../lib/exercises/grading/seeded-shuffle";
import {
    asGradedQuizPayload,
    canonicalAnswer,
    isPassed,
    mcQuestionResult,
    totalPoints,
    type GqQuestion,
} from "../../../lib/exercises/payload/graded-quiz";
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

export interface GradedQuizExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    onComplete: (result: ExerciseScored) => void;
}

/** Format points without a trailing ``.0`` on whole numbers. */
function fmtPoints(value: number): string {
    return value === Math.trunc(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** Per-question grade: ``correct`` (fully right, for XP/SRS) + ``earned`` points. */
function gradeQuestion(question: GqQuestion, chosen: string[]): {correct: boolean; earned: number} {
    if (question.type === "free_text") {
        const correct = isFreeTextCorrect(chosen[0] ?? "", question.accept ?? []);
        return {correct, earned: correct ? question.points : 0};
    }
    return mcQuestionResult(question, chosen);
}

/** The learner's answer as one string (for the SRS attempt log). */
function answerText(question: GqQuestion, chosen: string[]): string {
    return question.type === "free_text" ? (chosen[0] ?? "") : chosen.join(", ");
}

function GradedQuizExercise(
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
    }: GradedQuizExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const payload = useMemo(() => asGradedQuizPayload(exercise), [exercise]);
    const reviewedAnswer = reviewed?.kind === "al_graded_quiz" ? reviewed : null;
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

    const [answers, setAnswers] = useState<string[][]>(() =>
        reviewedAnswer ? reviewedAnswer.answers.map((a) => [...a]) : questions.map(() => []),
    );

    const perQuestion = questions.map((question, index) => gradeQuestion(question, answers[index] ?? []));
    const earnedPoints = perQuestion.reduce((sum, result) => sum + result.earned, 0);
    const totalPts = payload ? totalPoints(payload) : 0;
    const passed = payload ? isPassed(payload, earnedPoints) : false;

    const canCheck =
        questions.length > 0 && answers.length === questions.length &&
        answers.every((answer) => answer.some((entry) => entry.trim() !== ""));

    const reviewedResult = reviewedAnswer
        ? {
              correct: questions.filter((question, index) =>
                  gradeQuestion(question, reviewedAnswer.answers[index] ?? []).correct,
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
            const results = questions.map((question, index) => {
                const chosen = answers[index] ?? [];
                return {...gradeQuestion(question, chosen), answer: answerText(question, chosen)};
            });
            return {
                correct: results.filter((questionResult) => questionResult.correct).length,
                total: questions.length,
                attempts: deriveGradedQuizAttempts(
                    exercise,
                    {setId, lessonId},
                    results.map((questionResult) => ({answer: questionResult.answer, correct: questionResult.correct})),
                ),
                raw_answer: {kind: "al_graded_quiz", answers: answers.map((a) => [...a])},
            };
        },
        resetAnswer: () => setAnswers(questions.map(() => [])),
    });

    if (!payload || questions.length === 0) {
        return (
            <div data-testid="graded-quiz-empty">
                {t("lesson.exercise.al_graded_quiz.empty", "This quiz has no questions.")}
            </div>
        );
    }

    const toggleOption = (index: number, text: string) => {
        if (submitted) return;
        setAnswers((previous) => {
            const next = previous.map((a) => [...a]);
            const current = next[index] ?? [];
            next[index] = current.includes(text) ? current.filter((entry) => entry !== text) : [...current, text];
            return next;
        });
    };

    const setFreeText = (index: number, value: string) => {
        if (submitted) return;
        setAnswers((previous) => {
            const next = previous.map((a) => [...a]);
            next[index] = [value];
            return next;
        });
    };

    return (
        <section className="flex flex-col gap-3" data-testid="graded-quiz-exercise">
            {exercise.prompt && (
                <p className="m-0 font-medium" data-testid="graded-quiz-prompt">
                    <InlineMarkdown>{exercise.prompt}</InlineMarkdown>
                </p>
            )}

            {questions.map((question, questionIndex) => (
                <GradedQuizQuestion
                    key={questionIndex}
                    question={question}
                    displayOptions={displayOptions[questionIndex] ?? []}
                    questionIndex={questionIndex}
                    answer={answers[questionIndex] ?? []}
                    submitted={submitted}
                    correct={perQuestion[questionIndex]?.correct ?? false}
                    onToggle={(text) => toggleOption(questionIndex, text)}
                    onFreeText={(value) => setFreeText(questionIndex, value)}
                    pointsLabel={`${fmtPoints(question.points)} P.`}
                    solutionLabel={t("lesson.exercise.al_graded_quiz.solution_label", "Solution")}
                    inputLabel={t("lesson.exercise.al_graded_quiz.input_label", "Answer")}
                />
            ))}

            <ExerciseHint exercise={exercise} submitted={submitted} testId="graded-quiz-hint-button" />

            <GradedQuizResult
                submitted={submitted}
                passed={passed}
                scoreLabel={`${fmtPoints(earnedPoints)}/${fmtPoints(totalPts)} P.`}
                showAnswerToggle={showAnswerToggle}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
                controlled={controlled}
                canCheck={canCheck}
                onCheck={submit}
                onRetry={reset}
                hasResult={result !== null}
            />
        </section>
    );
}

/** One scored question: multi-select checkboxes or a free-text input, with a
 *  post-check verdict on the block and the canonical solution when wrong. */
function GradedQuizQuestion({
    question,
    displayOptions,
    questionIndex,
    answer,
    submitted,
    correct,
    onToggle,
    onFreeText,
    pointsLabel,
    solutionLabel,
    inputLabel,
}: {
    question: GqQuestion;
    /** #2317: the question's options in shuffled display order (grading is
     *  by text, so this is a pure presentation reorder). */
    displayOptions: GqQuestion["options"];
    questionIndex: number;
    answer: string[];
    submitted: boolean;
    correct: boolean;
    onToggle: (text: string) => void;
    onFreeText: (value: string) => void;
    pointsLabel: string;
    solutionLabel: string;
    inputLabel: string;
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
            data-testid={`graded-quiz-question-${questionIndex}`}
            data-verdict={verdict}
        >
            <p className="m-0 font-medium">
                <InlineMarkdown>{question.prompt}</InlineMarkdown>
                <span className="ml-2 text-sm text-[var(--fg-muted)]">({pointsLabel})</span>
            </p>

            {question.type === "multiple_choice" ? (
                <div className="flex flex-col gap-2">
                    {(displayOptions ?? []).map((option, optionIndex) => (
                        <label
                            key={optionIndex}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-base"
                        >
                            <input
                                type="checkbox"
                                className="size-5 accent-[var(--accent)]"
                                checked={answer.includes(option.text)}
                                disabled={submitted}
                                onChange={() => onToggle(option.text)}
                            />
                            <span>{option.text}</span>
                        </label>
                    ))}
                </div>
            ) : (
                <input
                    type="text"
                    value={answer[0] ?? ""}
                    disabled={submitted}
                    onChange={(changeEvent) => onFreeText(changeEvent.target.value)}
                    aria-label={inputLabel}
                    className="min-h-11 w-full rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-base"
                    data-testid={`graded-quiz-q${questionIndex}-input`}
                />
            )}

            {submitted && !correct && (
                <p className="m-0 text-sm text-[var(--fg-muted)]" data-testid={`graded-quiz-q${questionIndex}-solution`}>
                    {solutionLabel}
                    {": "}
                    <strong>{canonicalAnswer(question)}</strong>
                </p>
            )}
        </section>
    );
}

/** Post-check aggregate: points score, pass/fail, and the shared footer. */
function GradedQuizResult({
    submitted,
    passed,
    scoreLabel,
    showAnswerToggle,
    onAdvance,
    advanceLabel,
    controlled,
    canCheck,
    onCheck,
    onRetry,
    hasResult,
}: {
    submitted: boolean;
    passed: boolean;
    scoreLabel: string;
    showAnswerToggle: boolean;
    onAdvance?: () => void;
    advanceLabel?: string;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
    hasResult: boolean;
}) {
    const {t} = useI18n();
    return (
        <div className="flex flex-wrap items-center gap-2">
            {submitted && hasResult && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 inline-flex items-center gap-1 font-medium",
                            passed ? "is-correct text-[var(--success)]" : "is-wrong text-[var(--danger)]",
                        )}
                        data-testid="graded-quiz-result"
                        data-result={passed ? "passed" : "failed"}
                    >
                        {passed ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                        <span data-testid="graded-quiz-score">{scoreLabel}</span>
                        {" - "}
                        {passed
                            ? t("lesson.exercise.al_graded_quiz.passed", "Passed")
                            : t("lesson.exercise.al_graded_quiz.failed", "Not passed")}
                    </p>
                    {passed && showAnswerToggle && onAdvance && (
                        <ExerciseSuccessAdvance onAdvance={onAdvance} label={advanceLabel} testIdPrefix="graded-quiz" />
                    )}
                    <AnswerCelebration isCorrect={passed} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="graded-quiz"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t("lesson.exercise.al_graded_quiz.submit", "Submit quiz")}
                retryLabel={t("lesson.exercise.al_graded_quiz.retry", "Try again")}
            />
        </div>
    );
}

export default forwardRef(GradedQuizExercise);

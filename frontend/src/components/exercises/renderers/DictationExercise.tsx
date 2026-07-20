/**
 * DictationExercise (#1881, fifth adoption) — renderer for the adopted
 * extension type ``ext:al-dictation``: an audio clip the learner listens to,
 * then types the transcription.
 *
 * Reuses the shared building blocks rather than reinventing them:
 *   - {@link ListenFirstAudio} (#1600/#1687) plays ``ext_payload.audio`` via
 *     ``useAsset`` (path → cached blob URL) — the same player free_text and
 *     matching use for card audio.
 *   - {@link isFreeTextCorrect} / {@link isFreeTextNearMiss} from
 *     ``lib/exercises/grading/free-text-grading`` (#1877) grade the typed
 *     transcription, so it inherits the #1580 normalization + typo tolerance
 *     and the #627 "Almost!" near-miss feedback. No dictation-specific grader.
 *
 * After a wrong attempt the canonical transcription (``accept[0]``) is
 * surfaced — the same display contract as the sibling extension types.
 *
 * Result contract: ``onComplete({correct, total, attempts, raw_answer})`` with
 * ``total`` always 1 and ``raw_answer.kind === "al_dictation"``.
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {cn} from "@/lib/utils";
import {Input} from "@/components/ui/input";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import {deriveDictationAttempt} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {asDictationPayload, canonicalDictationAnswer} from "../../../lib/exercises/payload/dictation";
import {
    isFreeTextCorrect,
    isFreeTextNearMiss,
} from "../../../lib/exercises/grading/free-text-grading";
import type {ContentLessonExercise} from "../../../storage/types";
import ListenFirstAudio from "../shared/ListenFirstAudio";
import AnswerCelebration from "../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../feedback/ExerciseSuccessAdvance";
import ExerciseFooter from "../shell/ExerciseFooter";
import ExerciseHint from "../feedback/ExerciseHint";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../shell/exercise-control";

export interface DictationExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Content source slug ("owner/name") — threaded to {@link ListenFirstAudio}
     *  so ``useAsset`` resolves the clip from the right content cache. Empty on
     *  review/adaptive routes (audio-less fallback). */
    source?: string;
    onComplete: (result: ExerciseScored) => void;
}

function DictationExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        source = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        onAdvance,
        advanceLabel,
    }: DictationExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const payload = useMemo(() => asDictationPayload(exercise), [exercise]);
    const accept = payload?.accept ?? [];
    const canonical = canonicalDictationAnswer(exercise);

    const reviewedAnswer = reviewed?.kind === "al_dictation" ? reviewed : null;
    const [input, setInput] = useState<string>(reviewedAnswer?.input ?? "");

    const isInputCorrect = isFreeTextCorrect(input, accept);
    const canCheck = input.trim() !== "";

    const reviewedResult = reviewedAnswer
        ? {
              correct: isFreeTextCorrect(reviewedAnswer.input, accept) ? 1 : 0,
              total: 1,
          }
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: canCheck,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => ({
            correct: isInputCorrect ? 1 : 0,
            total: 1,
            attempts: [
                deriveDictationAttempt(exercise, {setId, lessonId}, input, isInputCorrect),
            ],
            raw_answer: {kind: "al_dictation", input},
        }),
        resetAnswer: () => setInput(""),
    });

    if (!payload) {
        return (
            <div data-testid="dictation-empty">
                {t(
                    "lesson.exercise.al_dictation.empty",
                    "This dictation exercise has no audio.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct === result.total;
    const nearMiss = submitted && !isCorrect && isFreeTextNearMiss(input, accept);

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="dictation-exercise"
        >
            {exercise.prompt && (
                <p className="m-0 font-medium" data-testid="dictation-prompt">
                    <InlineMarkdown>{exercise.prompt}</InlineMarkdown>
                </p>
            )}

            <ListenFirstAudio
                source={source}
                setId={setId}
                audioPath={payload.audio}
            />

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="dictation-hint-button"
            />

            <Input
                type="text"
                value={input}
                disabled={submitted}
                onChange={(changeEvent) => {
                    if (submitted) return;
                    setInput(changeEvent.target.value);
                }}
                aria-label={t(
                    "lesson.exercise.al_dictation.input_label",
                    "Type what you hear",
                )}
                placeholder={t(
                    "lesson.exercise.al_dictation.input_placeholder",
                    "Type what you hear…",
                )}
                data-testid="dictation-input"
            />

            <DictationResult
                submitted={submitted}
                isCorrect={isCorrect}
                nearMiss={nearMiss}
                canonical={canonical}
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

/** Post-check verdict (correct / "Almost!" near-miss / wrong), the canonical
 *  solution after a wrong attempt, and the shared celebration + check/retry
 *  footer. Split out to keep the renderer's complexity flat. */
function DictationResult({
    submitted,
    isCorrect,
    nearMiss,
    canonical,
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
    nearMiss: boolean;
    canonical: string;
    showAnswerToggle: boolean;
    onAdvance?: () => void;
    advanceLabel?: string;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
}) {
    const {t} = useI18n();
    const wrongLabel = nearMiss
        ? t(
              "lesson.exercise.al_dictation.result_near_miss",
              "Almost! Check your spelling.",
          )
        : t("lesson.exercise.al_dictation.result_wrong", "Not quite.");
    return (
        <>
            {submitted && (
                <p
                    className={cn(
                        "answer-feedback m-0 inline-flex items-center gap-1 font-medium",
                        isCorrect
                            ? "is-correct text-[var(--success)]"
                            : "is-wrong text-[var(--danger)]",
                    )}
                    data-testid="dictation-result"
                    data-result={isCorrect ? "correct" : "wrong"}
                >
                    {isCorrect ? (
                        <Check size={14} aria-hidden="true" />
                    ) : (
                        <X size={14} aria-hidden="true" />
                    )}
                    {isCorrect
                        ? t("lesson.exercise.al_dictation.result_correct", "Correct!")
                        : wrongLabel}
                </p>
            )}

            {submitted && !isCorrect && (
                <p
                    className="m-0 text-sm text-[var(--fg-muted)]"
                    data-testid="dictation-solution"
                >
                    {t("lesson.exercise.al_dictation.solution_label", "Solution")}
                    {": "}
                    <strong>{canonical}</strong>
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {submitted && <AnswerCelebration isCorrect={isCorrect} />}
                {submitted && isCorrect && showAnswerToggle && onAdvance && (
                    <ExerciseSuccessAdvance
                        onAdvance={onAdvance}
                        label={advanceLabel}
                        testIdPrefix="dictation"
                    />
                )}
                <ExerciseFooter
                    testidPrefix="dictation"
                    controlled={controlled}
                    submitted={submitted}
                    canCheck={canCheck}
                    onCheck={onCheck}
                    onRetry={onRetry}
                    checkLabel={t("lesson.exercise.al_dictation.submit", "Check answer")}
                    retryLabel={t("lesson.exercise.al_dictation.retry", "Try again")}
                />
            </div>
        </>
    );
}

export default forwardRef(DictationExercise);

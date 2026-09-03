/**
 * AudioChoiceExercise (engine#68 idea 1) — renderer for the adopted
 * extension type ``ext:al-audio-choice``: a gapped sentence shown as text,
 * with N audio-only options; the learner listens and picks the one that
 * fills the gap.
 *
 * Structurally the audio twin of {@link PictureChoiceExercise}: exactly one
 * option is correct, tapping a tile both plays its clip and selects it
 * (mirrors a typical listening-exercise UX — a second tap on the same tile
 * just replays). No text label on a tile by design (the payload carries
 * none — see ``lib/exercises/payload/audio-choice.ts``): a visible word
 * would spoil the exercise the same way alt-text would spoil an image one.
 *
 * Each option's audio resolves through the same asset chain
 * {@link ListenFirstAudio} uses (``useAsset`` for an ``assets/`` path, direct
 * playback for an embedded ``data:`` URI) — kept local to this file rather
 * than extracted, mirroring how ``PictureChoiceTile`` stays local to
 * ``PictureChoiceExercise.tsx``.
 */

import {Check, Volume2, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useEffect, useMemo, useRef, useState} from "react";

import {useAsset} from "../../../../hooks/ui/useAsset";
import {useI18n} from "../../../../hooks/ui/useI18n";
import {cn} from "@/lib/utils";
import InlineMarkdown from "../../../../shared/data-display/InlineMarkdown";
import {useControlledExercise} from "../../../../lib/exercises/useControlledExercise";
import {asAudioChoicePayload} from "../../../../lib/exercises/payload/audio-choice";
import {deriveAudioChoiceAttempt} from "../../../../lib/srs/element-attempt";
import ExercisePromptRow from "../../shell/ExercisePromptRow";
import ExerciseHint from "../../feedback/ExerciseHint";
import AnswerCelebration from "../../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../../feedback/ExerciseSuccessAdvance";
import ExerciseFooter from "../../shell/ExerciseFooter";
import type {ContentLessonExercise} from "../../../../storage/types";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
    RawAnswer,
} from "../../shell/exercise-control";

export interface AudioChoiceExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Content source slug ("owner/name") for asset lookup; empty on
     *  review/adaptive routes (each tile falls back to a disabled state). */
    source?: string;
    onComplete: (result: ExerciseScored) => void;
}

/** Reviewed-revisit score for a persisted audio-choice answer, or null when
 *  there is no reviewed answer. */
function audioChoiceReviewedResult(
    reviewedAudio: string | null | undefined,
    correctAudio: string,
): {correct: number; total: number} | null {
    if (reviewedAudio == null) return null;
    return {correct: reviewedAudio === correctAudio ? 1 : 0, total: 1};
}

/** Reviewed-state initialization for a persisted audio-choice answer: derives
 *  the initial selection plus the reviewed score, if any. Kept as its own
 *  hook so this branching lives in a scope of its own rather than inflating
 *  {@link AudioChoiceExercise}'s complexity. */
function useAudioChoiceReviewedState(reviewed: RawAnswer | null | undefined, correctAudio: string) {
    const reviewedChoice = reviewed?.kind === "al_audio_choice" ? reviewed : null;
    const [selectedAudio, setSelectedAudio] = useState<string | null>(
        reviewedChoice?.selected_audio ?? null,
    );
    const reviewedResult = audioChoiceReviewedResult(reviewedChoice?.selected_audio, correctAudio);
    return {selectedAudio, setSelectedAudio, reviewedResult};
}

function AudioChoiceExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        source = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        ttsLang = null,
        codeMode = false,
        onAdvance,
        advanceLabel,
    }: AudioChoiceExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const payload = useMemo(() => asAudioChoicePayload(exercise), [exercise]);
    const options = payload?.options ?? [];
    const correctAudio = options.find((o) => o.is_correct === "true")?.audio ?? "";

    const {selectedAudio, setSelectedAudio, reviewedResult} = useAudioChoiceReviewedState(
        reviewed,
        correctAudio,
    );

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: selectedAudio !== null,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const answer = selectedAudio ?? "";
            const isCorrect = answer !== "" && answer === correctAudio;
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveAudioChoiceAttempt(exercise, {setId, lessonId}, answer, isCorrect),
                ],
                raw_answer: {kind: "al_audio_choice", selected_audio: answer},
            };
        },
        resetAnswer: () => setSelectedAudio(null),
    });

    if (!payload) {
        return (
            <div data-testid="audio-choice-empty">
                {t(
                    "lesson.exercise.al_audio_choice.empty",
                    "This audio-choice exercise has no options.",
                )}
            </div>
        );
    }

    const isCorrect = !!result && result.correct > 0;

    return (
        <section className="flex flex-col gap-3" data-testid="audio-choice-exercise">
            <ExercisePromptRow
                prompt={exercise.prompt ?? ""}
                ttsLang={ttsLang}
                codeMode={codeMode}
                testId="audio-choice-prompt"
            />

            <p className="m-0 text-base" data-testid="audio-choice-sentence">
                <InlineMarkdown>{payload.sentence}</InlineMarkdown>
            </p>

            <ExerciseHint exercise={exercise} submitted={submitted} testId="audio-choice-hint-button" />

            <div className="flex flex-wrap gap-2" data-testid="audio-choice-options">
                {options.map((option, index) => (
                    <AudioOptionTile
                        key={option.audio || index}
                        index={index}
                        audioPath={option.audio}
                        source={source}
                        setId={setId}
                        isSelected={selectedAudio === option.audio}
                        submitted={submitted}
                        showAsCorrect={submitted && option.is_correct === "true"}
                        showAsWrong={submitted && selectedAudio === option.audio && option.is_correct !== "true"}
                        onSelect={() => {
                            if (submitted) return;
                            setSelectedAudio(option.audio);
                        }}
                    />
                ))}
            </div>

            <AudioChoiceResultPanel
                submitted={submitted}
                isCorrect={isCorrect}
                controlled={controlled}
                canCheck={selectedAudio !== null}
                onCheck={submit}
                onRetry={reset}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
            />
        </section>
    );
}

export default forwardRef(AudioChoiceExercise);

interface AudioChoiceResultPanelProps {
    submitted: boolean;
    isCorrect: boolean;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
    onAdvance?: () => void;
    advanceLabel?: string;
}

/** Feedback line, success-advance button and the check/retry footer - kept
 *  out of {@link AudioChoiceExercise} so its submitted-state branching lives
 *  in its own scope. */
function AudioChoiceResultPanel({
    submitted,
    isCorrect,
    controlled,
    canCheck,
    onCheck,
    onRetry,
    onAdvance,
    advanceLabel,
}: AudioChoiceResultPanelProps) {
    const {t} = useI18n();
    return (
        <div className="flex flex-wrap items-center gap-3">
            {submitted && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 font-semibold",
                            isCorrect
                                ? "is-correct text-[var(--exercise-correct)]"
                                : "is-wrong text-[var(--exercise-wrong)]",
                        )}
                        data-testid="audio-choice-result"
                        data-result={isCorrect ? "correct" : "wrong"}
                    >
                        {isCorrect
                            ? t("lesson.exercise.al_audio_choice.result_correct", "Correct!")
                            : t("lesson.exercise.al_audio_choice.result_wrong", "Not quite - listen again.")}
                    </p>
                    {isCorrect && onAdvance && (
                        <ExerciseSuccessAdvance
                            onAdvance={onAdvance}
                            label={advanceLabel}
                            testIdPrefix="audio-choice"
                        />
                    )}
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="audio-choice"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t("lesson.exercise.al_audio_choice.submit", "Check answer")}
                retryLabel={t("lesson.exercise.al_audio_choice.retry", "Try again")}
            />
        </div>
    );
}

interface AudioOptionTileProps {
    index: number;
    audioPath: string;
    source: string;
    setId: string;
    isSelected: boolean;
    submitted: boolean;
    showAsCorrect: boolean;
    showAsWrong: boolean;
    onSelect: () => void;
}

/** One audio-choice tile: a play/select button, owning its own asset
 *  resolution so the parent can stay a flat map() (rules-of-hooks). */
function AudioOptionTile({
    index,
    audioPath,
    source,
    setId,
    isSelected,
    submitted,
    showAsCorrect,
    showAsWrong,
    onSelect,
}: AudioOptionTileProps) {
    const {t} = useI18n();
    const isInline = audioPath.trim().startsWith("data:");
    const asset = useAsset(
        isInline ? null : source,
        isInline ? null : setId,
        isInline ? null : audioPath,
    );
    const url = isInline ? audioPath.trim() : asset.url;
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        return () => {
            audioRef.current?.pause();
            audioRef.current = null;
        };
    }, [url]);

    const handleClick = () => {
        onSelect();
        if (!url) return;
        if (!audioRef.current) audioRef.current = new Audio(url);
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
    };

    return (
        <button
            type="button"
            className={cn(
                "relative inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)] enabled:hover:bg-[var(--surface-2)]",
                isSelected &&
                    "is-selected border-[var(--exercise-selected)] bg-[color-mix(in_srgb,var(--exercise-selected)_12%,var(--surface))]",
                showAsCorrect &&
                    "is-correct border-[var(--exercise-correct)] bg-[color-mix(in_srgb,var(--exercise-correct)_18%,var(--surface))]",
                showAsWrong &&
                    "is-wrong border-[var(--exercise-wrong)] bg-[color-mix(in_srgb,var(--exercise-wrong)_12%,var(--surface))]",
            )}
            onClick={handleClick}
            aria-pressed={isSelected}
            disabled={submitted}
            data-testid={`audio-choice-option-${index}`}
            data-correct={showAsCorrect ? "true" : undefined}
            aria-label={`${t("lesson.exercise.al_audio_choice.option_aria", "Play option")} ${index + 1}`}
        >
            <Volume2 size={16} aria-hidden="true" />
            {index + 1}
            {showAsCorrect && <Check size={14} aria-hidden="true" />}
            {showAsWrong && <X size={14} aria-hidden="true" />}
        </button>
    );
}

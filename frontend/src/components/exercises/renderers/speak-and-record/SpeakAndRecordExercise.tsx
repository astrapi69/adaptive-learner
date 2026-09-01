/**
 * SpeakAndRecordExercise (engine#68 idea 3) - renderer for the adopted
 * extension type ``ext:al-speak-and-record``: a speaker button reads a
 * sentence, a "show" button reveals its text, a "record" button lets the
 * learner record and play back their own voice.
 *
 * Deliberately UNGRADED, unlike every other renderer this dispatcher
 * mounts: there is nothing to check a recording against, so ``score()``
 * returns an empty ``attempts`` array - ``LessonStepView``'s existing
 * guard (only calls ``elementErrors.recordBulk`` when ``attempts.length >
 * 0``) naturally skips writing an SRS row, the same escape hatch every
 * other ungraded activity (a theory step) already relies on. This reuses
 * the standard controlled/``onComplete`` step-advance flow rather than
 * inventing a parallel non-exercise step type.
 *
 * The clip itself is genuinely new infrastructure (no prior
 * MediaRecorder/getUserMedia usage in this app): captured by
 * {@link RecordButton}, persisted through ``getStorage().speechRecordings``
 * (base64-in-a-column, mirroring ``UserSettings.avatar`` - no
 * multipart/file-upload endpoint exists) so a re-visited step plays back
 * the learner's own prior recording, and re-recording simply overwrites
 * it (no history).
 */

import {Mic} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useEffect, useMemo, useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import InlineMarkdown from "../../../../shared/data-display/InlineMarkdown";
import {useControlledExercise} from "../../../../lib/exercises/useControlledExercise";
import {asSpeakAndRecordPayload} from "../../../../lib/exercises/payload/speak-and-record";
import {blobToBase64} from "../../../../lib/voice/audio-recording";
import {readLearnerState} from "../../../../lib/learning/learnerState";
import {getStorage} from "../../../../storage";
import type {ContentLessonExercise} from "../../../../storage/types";
import SpeechButton from "../../../voice/SpeechButton";
import RecordButton from "../../../voice/RecordButton";
import ListenFirstAudio from "../../shared/ListenFirstAudio";
import ExerciseSuccessAdvance from "../../feedback/ExerciseSuccessAdvance";
import ExerciseFooter from "../../shell/ExerciseFooter";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../../shell/exercise-control";

export interface SpeakAndRecordExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Content source slug ("owner/name") - threaded to {@link ListenFirstAudio}
     *  for an authored reference clip, and used as the storage key for the
     *  learner's own recording. Empty on review/adaptive routes. */
    source?: string;
    onComplete: (result: ExerciseScored) => void;
}

function SpeakAndRecordExercise(
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
    }: SpeakAndRecordExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const payload = useMemo(() => asSpeakAndRecordPayload(exercise), [exercise]);

    const [revealed, setRevealed] = useState(false);
    const [clipUrl, setClipUrl] = useState<string | null>(null);
    const [hasClip, setHasClip] = useState(reviewed?.kind === "al_speak_and_record");
    const [saving, setSaving] = useState(false);
    // #2841 - true when no row exists AND it was removed for storage-cap
    // reasons (not simply "never recorded"), so the empty state explains
    // itself instead of looking like the recording never happened.
    const [wasEvicted, setWasEvicted] = useState(false);

    const userId = readLearnerState().userId;

    // Load a previously-saved clip (if any) so a revisited step plays
    // back what the learner already recorded, instead of appearing empty.
    useEffect(() => {
        let cancelled = false;
        if (!userId) return;
        const storage = getStorage();
        storage.speechRecordings
            .get(userId, source, setId, lessonId, exercise.id)
            .then((row) => {
                if (cancelled) return;
                if (row) {
                    setClipUrl(`data:${row.mime_type};base64,${row.audio_base64}`);
                    setHasClip(true);
                    return;
                }
                storage.speechRecordings
                    .wasEvicted(userId, source, setId, lessonId, exercise.id)
                    .then((evicted) => {
                        if (!cancelled) setWasEvicted(evicted);
                    })
                    .catch(() => {
                        /* not evicted, or evicted-check unavailable - stay silent */
                    });
            })
            .catch(() => {
                /* no prior recording - the record button starts empty */
            });
        return () => {
            cancelled = true;
        };
    }, [userId, source, setId, lessonId, exercise.id]);

    const reviewedResult = reviewed?.kind === "al_speak_and_record" ? {correct: 1, total: 1} : null;

    const {submitted, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: hasClip,
        onInteraction,
        onComplete,
        reviewedResult,
        // Ungraded by design: an empty attempts array so no SRS/
        // ElementError row is written, mirroring the app's existing
        // "empty attempts = no grading" escape hatch.
        score: (): ExerciseScored => ({
            correct: 1,
            total: 1,
            attempts: [],
            raw_answer: {kind: "al_speak_and_record", recorded: hasClip},
        }),
        resetAnswer: () => {
            setClipUrl(null);
            setHasClip(false);
            setRevealed(false);
        },
    });

    if (!payload) {
        return (
            <div data-testid="speak-and-record-empty">
                {t(
                    "lesson.exercise.al_speak_and_record.empty",
                    "This speak-and-record exercise has no sentence.",
                )}
            </div>
        );
    }

    const onRecorded = async (clip: {blob: Blob; mimeType: string; durationMs: number}) => {
        const url = URL.createObjectURL(clip.blob);
        setClipUrl(url);
        setHasClip(true);
        setWasEvicted(false);
        if (!userId) return;
        setSaving(true);
        try {
            const audioBase64 = await blobToBase64(clip.blob);
            await getStorage().speechRecordings.save(userId, {
                source,
                set_id: setId,
                lesson_filename: lessonId,
                exercise_id: exercise.id,
                audio_base64: audioBase64,
                mime_type: clip.mimeType,
                duration_ms: clip.durationMs,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="speak-and-record-exercise"
        >
            {exercise.prompt && (
                <p className="m-0 font-medium" data-testid="speak-and-record-prompt">
                    <InlineMarkdown>{exercise.prompt}</InlineMarkdown>
                </p>
            )}

            {payload.audio ? (
                <ListenFirstAudio source={source} setId={setId} audioPath={payload.audio} />
            ) : (
                <SpeechButton text={payload.sentence} testId="speak-and-record" />
            )}

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    className="rounded-[6px] border border-border bg-transparent px-2.5 py-1 text-[0.85rem] text-fg-muted transition-colors duration-150 hover:bg-bg-elevated hover:text-fg-primary"
                    data-testid="speak-and-record-show"
                    onClick={() => setRevealed(true)}
                    disabled={revealed}
                >
                    {t("lesson.exercise.al_speak_and_record.show", "Show text")}
                </button>
                {revealed && (
                    <p className="m-0" data-testid="speak-and-record-sentence">
                        <InlineMarkdown>{payload.sentence}</InlineMarkdown>
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <RecordButton
                    onRecorded={(clip) => {
                        void onRecorded(clip);
                    }}
                    testId="speak-and-record"
                />
                {saving && (
                    <span className="text-[0.85rem] text-fg-muted" data-testid="speak-and-record-saving">
                        <Mic size={14} aria-hidden="true" className="inline" />{" "}
                        {t("lesson.exercise.al_speak_and_record.saving", "Saving…")}
                    </span>
                )}
            </div>

            {wasEvicted && !hasClip && (
                <p
                    className="m-0 text-[0.85rem] text-fg-muted"
                    data-testid="speak-and-record-evicted"
                >
                    {t(
                        "lesson.exercise.al_speak_and_record.recording_evicted",
                        "Your previous recording was removed to save storage space. Record again anytime.",
                    )}
                </p>
            )}

            {clipUrl && (
                <audio
                    controls
                    src={clipUrl}
                    data-testid="speak-and-record-playback"
                />
            )}

            <div className="flex flex-wrap items-center gap-2">
                {submitted && onAdvance ? (
                    <ExerciseSuccessAdvance
                        onAdvance={onAdvance}
                        label={advanceLabel}
                        testIdPrefix="speak-and-record"
                    />
                ) : (
                    <ExerciseFooter
                        testidPrefix="speak-and-record"
                        controlled={controlled}
                        submitted={submitted}
                        canCheck={hasClip}
                        onCheck={submit}
                        onRetry={reset}
                        checkLabel={t("lesson.exercise.al_speak_and_record.done", "Done")}
                        retryLabel={t("lesson.exercise.al_speak_and_record.record_again", "Record again")}
                    />
                )}
            </div>
        </section>
    );
}

export default forwardRef(SpeakAndRecordExercise);

/**
 * ImageDescriptionExercise (#2095, sixth adoption) — renderer for the adopted
 * extension type ``ext:al-image-description``: the learner sees an image, then
 * types a free-text description.
 *
 * Reuses the shared building blocks rather than reinventing them:
 *   - {@link isFreeTextCorrect} / {@link isFreeTextNearMiss} from
 *     ``lib/exercises/grading/free-text-grading`` grade the typed answer, so it
 *     inherits the normalization + typo tolerance and the "Almost!" near-miss
 *     feedback. No image-specific grader (Reusability-Policy).
 *   - {@link useAsset} resolves an ``assets/`` image path to a cached blob URL,
 *     the same lookup PictureChoice uses; an embedded ``data:`` URI is
 *     self-contained and bypasses the asset layer.
 *
 * Accessibility (honest, #2095): the answer IS the image description, so a
 * meaningful ``alt`` would leak the solution — this type is, by design, not
 * solvable by a blind learner. Rather than hide that behind an empty ``alt``,
 * the image carries a neutral label that names the element (an image whose
 * description is the answer) WITHOUT revealing it. The input is labeled and the
 * focus order is source-order correct.
 *
 * After a wrong attempt the canonical answer (``accept[0]``) is surfaced — the
 * same display contract as the sibling extension types.
 *
 * Result contract: ``onComplete({correct, total, attempts, raw_answer})`` with
 * ``total`` always 1 and ``raw_answer.kind === "al_image_description"``.
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {useAsset} from "../../../hooks/ui/useAsset";
import {cn} from "@/lib/utils";
import {Input} from "@/components/ui/input";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import ReadAloudButton from "../../lesson/tts/ReadAloudButton";
import {deriveImageDescriptionAttempt} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {
    asImageDescriptionPayload,
    canonicalImageDescriptionAnswer,
    isRemoteImageUrl,
} from "../../../lib/exercises/payload/image-description";
import {
    isFreeTextCorrect,
    isFreeTextNearMiss,
} from "../../../lib/exercises/grading/free-text-grading";
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

export interface ImageDescriptionExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Content source slug ("owner/name") — used to resolve an ``assets/``
     *  image path via {@link useAsset}. Empty on review/adaptive routes (an
     *  embedded data URI still renders; an asset path falls back to no image). */
    source?: string;
    onComplete: (result: ExerciseScored) => void;
}

/** Strip the ``assets/`` prefix so the resolver key matches the storage
 *  layer's manifest-relative form. Idempotent. */
function _normalizeAssetPath(raw: string): string {
    return raw.startsWith("assets/") ? raw.slice("assets/".length) : raw;
}

/** Reconstruct the locked review state from a persisted answer: the initial
 *  input to restore and the pre-computed verdict (or null when not reviewed).
 *  Extracted so the main component stays flat. */
function reviewedImageState(
    reviewed: ImageDescriptionExerciseProps["reviewed"],
    accept: string[],
): {initialInput: string; reviewedResult: {correct: number; total: number} | null} {
    const reviewedAnswer =
        reviewed?.kind === "al_image_description" ? reviewed : null;
    if (!reviewedAnswer) return {initialInput: "", reviewedResult: null};
    return {
        initialInput: reviewedAnswer.input,
        reviewedResult: {
            correct: isFreeTextCorrect(reviewedAnswer.input, accept) ? 1 : 0,
            total: 1,
        },
    };
}

function ImageDescriptionExercise(
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
    }: ImageDescriptionExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const payload = useMemo(() => asImageDescriptionPayload(exercise), [exercise]);
    const accept = payload?.accept ?? [];
    const canonical = canonicalImageDescriptionAnswer(exercise);

    const {initialInput, reviewedResult} = reviewedImageState(reviewed, accept);
    const [input, setInput] = useState<string>(initialInput);

    const isInputCorrect = isFreeTextCorrect(input, accept);
    const canCheck = input.trim() !== "";

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
                deriveImageDescriptionAttempt(
                    exercise,
                    {setId, lessonId},
                    input,
                    isInputCorrect,
                ),
            ],
            raw_answer: {kind: "al_image_description", input},
        }),
        resetAnswer: () => setInput(""),
    });

    if (!payload) {
        return (
            <div data-testid="image-description-empty">
                {t(
                    "lesson.exercise.al_image_description.empty",
                    "This image-description exercise has no image.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct === result.total;
    const nearMiss =
        submitted && !isCorrect && isFreeTextNearMiss(input, accept);

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="image-description-exercise"
        >
            <ImageDescriptionPrompt
                prompt={exercise.prompt}
                ttsLang={ttsLang}
                codeMode={codeMode}
            />

            <ImageStimulus image={payload.image} source={source} setId={setId} />

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="image-description-hint-button"
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
                    "lesson.exercise.al_image_description.input_label",
                    "Describe the image",
                )}
                placeholder={t(
                    "lesson.exercise.al_image_description.input_placeholder",
                    "Type your description…",
                )}
                data-testid="image-description-input"
            />

            <ImageDescriptionResult
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

/** The prompt row: the instruction plus (when a ``ttsLang`` is supplied and
 *  the content is not code) a read-aloud speaker button. The button reads the
 *  INSTRUCTION, never the answer (the answer is the image). Extracted so the
 *  main component stays flat. */
function ImageDescriptionPrompt({
    prompt,
    ttsLang,
    codeMode,
}: {
    prompt: string;
    ttsLang: string | null;
    codeMode: boolean;
}) {
    if (!prompt) return null;
    return (
        <div className="exercise-prompt-row">
            <p
                className="m-0 flex-auto font-medium"
                data-testid="image-description-prompt"
            >
                <InlineMarkdown>{prompt}</InlineMarkdown>
            </p>
            {ttsLang && !codeMode && (
                <ReadAloudButton
                    text={prompt}
                    lang={ttsLang}
                    testId="image-description-prompt"
                />
            )}
        </div>
    );
}

/** The image the learner must describe. A ``data:`` URI is self-contained and
 *  rendered directly; an ``assets/`` path is resolved to a cached blob URL via
 *  {@link useAsset}. A remote URL is never rendered (offline-first). The alt
 *  names the element WITHOUT revealing the answer (a11y, #2095). */
function ImageStimulus({
    image,
    source,
    setId,
}: {
    image: string;
    source: string;
    setId: string;
}) {
    const {t} = useI18n();
    const isDataUri = image.trim().startsWith("data:");
    const isRemote = isRemoteImageUrl(image);
    const normalized = _normalizeAssetPath(image);
    // Data URIs are self-contained; remote URLs are unsupported — only an
    // ``assets/`` path goes through the storage lookup.
    const enabled = Boolean(
        !isDataUri && !isRemote && source && setId && normalized,
    );
    const asset = useAsset(
        enabled ? source : null,
        enabled ? setId : null,
        enabled ? normalized : null,
    );

    const src = isDataUri ? image : isRemote ? null : asset.url;
    const altText = t(
        "lesson.exercise.al_image_description.image_alt",
        "Image to describe — its description is the answer to type below",
    );

    if (src === null) {
        return (
            <div
                className="rounded-md border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--fg-muted)]"
                data-testid="image-description-image-missing"
            >
                {t(
                    "lesson.exercise.al_image_description.image_unavailable",
                    "The image is unavailable here.",
                )}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={altText}
            loading="lazy"
            className="max-h-72 w-full rounded-md border border-border object-contain"
            data-testid="image-description-image"
        />
    );
}

/** Post-check verdict (correct / "Almost!" near-miss / wrong), the canonical
 *  solution after a wrong attempt, and the shared celebration + check/retry
 *  footer. Split out to keep the renderer's complexity flat. */
function ImageDescriptionResult({
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
              "lesson.exercise.al_image_description.result_near_miss",
              "Almost! Check your spelling.",
          )
        : t("lesson.exercise.al_image_description.result_wrong", "Not quite.");
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
                    data-testid="image-description-result"
                    data-result={isCorrect ? "correct" : "wrong"}
                >
                    {isCorrect ? (
                        <Check size={14} aria-hidden="true" />
                    ) : (
                        <X size={14} aria-hidden="true" />
                    )}
                    {isCorrect
                        ? t(
                              "lesson.exercise.al_image_description.result_correct",
                              "Correct!",
                          )
                        : wrongLabel}
                </p>
            )}

            {submitted && !isCorrect && (
                <p
                    className="m-0 text-sm text-[var(--fg-muted)]"
                    data-testid="image-description-solution"
                >
                    {t(
                        "lesson.exercise.al_image_description.solution_label",
                        "Solution",
                    )}
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
                        testIdPrefix="image-description"
                    />
                )}
                <ExerciseFooter
                    testidPrefix="image-description"
                    controlled={controlled}
                    submitted={submitted}
                    canCheck={canCheck}
                    onCheck={onCheck}
                    onRetry={onRetry}
                    checkLabel={t(
                        "lesson.exercise.al_image_description.submit",
                        "Check answer",
                    )}
                    retryLabel={t(
                        "lesson.exercise.al_image_description.retry",
                        "Try again",
                    )}
                />
            </div>
        </>
    );
}

export default forwardRef(ImageDescriptionExercise);

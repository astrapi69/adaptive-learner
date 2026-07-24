/**
 * PictureChoiceExercise (Phase 44 / EXP-002 / 3D — F-107;
 * Phase 54C / v1.37.0 — real image support).
 *
 * "Pick the image" exercise. The lesson schema's
 * ``Exercise.images`` is a list of ``{src, label, is_correct?}``;
 * exactly one entry has ``is_correct: "true"``. The component
 * renders each image as a tap target; submit reports
 * ``{correct: 0|1, total: 1}`` to the parent.
 *
 * Image-resolution chain (Phase 54C):
 *   1. ``useAsset(source, setId, assetPath)`` looks up the
 *      cached blob from the storage layer. Hit → render
 *      ``<img>`` with the object URL. Loading → skeleton.
 *      Miss/error → step 2.
 *   2. If the parent supplied a ``resolveImageSrc`` callback
 *      (legacy v1.28.0 path), call it with the raw ``src``.
 *      A non-empty return becomes the ``<img>`` src.
 *   3. Otherwise: text-only fallback — the choice label
 *      remains the entire tap target. The exercise stays
 *      playable since each image carries a textual label.
 *
 * Mobile-first: 2-column grid on narrow viewports, 4-column
 * on wide ones. Each tile is a 44px+ touch target.
 *
 * Source threading: the parent (ExerciseDispatcher → Lesson
 * page) passes ``source`` so useAsset can target the right
 * content repo's cache. Review / AdaptiveLesson pages pass
 * an empty string; the asset resolver returns null
 * gracefully → text-only fallback. Future work could thread
 * source through the review/adaptive routes too.
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";

import {useAsset} from "../../../hooks/ui/useAsset";
import {useI18n} from "../../../hooks/ui/useI18n";
import {
    useKeyboardShortcuts,
    type ShortcutDefinition,
} from "../../../shared/hooks/useKeyboardShortcuts";
import {cn} from "@/lib/utils";
import ReadAloudButton from "../../lesson/tts/ReadAloudButton";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import ExerciseHint from "../feedback/ExerciseHint";
import {generatePlaceholderSvg} from "../../../lib/content/media/placeholder-svg";
import {derivePictureChoiceAttempt} from "../../../lib/srs/element-attempt";
import type {ContentLessonExercise} from "../../../storage/types";
import AnswerCelebration from "../feedback/AnswerCelebration";
import DirectionInstruction from "../feedback/DirectionInstruction";
import ExerciseFooter from "../shell/ExerciseFooter";
import ExerciseSuccessAdvance from "../feedback/ExerciseSuccessAdvance";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../shell/exercise-control";

export interface PictureChoiceExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    /** Phase 46B context for the element-attempt deriver.
     *  Optional in unit tests; required in production. */
    setId?: string;
    lessonId?: string;
    /** Phase 54C / v1.37.0 — source slug ("owner/name") for
     *  asset lookup. When empty, useAsset returns ``error:
     *  true`` and every tile falls back to text-only. */
    source?: string;
    /** Called on submit with the score (0 or 1 correct of 1
     *  total) plus the single-attempt SRS payload. */
    onComplete: (result: ExerciseScored) => void;
    /** Optional base path the parent prepends to each image
     *  ``src``. When absent the component uses the asset
     *  resolver alone; when present, the resolver's null
     *  case falls through to the callback before text-only
     *  fallback. Legacy v1.28.0 hook kept for compatibility
     *  with tests + ad-hoc lesson previews. */
    resolveImageSrc?: (rawSrc: string) => string;
}

interface Choice {
    index: number;
    src: string;
    label: string;
    isCorrect: boolean;
}

function _parseChoices(
    images: ContentLessonExercise["images"] | undefined,
): Choice[] {
    if (!images) return [];
    return images.map((img, i) => ({
        index: i,
        src: img.src,
        label: img.label,
        isCorrect: img.is_correct === "true",
    }));
}

/** Strip the ``assets/`` prefix from a lesson-authored path
 *  so the resolver key matches the storage layer's
 *  manifest-relative form. Idempotent on already-stripped
 *  paths. */
function _normalizeAssetPath(raw: string): string {
    if (raw.startsWith("assets/")) return raw.slice("assets/".length);
    return raw;
}

type Translate = (key: string, fallback?: string) => string;

/** The reviewed-revisit score for a persisted picture choice, or null
 *  when there is no reviewed answer. */
function pictureReviewedResult(
    reviewedSelected: number | null | undefined,
    choices: Choice[],
): {correct: number; total: number} | null {
    if (reviewedSelected == null) return null;
    return {
        correct: choices[reviewedSelected]?.isCorrect ? 1 : 0,
        total: 1,
    };
}

/** Correct/wrong feedback + celebration + the shared exercise footer. */
function PictureResult({
    submitted,
    isCorrect,
    controlled,
    canCheck,
    onCheck,
    onRetry,
    onAdvance,
    advanceLabel,
    t,
}: {
    submitted: boolean;
    isCorrect: boolean;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
    onAdvance?: () => void;
    advanceLabel?: string;
    t: Translate;
}) {
    const {showAnswerToggle} = useLessonMode();
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
                        data-testid="picture-result"
                        data-result={isCorrect ? "correct" : "wrong"}
                    >
                        {isCorrect
                            ? t("lesson.exercise.picture.result_correct", "Correct!")
                            : t(
                                  "lesson.exercise.picture.result_wrong",
                                  "Not quite - the highlighted tile is the right answer.",
                              )}
                    </p>
                    {isCorrect && showAnswerToggle && onAdvance && (
                        <ExerciseSuccessAdvance
                            onAdvance={onAdvance}
                            label={advanceLabel}
                            testIdPrefix="picture"
                        />
                    )}
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="picture"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t("lesson.exercise.picture.submit", "Check answer")}
                retryLabel={t("lesson.exercise.picture.retry", "Try again")}
            />
        </div>
    );
}

/** Resolve a tile's image source through the Phase-54D chain: inline
 *  data URI (self-contained, engine schema 1.8) → authored asset bytes →
 *  legacy resolver callback → placeholder SVG → text-only
 *  (``imgSrc === null``). ``isPlaceholder`` flags the SVG case. */
function resolvePictureSrc(
    asset: {url: string | null; loading: boolean},
    imgFailed: boolean,
    legacyResolveSrc: ((rawSrc: string) => string) | undefined,
    choice: Choice,
): {imgSrc: string | null; isPlaceholder: boolean} {
    let imgSrc: string | null = null;
    if (choice.src.startsWith("data:") && !imgFailed) {
        imgSrc = choice.src;
    } else if (asset.url && !imgFailed) {
        imgSrc = asset.url;
    } else if (legacyResolveSrc && !imgFailed) {
        const resolved = legacyResolveSrc(choice.src);
        if (resolved && resolved !== choice.src) imgSrc = resolved;
    }
    // Last-mile placeholder: only when both branches missed AND the asset
    // resolver isn't loading (don't flash a placeholder over a still-
    // loading real image).
    if (imgSrc === null && !asset.loading && !imgFailed) {
        return {imgSrc: generatePlaceholderSvg(choice.label), isPlaceholder: true};
    }
    return {imgSrc, isPlaceholder: false};
}

/** Class list for an image-choice tile, by selection + grading + render
 *  state. */
function pictureTileClassName(states: {
    isSelected: boolean;
    showAsCorrect: boolean;
    showAsWrong: boolean;
    useTextFallback: boolean;
    isLoading: boolean;
    isPlaceholder: boolean;
}): string {
    return cn(
        // #762 — h-full (not a hardcoded min-height) so every tile fills
        // its grid cell; combined with the grid's `[grid-auto-rows:1fr]`
        // all tiles in a row match the tallest while text still wraps.
        "relative flex h-full min-h-[88px] w-full cursor-pointer flex-col items-center gap-1.5 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-center text-sm text-[var(--fg)] enabled:hover:bg-[var(--surface-2)]",
        states.isSelected &&
            "is-selected border-[var(--exercise-selected)] bg-[color-mix(in_srgb,var(--exercise-selected)_12%,var(--surface))]",
        states.showAsCorrect &&
            "is-correct border-[var(--exercise-correct)] bg-[color-mix(in_srgb,var(--exercise-correct)_18%,var(--surface))]",
        states.showAsWrong &&
            "is-wrong border-[var(--exercise-wrong)] bg-[color-mix(in_srgb,var(--exercise-wrong)_12%,var(--surface))]",
        states.useTextFallback && "is-text-fallback justify-center",
        states.isLoading && "is-loading",
        states.isPlaceholder && "is-placeholder",
    );
}

function PictureChoiceExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        source = "",
        onComplete,
        resolveImageSrc,
        controlled = false,
        onInteraction,
        reviewed = null,
        ttsLang = null,
        codeMode = false,
        onAdvance,
        advanceLabel,
    }: PictureChoiceExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const choices = useMemo(() => _parseChoices(exercise.images), [exercise.images]);
    const reviewedPicture =
        reviewed?.kind === "picture_choice" ? reviewed : null;

    const [selected, setSelected] = useState<number | null>(
        reviewedPicture?.selected ?? null,
    );

    const reviewedResult = pictureReviewedResult(
        reviewedPicture?.selected,
        choices,
    );

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: selected !== null,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            // The hook only calls score() when isAnswerable (selected !== null).
            const index = selected ?? 0;
            return {
                correct: choices[index].isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    derivePictureChoiceAttempt(
                        exercise,
                        {setId, lessonId},
                        index,
                    ),
                ],
                raw_answer: {kind: "picture_choice", selected: index},
            };
        },
        resetAnswer: () => setSelected(null),
    });

    const handleSelect = (index: number) => {
        if (submitted) return;
        setSelected(index);
    };

    // Lesson shortcut: number keys 1..9 pick the Nth displayed choice
    // (disabled once the answer is submitted). See the shortcut help
    // overlay (``?``) for the full catalogue.
    const numberShortcuts = useMemo<ShortcutDefinition[]>(
        () =>
            choices.slice(0, 9).map((choice, position) => ({
                id: `picture-choice-${choice.index}`,
                key: String(position + 1),
                context: "lesson",
                description: "Select an answer option",
                action: () => handleSelect(choice.index),
            })),
        // handleSelect closes over `submitted`; it early-returns after
        // submit, and the hook is also disabled below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [choices],
    );
    useKeyboardShortcuts(numberShortcuts, {enabled: !submitted});

    if (choices.length === 0) {
        return (
            <div data-testid="picture-empty">
                {t(
                    "lesson.exercise.picture.empty",
                    "This picture-choice exercise has no images.",
                )}
            </div>
        );
    }

    const isCorrect = !!result && result.correct > 0;

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="picture-exercise"
        >
            <div className="exercise-prompt-row">
                <p
                    className="m-0 flex-auto font-medium"
                    data-testid="picture-prompt"
                >
                    <InlineMarkdown>{exercise.prompt ?? ""}</InlineMarkdown>
                </p>
                {ttsLang && !codeMode && (
                    <ReadAloudButton
                        text={exercise.prompt ?? ""}
                        lang={ttsLang}
                        testId="picture-prompt"
                    />
                )}
            </div>

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="picture-hint-button"
            />

            <DirectionInstruction exercise={exercise} />

            <ul
                className="m-0 grid list-none grid-cols-2 gap-2 p-0 [grid-auto-rows:1fr] min-[600px]:grid-cols-4"
                data-testid="picture-grid"
                aria-label={t(
                    "lesson.exercise.picture.grid_label",
                    "Image choices",
                )}
            >
                {choices.map((choice) => (
                    <li key={choice.index}>
                        <PictureChoiceTile
                            choice={choice}
                            source={source}
                            setId={setId}
                            isSelected={selected === choice.index}
                            submitted={submitted}
                            onSelect={() => handleSelect(choice.index)}
                            legacyResolveSrc={resolveImageSrc}
                        />
                    </li>
                ))}
            </ul>

            <PictureResult
                submitted={submitted}
                isCorrect={isCorrect}
                controlled={controlled}
                canCheck={selected !== null}
                onCheck={submit}
                onRetry={reset}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
                t={t}
            />
        </section>
    );
}

export default forwardRef(PictureChoiceExercise);

interface PictureChoiceTileProps {
    choice: Choice;
    source: string;
    setId: string;
    isSelected: boolean;
    submitted: boolean;
    onSelect: () => void;
    legacyResolveSrc?: (rawSrc: string) => string;
}

/** One image-choice tile. Owns its own useAsset call so the
 *  parent can stay a flat map() over choices without breaking
 *  the rules-of-hooks ("hooks must be called at the top level
 *  of a component, not inside a loop or condition"). */
function PictureChoiceTile({
    choice,
    source,
    setId,
    isSelected,
    submitted,
    onSelect,
    legacyResolveSrc,
}: PictureChoiceTileProps) {
    const {t} = useI18n();
    const normalized = _normalizeAssetPath(choice.src);
    // Inline data URIs (engine schema 1.8) are self-contained - never
    // send them through the storage asset lookup.
    const enabled = Boolean(
        source && setId && normalized && !choice.src.startsWith("data:"),
    );
    const asset = useAsset(
        enabled ? source : null,
        enabled ? setId : null,
        enabled ? normalized : null,
    );
    // Local <img> error fallback covers the case where the
    // resolver gave us a URL but the actual image bytes are
    // corrupt / unsupported. Same flag as v1.28.0.
    const [imgFailed, setImgFailed] = useState(false);

    const {imgSrc, isPlaceholder} = resolvePictureSrc(
        asset,
        imgFailed,
        legacyResolveSrc,
        choice,
    );

    const showAsCorrect = submitted && choice.isCorrect;
    const showAsWrong = submitted && isSelected && !choice.isCorrect;
    const useTextFallback = imgSrc === null && !asset.loading;
    const isLoading = asset.loading && imgSrc === null;

    return (
        <button
            type="button"
            className={pictureTileClassName({
                isSelected,
                showAsCorrect,
                showAsWrong,
                useTextFallback,
                isLoading,
                isPlaceholder,
            })}
            onClick={onSelect}
            aria-pressed={isSelected}
            disabled={submitted}
            data-testid={`picture-choice-${choice.index}`}
            data-correct={choice.isCorrect ? "true" : "false"}
        >
            {isLoading ? (
                <span
                    className="picture-tile-skeleton"
                    data-testid={`picture-tile-skeleton-${choice.index}`}
                    aria-hidden="true"
                />
            ) : useTextFallback ? (
                <span className="text-base font-semibold">
                    <InlineMarkdown>{choice.label}</InlineMarkdown>
                </span>
            ) : (
                <img
                    className="aspect-square h-auto w-full rounded-sm object-cover"
                    src={imgSrc as string}
                    alt={choice.label}
                    onError={() => setImgFailed(true)}
                    loading="lazy"
                    /* Phase 54G — intrinsic dimensions match
                     * the placeholder SVG viewBox (100×100) so
                     * the browser reserves the tile's box
                     * BEFORE the image loads. CSS responsively
                     * scales via max-width / max-height; the
                     * width attribute is the layout-stability
                     * hint, not the final render size. */
                    width={100}
                    height={100}
                />
            )}
            <span className="leading-[1.3]">
                <InlineMarkdown>{choice.label}</InlineMarkdown>
            </span>
            {showAsCorrect && (
                <span
                    className="absolute right-1.5 top-1.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border bg-[var(--surface)] text-[var(--exercise-correct)]"
                    aria-label={t(
                        "lesson.exercise.picture.correct_label",
                        "Correct",
                    )}
                >
                    <Check size={14} aria-hidden="true" />
                </span>
            )}
            {showAsWrong && (
                <span
                    className="absolute right-1.5 top-1.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border bg-[var(--surface)] text-[var(--exercise-wrong)]"
                    aria-label={t(
                        "lesson.exercise.picture.wrong_label",
                        "Wrong",
                    )}
                >
                    <X size={14} aria-hidden="true" />
                </span>
            )}
        </button>
    );
}

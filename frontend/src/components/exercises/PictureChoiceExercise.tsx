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

import {Check, RotateCcw, X} from "lucide-react";
import {useMemo, useState} from "react";

import {useAsset} from "../../hooks/useAsset";
import {useI18n} from "../../hooks/useI18n";
import {generatePlaceholderSvg} from "../../lib/content/placeholder-svg";
import {derivePictureChoiceAttempt} from "../../lib/element-attempt";
import type {
    ContentLessonExercise,
    ElementAttempt,
} from "../../storage/types";

export interface PictureChoiceExerciseProps {
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
    onComplete: (result: {
        correct: number;
        total: number;
        attempts: ElementAttempt[];
    }) => void;
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

export default function PictureChoiceExercise({
    exercise,
    setId = "",
    lessonId = "",
    source = "",
    onComplete,
    resolveImageSrc,
}: PictureChoiceExerciseProps) {
    const {t} = useI18n();
    const choices = useMemo(() => _parseChoices(exercise.images), [exercise.images]);

    const [selected, setSelected] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{correct: number; total: number} | null>(
        null,
    );

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

    const handleSelect = (index: number) => {
        if (submitted) return;
        setSelected(index);
    };

    const handleSubmit = () => {
        if (selected === null) return;
        const correct = choices[selected].isCorrect ? 1 : 0;
        const attempt = derivePictureChoiceAttempt(
            exercise,
            {setId, lessonId},
            selected,
        );
        const scored = {correct, total: 1, attempts: [attempt]};
        setResult({correct, total: 1});
        setSubmitted(true);
        onComplete(scored);
    };

    const handleReset = () => {
        setSelected(null);
        setSubmitted(false);
        setResult(null);
    };

    return (
        <section
            className="picture-exercise"
            data-testid="picture-exercise"
        >
            <p
                className="picture-prompt"
                data-testid="picture-prompt"
            >
                {exercise.prompt}
            </p>

            <ul
                className="picture-grid"
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

            <div className="picture-actions">
                {!submitted ? (
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={selected === null}
                        onClick={handleSubmit}
                        data-testid="picture-submit"
                    >
                        {t(
                            "lesson.exercise.picture.submit",
                            "Check answer",
                        )}
                    </button>
                ) : (
                    <>
                        <p
                            className="picture-result"
                            data-testid="picture-result"
                            data-result={
                                result && result.correct > 0
                                    ? "correct"
                                    : "wrong"
                            }
                        >
                            {result && result.correct > 0
                                ? t(
                                      "lesson.exercise.picture.result_correct",
                                      "Correct!",
                                  )
                                : t(
                                      "lesson.exercise.picture.result_wrong",
                                      "Not quite — the highlighted tile is the right answer.",
                                  )}
                        </p>
                        <button
                            type="button"
                            className="btn"
                            onClick={handleReset}
                            data-testid="picture-retry"
                        >
                            <RotateCcw size={14} aria-hidden="true" />
                            {t(
                                "lesson.exercise.picture.retry",
                                "Try again",
                            )}
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}

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
    const enabled = Boolean(source && setId && normalized);
    const asset = useAsset(
        enabled ? source : null,
        enabled ? setId : null,
        enabled ? normalized : null,
    );
    // Local <img> error fallback covers the case where the
    // resolver gave us a URL but the actual image bytes are
    // corrupt / unsupported. Same flag as v1.28.0.
    const [imgFailed, setImgFailed] = useState(false);

    // Resolution chain (Phase 54D):
    //   1. authored asset bytes (asset cache → blob URL)
    //   2. legacy resolveImageSrc callback (parent-provided)
    //   3. placeholder SVG keyed off the label
    //   4. text-only (no <img>) — final fallback
    let imgSrc: string | null = null;
    let isPlaceholder = false;
    if (asset.url && !imgFailed) {
        imgSrc = asset.url;
    } else if (legacyResolveSrc && !imgFailed) {
        const resolved = legacyResolveSrc(choice.src);
        if (resolved && resolved !== choice.src) imgSrc = resolved;
    }
    // Last-mile placeholder: only kicks in when both above
    // branches missed AND the asset resolver isn't loading
    // (we don't want to flash a placeholder over a still-
    // loading real image).
    if (imgSrc === null && !asset.loading && !imgFailed) {
        imgSrc = generatePlaceholderSvg(choice.label);
        isPlaceholder = true;
    }

    const showAsCorrect = submitted && choice.isCorrect;
    const showAsWrong = submitted && isSelected && !choice.isCorrect;
    const useTextFallback = imgSrc === null && !asset.loading;
    const isLoading = asset.loading && imgSrc === null;

    return (
        <button
            type="button"
            className={`picture-tile${isSelected ? " is-selected" : ""}${
                showAsCorrect ? " is-correct" : ""
            }${showAsWrong ? " is-wrong" : ""}${
                useTextFallback ? " is-text-fallback" : ""
            }${isLoading ? " is-loading" : ""}${
                isPlaceholder ? " is-placeholder" : ""
            }`}
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
                <span className="picture-tile-fallback">{choice.label}</span>
            ) : (
                <img
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
            <span className="picture-tile-label">{choice.label}</span>
            {showAsCorrect && (
                <span
                    className="picture-tile-badge picture-tile-badge-correct"
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
                    className="picture-tile-badge picture-tile-badge-wrong"
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

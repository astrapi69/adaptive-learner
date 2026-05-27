/**
 * PictureChoiceExercise (Phase 44 / EXP-002 / 3D — F-107).
 *
 * "Pick the image" exercise. The lesson schema's
 * ``Exercise.images`` is a list of ``{src, label, is_correct?}``;
 * exactly one entry has ``is_correct: "true"``. The component
 * renders each image as a tap target; submit reports
 * ``{correct: 0|1, total: 1}`` to the parent.
 *
 * Graceful image-degradation: if an ``<img>`` fails to load
 * (404, network error, asset not in cache), the tile swaps
 * to text-only display showing the label. This matters in
 * v1.28.0 because Phase 43's download orchestrator only
 * fetches lesson JSON, not the ``assets/`` directory — every
 * pilot picture-choice step lands in text-only mode until a
 * future phase adds asset fetching. The exercise is still
 * playable since each image carries a textual label.
 *
 * Mobile-first: 2-column grid on narrow viewports, 4-column
 * on wide ones. Each tile is a 44px+ touch target.
 */

import {Check, RotateCcw, X} from "lucide-react";
import {useMemo, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
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
    /** Called on submit with the score (0 or 1 correct of 1
     *  total) plus the single-attempt SRS payload. */
    onComplete: (result: {
        correct: number;
        total: number;
        attempts: ElementAttempt[];
    }) => void;
    /** Optional base path the parent prepends to each image
     *  ``src``. When absent the component uses the raw
     *  authored path, which works for absolute URLs and for
     *  relative paths the parent has already resolved. */
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
    resolveImageSrc: (raw: string) => string,
): Choice[] {
    if (!images) return [];
    return images.map((img, i) => ({
        index: i,
        src: resolveImageSrc(img.src),
        label: img.label,
        isCorrect: img.is_correct === "true",
    }));
}

export default function PictureChoiceExercise({
    exercise,
    setId = "",
    lessonId = "",
    onComplete,
    resolveImageSrc = (raw) => raw,
}: PictureChoiceExerciseProps) {
    const {t} = useI18n();
    const choices = useMemo(
        () => _parseChoices(exercise.images, resolveImageSrc),
        [exercise.images, resolveImageSrc],
    );

    const [selected, setSelected] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{correct: number; total: number} | null>(
        null,
    );
    /** Track which images failed to load so the tile renders
     *  the text-only fallback. */
    const [imageErrors, setImageErrors] = useState<Set<number>>(
        () => new Set(),
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

    const handleImageError = (idx: number) => {
        setImageErrors((prev) => {
            if (prev.has(idx)) return prev;
            const next = new Set(prev);
            next.add(idx);
            return next;
        });
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
                {choices.map((choice) => {
                    const isSelected = selected === choice.index;
                    const showAsCorrect =
                        submitted && choice.isCorrect;
                    const showAsWrong =
                        submitted && isSelected && !choice.isCorrect;
                    const useTextFallback = imageErrors.has(choice.index);
                    return (
                        <li key={choice.index}>
                            <button
                                type="button"
                                className={`picture-tile${
                                    isSelected ? " is-selected" : ""
                                }${
                                    showAsCorrect ? " is-correct" : ""
                                }${showAsWrong ? " is-wrong" : ""}${
                                    useTextFallback
                                        ? " is-text-fallback"
                                        : ""
                                }`}
                                onClick={() => handleSelect(choice.index)}
                                aria-pressed={isSelected}
                                disabled={submitted}
                                data-testid={`picture-choice-${choice.index}`}
                                data-correct={
                                    choice.isCorrect ? "true" : "false"
                                }
                            >
                                {useTextFallback ? (
                                    <span className="picture-tile-fallback">
                                        {choice.label}
                                    </span>
                                ) : (
                                    <img
                                        src={choice.src}
                                        alt={choice.label}
                                        onError={() =>
                                            handleImageError(
                                                choice.index,
                                            )
                                        }
                                        loading="lazy"
                                    />
                                )}
                                <span className="picture-tile-label">
                                    {choice.label}
                                </span>
                                {showAsCorrect && (
                                    <span
                                        className="picture-tile-badge picture-tile-badge-correct"
                                        aria-label={t(
                                            "lesson.exercise.picture.correct_label",
                                            "Correct",
                                        )}
                                    >
                                        <Check
                                            size={14}
                                            aria-hidden="true"
                                        />
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
                        </li>
                    );
                })}
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

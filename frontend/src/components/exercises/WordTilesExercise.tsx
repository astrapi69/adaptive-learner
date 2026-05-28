/**
 * WordTilesExercise (Phase 45 / EXP-002 / 3F — F-109).
 *
 * Tap-to-place ordering exercise. The schema's
 * ``exercise.tiles`` is the canonical ordered list. The
 * renderer shuffles the tiles for display; the user taps
 * tiles from the scrambled bar (top) to fill the answer row
 * (bottom). Tapping a placed tile returns it to the
 * scrambled bar.
 *
 * Validation (D4): when ``exercise.accept_orderings`` is
 * present, ANY permutation in that list is accepted (each
 * is a list of indices into ``tiles``). When absent, ONLY
 * the canonical ``tiles`` order is correct. The schema
 * validator (content-loader / schema.py) already enforces
 * that each entry is a full permutation of [0..len-1]; the
 * renderer just compares index sequences.
 *
 * Result contract matches the sibling exercises:
 * ``onComplete({correct: 0|1, total: 1})``. Parent (Lesson
 * viewer) persists via ``recordStepResult``.
 *
 * Mobile-first: scrambled bar wraps, each tile is 44px
 * min-height. No drag-and-drop library — tap-to-place keeps
 * the touch surface large and works on every browser.
 */

import {Check, RotateCcw, X} from "lucide-react";
import {useMemo, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {deriveWordTilesAttempt} from "../../lib/element-attempt";
import {tokenDiff} from "../../lib/exercises/token-diff";
import type {
    ContentLessonExercise,
    ElementAttempt,
} from "../../storage/types";
import DiffHighlight from "./DiffHighlight";

export interface WordTilesExerciseProps {
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
}

/** Deterministic Fisher-Yates shuffle keyed by ``seed`` so
 *  reshuffling on every render does NOT move tiles under the
 *  user. Reuses the matching/picture pattern. */
function _shuffle<T>(items: readonly T[], seed: string): T[] {
    const out = [...items];
    let acc = 0;
    for (const ch of seed) acc = (acc * 31 + ch.charCodeAt(0)) | 0;
    for (let i = out.length - 1; i > 0; i--) {
        acc = (acc * 1103515245 + 12345) & 0x7fffffff;
        const j = acc % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** True iff the placed sequence (indices into ``tiles``)
 *  matches the canonical order OR any of the alternate
 *  orderings authored in ``accept_orderings``. */
export function isWordTilesCorrect(
    placed: readonly number[],
    tileCount: number,
    acceptOrderings: readonly (readonly number[])[] | null | undefined,
): boolean {
    if (placed.length !== tileCount) return false;
    const canonical = Array.from({length: tileCount}, (_, i) => i);
    if (_arraysEqual(placed, canonical)) return true;
    if (!acceptOrderings) return false;
    for (const ordering of acceptOrderings) {
        if (_arraysEqual(placed, ordering)) return true;
    }
    return false;
}

function _arraysEqual(
    a: readonly number[],
    b: readonly number[],
): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export default function WordTilesExercise({
    exercise,
    setId = "",
    lessonId = "",
    onComplete,
}: WordTilesExerciseProps) {
    const {t} = useI18n();
    const tiles = exercise.tiles ?? [];
    const acceptOrderings = exercise.accept_orderings;

    // Stable seed per-mount so the scrambled bar doesn't
    // re-shuffle on every render.
    const [shuffleSeed] = useState(
        () => `${exercise.id}#${Date.now() & 0xffff}`,
    );

    /** Display order = shuffled permutation of [0..tiles.length-1].
     *  The scrambled bar iterates this list (and skips any
     *  index that is currently placed). The answer row
     *  iterates ``placed`` in user-tap order. */
    const displayOrder: number[] = useMemo(() => {
        const indices = Array.from({length: tiles.length}, (_, i) => i);
        return _shuffle(indices, shuffleSeed);
    }, [tiles.length, shuffleSeed]);

    /** Indices of tiles the user has placed, in the order
     *  they tapped them. */
    const [placed, setPlaced] = useState<number[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{
        correct: number;
        total: number;
    } | null>(null);
    const [showHint, setShowHint] = useState(false);

    if (tiles.length === 0) {
        return (
            <div data-testid="word-tiles-empty">
                {t(
                    "lesson.exercise.word_tiles.empty",
                    "This word-tiles exercise has no tiles.",
                )}
            </div>
        );
    }

    const placedSet = new Set(placed);
    const scrambledIndices = displayOrder.filter((i) => !placedSet.has(i));
    const allPlaced = placed.length === tiles.length;

    const handlePlace = (index: number) => {
        if (submitted) return;
        if (placedSet.has(index)) return;
        setPlaced([...placed, index]);
    };

    const handleReturn = (index: number) => {
        if (submitted) return;
        setPlaced(placed.filter((i) => i !== index));
    };

    const handleSubmit = () => {
        if (submitted || !allPlaced) return;
        const isCorrect = isWordTilesCorrect(
            placed,
            tiles.length,
            acceptOrderings,
        );
        const correct = isCorrect ? 1 : 0;
        const attempt = deriveWordTilesAttempt(
            exercise,
            {setId, lessonId},
            placed,
            isCorrect,
        );
        const scored = {correct, total: 1, attempts: [attempt]};
        setResult({correct, total: 1});
        setSubmitted(true);
        onComplete(scored);
    };

    const handleReset = () => {
        setPlaced([]);
        setSubmitted(false);
        setResult(null);
    };

    const isCorrect = result !== null && result.correct > 0;

    /** For wrong-result feedback, render the canonical
     *  ``tiles`` joined by spaces — the schema guarantees
     *  the canonical order is always accepted. */
    const canonicalDisplay = tiles.join(" ");

    return (
        <section
            className="word-tiles-exercise"
            data-testid="word-tiles-exercise"
        >
            <p
                className="word-tiles-prompt"
                data-testid="word-tiles-prompt"
            >
                {exercise.prompt}
            </p>

            <div
                className="word-tiles-answer-row"
                data-testid="word-tiles-answer-row"
                aria-label={t(
                    "lesson.exercise.word_tiles.answer_label",
                    "Your answer",
                )}
                aria-live="polite"
            >
                {placed.length === 0 ? (
                    <p
                        className="word-tiles-answer-empty"
                        data-testid="word-tiles-answer-empty"
                    >
                        {t(
                            "lesson.exercise.word_tiles.answer_placeholder",
                            "Tap tiles below to build your answer",
                        )}
                    </p>
                ) : (
                    <ul className="word-tiles-list word-tiles-list-placed">
                        {placed.map((tileIndex, slotIndex) => (
                            <li key={tileIndex}>
                                <button
                                    type="button"
                                    className={`word-tile word-tile-placed${
                                        submitted && isCorrect
                                            ? " is-correct"
                                            : ""
                                    }${
                                        submitted && !isCorrect
                                            ? " is-wrong"
                                            : ""
                                    }`}
                                    onClick={() => handleReturn(tileIndex)}
                                    disabled={submitted}
                                    data-testid={`word-tile-placed-${slotIndex}`}
                                    data-tile-index={tileIndex}
                                >
                                    {tiles[tileIndex]}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div
                className="word-tiles-scrambled-row"
                data-testid="word-tiles-scrambled-row"
                aria-label={t(
                    "lesson.exercise.word_tiles.scrambled_label",
                    "Available tiles",
                )}
            >
                {scrambledIndices.length === 0 ? (
                    <p
                        className="word-tiles-scrambled-empty"
                        data-testid="word-tiles-scrambled-empty"
                    >
                        {t(
                            "lesson.exercise.word_tiles.scrambled_done",
                            "All tiles placed.",
                        )}
                    </p>
                ) : (
                    <ul className="word-tiles-list word-tiles-list-scrambled">
                        {scrambledIndices.map((tileIndex) => (
                            <li key={tileIndex}>
                                <button
                                    type="button"
                                    className="word-tile word-tile-scrambled"
                                    onClick={() => handlePlace(tileIndex)}
                                    disabled={submitted}
                                    data-testid={`word-tile-scrambled-${tileIndex}`}
                                >
                                    {tiles[tileIndex]}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {exercise.hint && !submitted && (
                <div className="word-tiles-hint-row">
                    {!showHint ? (
                        <button
                            type="button"
                            className="word-tiles-hint-toggle"
                            onClick={() => setShowHint(true)}
                            data-testid="word-tiles-hint-show"
                        >
                            {t(
                                "lesson.exercise.word_tiles.hint_show",
                                "Need a hint?",
                            )}
                        </button>
                    ) : (
                        <p
                            className="word-tiles-hint"
                            data-testid="word-tiles-hint"
                        >
                            {exercise.hint}
                        </p>
                    )}
                </div>
            )}

            <div className="word-tiles-actions">
                {!submitted ? (
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!allPlaced}
                        onClick={handleSubmit}
                        data-testid="word-tiles-submit"
                    >
                        {t(
                            "lesson.exercise.word_tiles.submit",
                            "Check answer",
                        )}
                    </button>
                ) : (
                    <>
                        <p
                            className={`word-tiles-result${
                                isCorrect ? " is-correct" : " is-wrong"
                            }`}
                            data-testid="word-tiles-result"
                            data-result={isCorrect ? "correct" : "wrong"}
                        >
                            {isCorrect ? (
                                <>
                                    <Check size={14} aria-hidden="true" />
                                    {t(
                                        "lesson.exercise.word_tiles.result_correct",
                                        "Correct!",
                                    )}
                                </>
                            ) : (
                                <>
                                    <X size={14} aria-hidden="true" />
                                    {t(
                                        "lesson.exercise.word_tiles.result_wrong",
                                        "Not quite.",
                                    )}
                                </>
                            )}
                        </p>
                        {!isCorrect && (
                            <div
                                className="word-tiles-diff-row"
                                data-testid="word-tiles-diff-row"
                            >
                                <DiffHighlight
                                    tokens={tokenDiff(
                                        placed.map((idx) => tiles[idx]).join(" "),
                                        canonicalDisplay,
                                    )}
                                    className="word-tiles-diff"
                                />
                            </div>
                        )}
                        <button
                            type="button"
                            className="btn"
                            onClick={handleReset}
                            data-testid="word-tiles-retry"
                        >
                            <RotateCcw size={14} aria-hidden="true" />
                            {t(
                                "lesson.exercise.word_tiles.retry",
                                "Try again",
                            )}
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}

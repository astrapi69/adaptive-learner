/**
 * MatchingExercise (Phase 44 / EXP-002 / 3C — F-106).
 *
 * Two-column tap-to-pair exercise. Left column = terms in
 * authored order; right column = definitions, shuffled.
 * User taps a left tile (or selects via keyboard), then taps
 * a right tile to create a pair. Tapping a paired tile undoes
 * the pair. Submit enables once every pair is made.
 *
 * Accessibility:
 * - Each tile is a real ``<button>`` with an aria-pressed
 *   state. Keyboard users navigate via Tab; pairing happens
 *   on Enter / Space.
 * - aria-live announces the running pair count.
 *
 * Mobile-first: tap-to-pair. Drag-and-drop is an explicit
 * non-goal for v1.28.0 — tap-to-pair works everywhere and
 * keeps the touch surface above 44px without a DnD library.
 *
 * Result contract: the parent (viewer commit 6 wires this)
 * passes ``onComplete({correct, total})``. The viewer then
 * persists via ``recordStepResult`` and advances. Calling
 * ``onComplete`` twice is safe — the parent dedupes via
 * ``recordStepResult`` keyed by step id.
 */

import {Check, RotateCcw, X} from "lucide-react";
import {useEffect, useMemo, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {deriveMatchingAttempts} from "../../lib/element-attempt";
import type {
    ContentLessonExercise,
    ElementAttempt,
} from "../../storage/types";

export interface MatchingExerciseProps {
    exercise: ContentLessonExercise;
    /** Content-set id + lesson id — Phase 46B context the
     *  exercise needs to derive per-element attempts for the
     *  SRS layer. Optional in unit tests; required in
     *  production (the viewer always passes them). Empty
     *  strings still produce attempts; the viewer's guard
     *  chain decides whether to persist. */
    setId?: string;
    lessonId?: string;
    /** Called when the user submits answers AND the parent
     *  should record the result. Receives the scored
     *  outcome AND a per-pair ``attempts`` list the viewer
     *  passes to ``elementErrors.recordBulk`` (Phase 46B). */
    onComplete: (result: {
        correct: number;
        total: number;
        attempts: ElementAttempt[];
    }) => void;
}

interface LeftTile {
    index: number;
    label: string;
}

interface RightTile {
    /** Original index in the authored pairs list. */
    originalIndex: number;
    label: string;
}

/** Deterministic Fisher-Yates shuffle keyed by the
 *  exercise id so a reload reshuffles consistently within
 *  the same session but every fresh visit gets a new order. */
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

export default function MatchingExercise({
    exercise,
    setId = "",
    lessonId = "",
    onComplete,
}: MatchingExerciseProps) {
    const {t} = useI18n();
    const pairs = exercise.pairs ?? [];

    // Stable seed per-mount so reshuffling on every render
    // doesn't move the right column under the user.
    const [shuffleSeed] = useState(
        () => `${exercise.id}#${Date.now() & 0xffff}`,
    );

    const leftTiles: LeftTile[] = useMemo(
        () =>
            pairs.map((p, i) => ({
                index: i,
                label: p.left,
            })),
        [pairs],
    );

    const rightTiles: RightTile[] = useMemo(() => {
        const indexed = pairs.map((p, i) => ({
            originalIndex: i,
            label: p.right,
        }));
        return _shuffle(indexed, shuffleSeed);
    }, [pairs, shuffleSeed]);

    /** Currently-selected left index (waiting for a right
     *  click to complete the pair). null when nothing is
     *  selected. */
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    /** Map from left index → right's originalIndex. */
    const [matches, setMatches] = useState<Map<number, number>>(
        () => new Map(),
    );
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{correct: number; total: number} | null>(
        null,
    );
    /** Wrong-flash trigger for visual feedback. */
    const [wrongFlash, setWrongFlash] = useState<{
        left: number;
        right: number;
    } | null>(null);

    useEffect(() => {
        if (wrongFlash === null) return;
        const id = window.setTimeout(() => setWrongFlash(null), 600);
        return () => window.clearTimeout(id);
    }, [wrongFlash]);

    const pairedRightIndices = useMemo(
        () => new Set(matches.values()),
        [matches],
    );

    const handleLeftClick = (idx: number) => {
        if (submitted) return;
        // Tapping a paired left undoes the pair.
        if (matches.has(idx)) {
            const next = new Map(matches);
            next.delete(idx);
            setMatches(next);
            setSelectedLeft(null);
            return;
        }
        setSelectedLeft(idx === selectedLeft ? null : idx);
    };

    const handleRightClick = (originalIndex: number) => {
        if (submitted) return;
        // Tapping a paired right undoes the pair.
        const pairedLeft = [...matches.entries()].find(
            ([, ri]) => ri === originalIndex,
        );
        if (pairedLeft) {
            const next = new Map(matches);
            next.delete(pairedLeft[0]);
            setMatches(next);
            return;
        }
        if (selectedLeft === null) return;
        const next = new Map(matches);
        next.set(selectedLeft, originalIndex);
        setMatches(next);
        setSelectedLeft(null);
    };

    const allPaired = matches.size === pairs.length;

    const handleSubmit = () => {
        let correct = 0;
        for (const [leftIdx, rightOriginal] of matches) {
            if (leftIdx === rightOriginal) correct += 1;
        }
        const attempts = deriveMatchingAttempts(
            exercise,
            {setId, lessonId},
            matches,
        );
        const scored = {correct, total: pairs.length, attempts};
        setResult({correct, total: pairs.length});
        setSubmitted(true);
        onComplete(scored);
    };

    const handleReset = () => {
        setMatches(new Map());
        setSelectedLeft(null);
        setSubmitted(false);
        setResult(null);
    };

    if (pairs.length === 0) {
        return (
            <div data-testid="matching-empty">
                {t(
                    "lesson.exercise.matching.empty",
                    "This matching exercise has no pairs.",
                )}
            </div>
        );
    }

    return (
        <section
            className="matching-exercise"
            data-testid="matching-exercise"
        >
            <p
                className="matching-prompt"
                data-testid="matching-prompt"
            >
                {exercise.prompt}
            </p>

            <p
                className="matching-counter"
                aria-live="polite"
                data-testid="matching-counter"
            >
                {t(
                    "lesson.exercise.matching.counter",
                    "{matched} / {total} paired",
                )
                    .replace("{matched}", String(matches.size))
                    .replace("{total}", String(pairs.length))}
            </p>

            <div className="matching-columns">
                <ul
                    className="matching-column matching-column-left"
                    data-testid="matching-left"
                    aria-label={t(
                        "lesson.exercise.matching.left_label",
                        "Terms",
                    )}
                >
                    {leftTiles.map((tile) => {
                        const isSelected = selectedLeft === tile.index;
                        const isPaired = matches.has(tile.index);
                        const isCorrect =
                            submitted &&
                            matches.get(tile.index) === tile.index;
                        const isWrong =
                            submitted &&
                            isPaired &&
                            matches.get(tile.index) !== tile.index;
                        return (
                            <li key={tile.index}>
                                <button
                                    type="button"
                                    className={`matching-tile matching-tile-left${
                                        isSelected ? " is-selected" : ""
                                    }${isPaired ? " is-paired" : ""}${
                                        isCorrect ? " is-correct" : ""
                                    }${isWrong ? " is-wrong" : ""}`}
                                    onClick={() =>
                                        handleLeftClick(tile.index)
                                    }
                                    aria-pressed={isSelected}
                                    disabled={submitted && isCorrect}
                                    data-testid={`matching-left-${tile.index}`}
                                >
                                    {tile.label}
                                    {submitted && isCorrect && (
                                        <Check size={14} aria-hidden="true" />
                                    )}
                                    {submitted && isWrong && (
                                        <X size={14} aria-hidden="true" />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <ul
                    className="matching-column matching-column-right"
                    data-testid="matching-right"
                    aria-label={t(
                        "lesson.exercise.matching.right_label",
                        "Definitions",
                    )}
                >
                    {rightTiles.map((tile) => {
                        const isPaired = pairedRightIndices.has(
                            tile.originalIndex,
                        );
                        const flashing =
                            wrongFlash !== null &&
                            wrongFlash.right === tile.originalIndex;
                        return (
                            <li key={tile.originalIndex}>
                                <button
                                    type="button"
                                    className={`matching-tile matching-tile-right${
                                        isPaired ? " is-paired" : ""
                                    }${flashing ? " is-flash" : ""}`}
                                    onClick={() =>
                                        handleRightClick(
                                            tile.originalIndex,
                                        )
                                    }
                                    disabled={submitted}
                                    data-testid={`matching-right-${tile.originalIndex}`}
                                >
                                    {tile.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="matching-actions">
                {!submitted ? (
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!allPaired}
                        onClick={handleSubmit}
                        data-testid="matching-submit"
                    >
                        {t("lesson.exercise.matching.submit", "Check answers")}
                    </button>
                ) : (
                    <>
                        <p
                            className="matching-result"
                            data-testid="matching-result"
                        >
                            {t(
                                "lesson.exercise.matching.result",
                                "Score: {correct} / {total}",
                            )
                                .replace(
                                    "{correct}",
                                    String(result?.correct ?? 0),
                                )
                                .replace(
                                    "{total}",
                                    String(result?.total ?? 0),
                                )}
                        </p>
                        <button
                            type="button"
                            className="btn"
                            onClick={handleReset}
                            data-testid="matching-retry"
                        >
                            <RotateCcw size={14} aria-hidden="true" />
                            {t(
                                "lesson.exercise.matching.retry",
                                "Try again",
                            )}
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}

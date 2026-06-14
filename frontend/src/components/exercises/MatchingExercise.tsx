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

import {forwardRef, useEffect, useMemo, useState} from "react";
import type {Ref} from "react";

import {useI18n} from "../../hooks/useI18n";
import {deriveMatchingAttempts} from "../../lib/element-attempt";
import {useControlledExercise} from "../../lib/exercises/useControlledExercise";
import type {ContentLessonExercise} from "../../storage/types";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "./exercise-control";
import {
    computeMatchingLabels,
    computeLeftTileState,
    computeRightTileState,
    MatchingLeftTile,
    MatchingRightTile,
    MatchingPrompt,
    MatchingResultFooter,
    type LeftTile,
    type RightTile,
} from "./matching-parts";

export {MATCHING_PAIR_COLORS, matchingPairColorVar} from "./matching-parts";

export interface MatchingExerciseProps extends ControlledExerciseProps {
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
    onComplete: (result: ExerciseScored) => void;
    /** UX bugfix — BCP-47 codes of the lesson's language pair.
     *  When provided, the column headers show the actual
     *  language NAMES (e.g. "Français" / "Deutsch") instead of
     *  the generic "Term" / "Translation". Optional; the
     *  Review + AdaptiveLesson pages omit them and keep the
     *  generic labels. */
    targetLanguage?: string | null;
    sourceLanguage?: string | null;
    /** #149 — the lesson's domain. For a non-language domain (or a
     *  source==target knowledge set) the renderer drops the
     *  translation-specific wording: neutral Term / Definition
     *  column labels, no language names, a "match each term to its
     *  definition" instruction. Optional; absent = language behaviour. */
    domain?: string | null;
}


/** Count pairs whose left index matches its right originalIndex. */
function _scoreMatches(
    matches: ReadonlyMap<number, number>,
    total: number,
): {correct: number; total: number} {
    let correct = 0;
    for (const [leftIdx, rightOriginal] of matches) {
        if (leftIdx === rightOriginal) correct += 1;
    }
    return {correct, total};
}


/** Lowest non-negative slot not already assigned to a pair, so
 *  colors + labels stay compact (1, 2, 3 …) and an existing pair
 *  keeps its slot when another is added or removed. */
function _nextFreeSlot(slots: ReadonlyMap<number, number>): number {
    const used = new Set(slots.values());
    let slot = 0;
    while (used.has(slot)) slot += 1;
    return slot;
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


function MatchingExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        targetLanguage = null,
        sourceLanguage = null,
        domain = null,
        ttsLang = null,
        codeMode = false,
    }: MatchingExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t, lang} = useI18n();
    const pairs = useMemo(() => exercise.pairs ?? [], [exercise.pairs]);
    const reviewedMatching =
        reviewed?.kind === "matching" ? reviewed : null;
    // EXP-018 / Phase 62: a productive drill shows the source-language
    // column on the left (the learner produces the target). Receptive
    // keeps the authored orientation (target left, source right). Only
    // the DISPLAYED label flips — pair indices (and thus scoring) are
    // unchanged, so pair i still matches right i.
    // #149 / EXP-018 — column labels + instruction (knowledge vs language,
    // receptive vs productive) resolved in one pure helper.
    const {productive, isKnowledge, leftLabel, rightLabel, instruction} =
        computeMatchingLabels(exercise, {
            uiLang: lang,
            targetLanguage,
            sourceLanguage,
            domain,
            t,
        });

    // Stable seed per-mount so reshuffling on every render
    // doesn't move the right column under the user.
    const [shuffleSeed] = useState(
        () => `${exercise.id}#${Date.now() & 0xffff}`,
    );

    const leftTiles: LeftTile[] = useMemo(
        () =>
            pairs.map((p, i) => ({
                index: i,
                label: productive ? p.right : p.left,
            })),
        [pairs, productive],
    );

    const rightTiles: RightTile[] = useMemo(() => {
        const indexed = pairs.map((p, i) => ({
            originalIndex: i,
            label: productive ? p.left : p.right,
        }));
        return _shuffle(indexed, shuffleSeed);
    }, [pairs, shuffleSeed, productive]);

    /** Currently-selected left index (waiting for a right
     *  click to complete the pair). null when nothing is
     *  selected. */
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    /** Map from left index → right's originalIndex. */
    const [matches, setMatches] = useState<Map<number, number>>(
        () =>
            reviewedMatching
                ? new Map(reviewedMatching.matches)
                : new Map(),
    );
    /** #145 — per-pair color/label slot, keyed by left index.
     *  Assigned when a pair is formed, freed when undone, so both
     *  tiles of a pair share a stable color + number. Only consulted
     *  before submit (graded tiles switch to correct/wrong colors). */
    const [slotByLeft, setSlotByLeft] = useState<Map<number, number>>(
        () => new Map(),
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

    const allPaired = matches.size === pairs.length;

    const reviewedResult = reviewedMatching
        ? _scoreMatches(new Map(reviewedMatching.matches), pairs.length)
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: allPaired,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const {correct} = _scoreMatches(matches, pairs.length);
            return {
                correct,
                total: pairs.length,
                attempts: deriveMatchingAttempts(
                    exercise,
                    {setId, lessonId},
                    matches,
                ),
                raw_answer: {
                    kind: "matching",
                    matches: [...matches.entries()],
                },
            };
        },
        resetAnswer: () => {
            setMatches(new Map());
            setSlotByLeft(new Map());
            setSelectedLeft(null);
        },
    });

    const releaseSlot = (leftIdx: number) => {
        setSlotByLeft((prev) => {
            if (!prev.has(leftIdx)) return prev;
            const next = new Map(prev);
            next.delete(leftIdx);
            return next;
        });
    };

    const handleLeftClick = (idx: number) => {
        if (submitted) return;
        // Tapping a paired left undoes the pair.
        if (matches.has(idx)) {
            const next = new Map(matches);
            next.delete(idx);
            setMatches(next);
            releaseSlot(idx);
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
            releaseSlot(pairedLeft[0]);
            return;
        }
        if (selectedLeft === null) return;
        const next = new Map(matches);
        next.set(selectedLeft, originalIndex);
        setMatches(next);
        setSlotByLeft((prev) => {
            const nextSlots = new Map(prev);
            nextSlots.set(selectedLeft, _nextFreeSlot(prev));
            return nextSlots;
        });
        setSelectedLeft(null);
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
            className="flex flex-col gap-3"
            data-testid="matching-exercise"
        >
            <MatchingPrompt
                prompt={exercise.prompt}
                ttsLang={ttsLang}
                codeMode={codeMode}
                instruction={instruction}
                matchedCount={matches.size}
                totalPairs={pairs.length}
                selectedLeft={selectedLeft}
                leftTiles={leftTiles}
                isKnowledge={isKnowledge}
                submitted={submitted}
                leftLabel={leftLabel}
                rightLabel={rightLabel}
            />

            <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                    <div
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]"
                        data-testid="matching-left-header"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[var(--matching-side-a-bg)] text-[0.625rem] font-bold text-[var(--matching-side-a-fg)] ring-1 ring-[var(--border-strong)]"
                        >
                            A
                        </span>
                        {leftLabel}
                    </div>
                    <ul
                        className="m-0 grid list-none grid-cols-1 [grid-auto-rows:1fr] gap-2 p-0"
                        data-testid="matching-left"
                        aria-label={leftLabel}
                    >
                        {leftTiles.map((tile) => (
                            <MatchingLeftTile
                                key={tile.index}
                                tile={tile}
                                state={computeLeftTileState(tile, {
                                    selectedLeft,
                                    matches,
                                    submitted,
                                    slotByLeft,
                                    pairs,
                                    productive,
                                })}
                                onClick={() => handleLeftClick(tile.index)}
                            />
                        ))}
                    </ul>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <div
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]"
                        data-testid="matching-right-header"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[var(--matching-side-b-bg)] text-[0.625rem] font-bold text-[var(--matching-side-b-fg)] ring-1 ring-[var(--border-strong)]"
                        >
                            B
                        </span>
                        {rightLabel}
                    </div>
                    <ul
                        className="m-0 grid list-none grid-cols-1 [grid-auto-rows:1fr] gap-2 p-0"
                        data-testid="matching-right"
                        aria-label={rightLabel}
                    >
                        {rightTiles.map((tile) => (
                            <MatchingRightTile
                                key={tile.originalIndex}
                                tile={tile}
                                state={computeRightTileState(tile, {
                                    pairedRightIndices,
                                    matches,
                                    slotByLeft,
                                    submitted,
                                    wrongFlash,
                                })}
                                submitted={submitted}
                                onClick={() => handleRightClick(tile.originalIndex)}
                            />
                        ))}
                    </ul>
                </div>
            </div>

            <MatchingResultFooter
                submitted={submitted}
                result={result}
                controlled={controlled}
                canCheck={allPaired}
                onCheck={submit}
                onRetry={reset}
            />
        </section>
    );
}

export default forwardRef(MatchingExercise);

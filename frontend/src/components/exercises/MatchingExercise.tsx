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

import {forwardRef, useEffect, useMemo, useRef, useState} from "react";
import type {Ref} from "react";

import {useI18n} from "../../hooks/ui/useI18n";
import ExerciseHint from "./ExerciseHint";
import MatchingResolution, {type ResolvedPair} from "./MatchingResolution";
import {deriveMatchingAttempts} from "../../lib/srs/element-attempt";
import {prefersReducedMotion} from "../../lib/feedback/feedbackPref";
import {
    MATCHING_RESOLVE_PREF_CHANGE_EVENT,
    readMatchingResolveEffect,
    type MatchingResolveEffect,
} from "../../lib/learning/matchingResolvePref";
import {useControlledExercise} from "../../lib/exercises/useControlledExercise";
import {
    useKeyboardShortcuts,
    type ShortcutDefinition,
} from "../../shared/hooks/useKeyboardShortcuts";
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
    MatchingViewToggle,
    matchingPairIsCorrect,
    type LeftTile,
    type RightTile,
    type MatchingPairs,
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


/** Count correctly-matched pairs. A pair is correct when the matched
 *  right tile's VALUE equals the value its left pair expects, so
 *  duplicate right-column values (e.g. "el" for both libro + coche) are
 *  interchangeable rather than index-bound. */
function _scoreMatches(
    matches: ReadonlyMap<number, number>,
    pairs: MatchingPairs,
    productive: boolean,
): {correct: number; total: number} {
    let correct = 0;
    for (const [leftIdx, rightOriginal] of matches) {
        if (matchingPairIsCorrect(pairs, productive, leftIdx, rightOriginal)) {
            correct += 1;
        }
    }
    return {correct, total: pairs.length};
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
    /** Currently-selected right originalIndex — the symmetric
     *  counterpart so a pair can be started from the B column too
     *  (#507, bidirectional selection). At most one of selectedLeft /
     *  selectedRight is set at a time; forming or undoing a pair clears
     *  both. The pairing direction does not change the ``matches`` map
     *  (always left → right originalIndex), so scoring + the #481
     *  value-based validation are untouched. */
    const [selectedRight, setSelectedRight] = useState<number | null>(null);
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

    /** #824 / #977 — after the answer is checked, the learner toggles
     *  between their own graded answers ("user-answers") and the revealed
     *  solution ("solution"). Default is the graded grid, which is what
     *  the columns already render after submit. */
    const [view, setView] = useState<"user-answers" | "solution">(
        "user-answers",
    );
    /** Whether the solution view has been shown at least once, so the
     *  reveal animation plays only on the FIRST switch (#977). A ref (not
     *  state) so flipping it never triggers a re-render mid-animation. */
    const solutionShownRef = useRef(false);
    /** The animate flag handed to MatchingResolution for the current
     *  solution view; set once per switch in ``showSolution``. */
    const [animateSolution, setAnimateSolution] = useState(false);
    const [resolveEffect, setResolveEffect] = useState<MatchingResolveEffect>(
        () => readMatchingResolveEffect(),
    );
    useEffect(() => {
        const refresh = () => setResolveEffect(readMatchingResolveEffect());
        window.addEventListener("storage", refresh);
        window.addEventListener(MATCHING_RESOLVE_PREF_CHANGE_EVENT, refresh);
        return () => {
            window.removeEventListener("storage", refresh);
            window.removeEventListener(
                MATCHING_RESOLVE_PREF_CHANGE_EVENT,
                refresh,
            );
        };
    }, []);
    const reduceMotion = useMemo(() => prefersReducedMotion(), []);

    const pairedRightIndices = useMemo(
        () => new Set(matches.values()),
        [matches],
    );

    const allPaired = matches.size === pairs.length;

    const reviewedResult = reviewedMatching
        ? _scoreMatches(new Map(reviewedMatching.matches), pairs, productive)
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: allPaired,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const {correct} = _scoreMatches(matches, pairs, productive);
            return {
                correct,
                total: pairs.length,
                attempts: deriveMatchingAttempts(
                    exercise,
                    {setId, lessonId},
                    matches,
                    productive,
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
            setSelectedRight(null);
            setView("user-answers");
            solutionShownRef.current = false;
            setAnimateSolution(false);
        },
    });

    /** Switch to the revealed-solution view (#977). Animates only the
     *  first time it is shown; toggling back to it later renders the end
     *  result immediately. No-op when already on the solution view so a
     *  repeat click can't restart a mid-play animation. */
    const showSolution = () => {
        if (view === "solution") return;
        const firstTime = !solutionShownRef.current;
        solutionShownRef.current = true;
        setAnimateSolution(firstTime);
        setView("solution");
    };
    const showUserAnswers = () => setView("user-answers");

    /** The correct pairs in authored order, ready for the resolution
     *  view (#824). ``slot`` uses the authored index for stable, distinct
     *  per-pair colors; ``wasCorrect`` reflects the learner's own match. */
    const resolvedPairs: ResolvedPair[] = useMemo(
        () =>
            leftTiles.map((tile) => {
                const chosen = matches.get(tile.index);
                return {
                    left: tile.label,
                    right: productive
                        ? (pairs[tile.index]?.left ?? "")
                        : (pairs[tile.index]?.right ?? ""),
                    slot: tile.index,
                    wasCorrect:
                        chosen !== undefined &&
                        matchingPairIsCorrect(
                            pairs,
                            productive,
                            tile.index,
                            chosen,
                        ),
                };
            }),
        [leftTiles, matches, pairs, productive],
    );

    const releaseSlot = (leftIdx: number) => {
        setSlotByLeft((prev) => {
            if (!prev.has(leftIdx)) return prev;
            const next = new Map(prev);
            next.delete(leftIdx);
            return next;
        });
    };

    /** Commit a left↔right pair (regardless of which side was tapped
     *  first), assign it a color slot, and clear both selections. */
    const formPair = (leftIdx: number, rightOriginal: number) => {
        const next = new Map(matches);
        next.set(leftIdx, rightOriginal);
        setMatches(next);
        setSlotByLeft((prev) => {
            const nextSlots = new Map(prev);
            nextSlots.set(leftIdx, _nextFreeSlot(prev));
            return nextSlots;
        });
        setSelectedLeft(null);
        setSelectedRight(null);
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
            setSelectedRight(null);
            return;
        }
        // A right tile is already selected → complete the pair (B → A).
        if (selectedRight !== null) {
            formPair(idx, selectedRight);
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
            setSelectedLeft(null);
            setSelectedRight(null);
            return;
        }
        // A left tile is already selected → complete the pair (A → B).
        if (selectedLeft !== null) {
            formPair(selectedLeft, originalIndex);
            return;
        }
        setSelectedRight(originalIndex === selectedRight ? null : originalIndex);
    };

    // Lesson shortcut: Ctrl/⌘+Z undoes the most recently formed pair.
    // ``matches`` is insertion-ordered, so the last key is the last
    // pair the learner made. Disabled while submitted or empty so it
    // never steals the browser's native undo when there is nothing to
    // revert.
    const undoShortcut = useMemo<ShortcutDefinition[]>(
        () => [
            {
                id: "matching-undo",
                key: "z",
                modifiers: {ctrlOrMeta: true},
                context: "lesson",
                description: "Undo the last match",
                action: () => {
                    const lastLeft = [...matches.keys()].at(-1);
                    if (lastLeft === undefined) return;
                    setMatches((prev) => {
                        const next = new Map(prev);
                        next.delete(lastLeft);
                        return next;
                    });
                    releaseSlot(lastLeft);
                    setSelectedLeft(null);
                    setSelectedRight(null);
                },
            },
        ],
        [matches],
    );
    useKeyboardShortcuts(undoShortcut, {
        enabled: !submitted && matches.size > 0,
    });

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

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="matching-hint-button"
            />

            {submitted && (
                <MatchingViewToggle
                    view={view}
                    onShowUserAnswers={showUserAnswers}
                    onShowSolution={showSolution}
                    myAnswersLabel={t(
                        "lesson.exercise.matching.my_answers",
                        "My answers",
                    )}
                    solveLabel={t("lesson.exercise.matching.resolve", "Solve")}
                />
            )}

            {view === "user-answers" && (
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
                        className="m-0 grid flex-1 list-none grid-cols-1 [grid-auto-rows:1fr] gap-2 p-0"
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
                        className="m-0 grid flex-1 list-none grid-cols-1 [grid-auto-rows:1fr] gap-2 p-0"
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
                                    pairs,
                                    productive,
                                    selectedRight,
                                })}
                                submitted={submitted}
                                onClick={() => handleRightClick(tile.originalIndex)}
                            />
                        ))}
                    </ul>
                </div>
            </div>
            )}

            {view === "solution" && (
                <MatchingResolution
                    pairs={resolvedPairs}
                    effect={resolveEffect}
                    reduceMotion={reduceMotion}
                    animate={animateSolution}
                    correctCount={result?.correct ?? 0}
                    totalCount={pairs.length}
                    leftLabel={leftLabel}
                    rightLabel={rightLabel}
                />
            )}

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

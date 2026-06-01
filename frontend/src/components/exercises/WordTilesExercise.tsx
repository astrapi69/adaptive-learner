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
 * Reordering placed tiles (UX) — three coexisting paths:
 *   - **Pointer/touch drag** via @dnd-kit (PointerSensor with
 *     a 5px activation distance). This is the primary mobile
 *     affordance; native HTML5 drag does NOT fire on touch
 *     devices, which is why @dnd-kit replaced it. A tap that
 *     never crosses 5px is NOT a drag, so tap-to-remove is
 *     preserved; a 5px+ drag reorders and suppresses the click.
 *   - **Arrow buttons** (◀ ▶) on each placed tile — secondary
 *     affordance, always visible for touch, out of the tab
 *     order (tabIndex=-1).
 *   - **Keyboard**: focus a placed tile, Left/Right arrows
 *     reorder it immediately (focus follows the tile); Enter
 *     removes it. We deliberately do NOT use @dnd-kit's
 *     KeyboardSensor: it requires a Space/Enter "pick up"
 *     mode that collides with Enter-to-remove on a <button>.
 *     The immediate-move handler is more discoverable and is
 *     already pinned by tests.
 *
 * Mobile-first: scrambled bar wraps, each tile is 44px
 * min-height.
 */

import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {Check, ChevronLeft, ChevronRight, RotateCcw, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {deriveWordTilesAttempt} from "../../lib/element-attempt";
import {tokenDiff} from "../../lib/exercises/token-diff";
import type {ContentLessonExercise} from "../../storage/types";
import AnswerCelebration from "./AnswerCelebration";
import DiffHighlight from "./DiffHighlight";
import DirectionInstruction from "./DirectionInstruction";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "./exercise-control";

export interface WordTilesExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    /** Phase 46B context for the element-attempt deriver.
     *  Optional in unit tests; required in production. */
    setId?: string;
    lessonId?: string;
    /** Called on submit with the score (0 or 1 correct of 1
     *  total) plus the single-attempt SRS payload. */
    onComplete: (result: ExerciseScored) => void;
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

/** Apply a @dnd-kit drag-end to the placed-index sequence.
 *  ``activeId`` / ``overId`` are the stringified tile indices
 *  used as sortable item ids. Returns a NEW array (a copy when
 *  the move is a no-op). Pure + exported so the drag-reorder
 *  contract can be unit-tested without simulating pointer
 *  events (happy-dom pointer drag is unreliable — see
 *  lessons-learned "Radix DropdownMenu + happy-dom"). */
export function applyDragReorder(
    placed: readonly number[],
    activeId: string,
    overId: string,
): number[] {
    const oldIndex = placed.findIndex((i) => String(i) === activeId);
    const newIndex = placed.findIndex((i) => String(i) === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return [...placed];
    }
    return arrayMove([...placed], oldIndex, newIndex);
}

/** True when the user has asked the OS to minimise motion. Guarded
 *  for happy-dom / older environments where matchMedia is absent. */
function _prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface PlacedTileProps {
    tileIndex: number;
    slotIndex: number;
    label: string;
    total: number;
    submitted: boolean;
    isCorrect: boolean;
    reduceMotion: boolean;
    t: (key: string, fallback: string) => string;
    onRemove: (tileIndex: number) => void;
    onMove: (from: number, to: number) => void;
    onKeyReorder: (
        slot: number,
        e: React.KeyboardEvent<HTMLButtonElement>,
    ) => void;
}

/** One placed tile = a @dnd-kit sortable item. The tile button
 *  itself is the drag activator (whole-tile drag, no separate
 *  handle); the ◀ ▶ arrow buttons are plain clicks that do not
 *  start a drag. */
function PlacedTile({
    tileIndex,
    slotIndex,
    label,
    total,
    submitted,
    isCorrect,
    reduceMotion,
    t,
    onRemove,
    onMove,
    onKeyReorder,
}: PlacedTileProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({id: String(tileIndex), disabled: submitted});

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: reduceMotion ? undefined : transition,
        // The DragOverlay renders the floating copy, so dim the
        // in-flow original while it is being dragged.
        opacity: isDragging ? 0.4 : undefined,
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`word-tile-slot${isDragging ? " is-dragging" : ""}`}
        >
            {!submitted && (
                <button
                    type="button"
                    className="word-tile-move word-tile-move-left"
                    onClick={() => onMove(slotIndex, slotIndex - 1)}
                    disabled={slotIndex === 0}
                    tabIndex={-1}
                    aria-label={t(
                        "lesson.exercise.word_tiles.move_left",
                        "Move left",
                    )}
                    data-testid={`word-tile-move-left-${slotIndex}`}
                >
                    <ChevronLeft size={14} aria-hidden="true" />
                </button>
            )}
            <button
                type="button"
                {...attributes}
                {...listeners}
                className={`word-tile word-tile-placed${
                    submitted && isCorrect ? " is-correct" : ""
                }${submitted && !isCorrect ? " is-wrong" : ""}`}
                onClick={() => onRemove(tileIndex)}
                onKeyDown={(e) => onKeyReorder(slotIndex, e)}
                disabled={submitted}
                data-testid={`word-tile-placed-${slotIndex}`}
                data-tile-index={tileIndex}
                data-slot={slotIndex}
                aria-label={t(
                    "lesson.exercise.word_tiles.reorder_aria",
                    "Tile {tile}, position {n} of {total}. Drag or use arrow keys to reorder, Enter to remove.",
                )
                    .replace("{tile}", label)
                    .replace("{n}", String(slotIndex + 1))
                    .replace("{total}", String(total))}
            >
                {label}
            </button>
            {!submitted && (
                <button
                    type="button"
                    className="word-tile-move word-tile-move-right"
                    onClick={() => onMove(slotIndex, slotIndex + 1)}
                    disabled={slotIndex === total - 1}
                    tabIndex={-1}
                    aria-label={t(
                        "lesson.exercise.word_tiles.move_right",
                        "Move right",
                    )}
                    data-testid={`word-tile-move-right-${slotIndex}`}
                >
                    <ChevronRight size={14} aria-hidden="true" />
                </button>
            )}
        </li>
    );
}

function WordTilesExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
    }: WordTilesExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const tiles = exercise.tiles ?? [];
    const acceptOrderings = exercise.accept_orderings;
    const reviewedWordTiles =
        reviewed?.kind === "word_tiles" ? reviewed : null;

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
    const [placed, setPlaced] = useState<number[]>(
        reviewedWordTiles ? [...reviewedWordTiles.placed] : [],
    );
    const [submitted, setSubmitted] = useState(reviewedWordTiles != null);
    const [result, setResult] = useState<{
        correct: number;
        total: number;
    } | null>(() =>
        reviewedWordTiles
            ? {
                  correct: isWordTilesCorrect(
                      reviewedWordTiles.placed,
                      tiles.length,
                      acceptOrderings,
                  )
                      ? 1
                      : 0,
                  total: 1,
              }
            : null,
    );
    const [showHint, setShowHint] = useState(false);
    // The tile index currently being pointer-dragged (drives the
    // floating DragOverlay copy). null when no drag is active.
    const [activeId, setActiveId] = useState<number | null>(null);
    // The slot to re-focus after a keyboard/arrow move so focus
    // follows the tile to its new position.
    const [focusSlot, setFocusSlot] = useState<number | null>(null);
    const placedListRef = useRef<HTMLUListElement>(null);

    const reduceMotion = useMemo(() => _prefersReducedMotion(), []);

    // PointerSensor handles mouse + touch with no polyfill. The 5px
    // activation distance means a tap (no movement) stays a click
    // (tap-to-remove); a drag of 5px+ starts the reorder.
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
    );

    // After a reorder, return focus to the moved tile at its new slot.
    useEffect(() => {
        if (focusSlot === null) return;
        const btn = placedListRef.current?.querySelector<HTMLButtonElement>(
            `[data-slot="${focusSlot}"]`,
        );
        btn?.focus();
        setFocusSlot(null);
    }, [focusSlot, placed]);

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

    /** Move the placed tile at ``from`` to position ``to`` (splice
     *  insert, so it works for both arrow ±1 and drag-to-position).
     *  Refocuses the moved tile at its new slot for keyboard users. */
    const reorder = (from: number, to: number) => {
        if (submitted) return;
        if (to < 0 || to >= placed.length || from === to) return;
        const next = [...placed];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setPlaced(next);
        setFocusSlot(to);
    };

    const handleTileKeyDown = (
        slot: number,
        e: React.KeyboardEvent<HTMLButtonElement>,
    ) => {
        if (submitted) return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            reorder(slot, slot - 1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            reorder(slot, slot + 1);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (submitted) return;
        setActiveId(Number(event.active.id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        if (submitted) return;
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        setPlaced((prev) =>
            applyDragReorder(prev, String(active.id), String(over.id)),
        );
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
        const scored: ExerciseScored = {
            correct,
            total: 1,
            attempts: [attempt],
            raw_answer: {kind: "word_tiles", placed: [...placed]},
        };
        setResult({correct, total: 1});
        setSubmitted(true);
        onComplete(scored);
    };

    const handleReset = () => {
        setPlaced([]);
        setSubmitted(false);
        setResult(null);
    };

    useImperativeHandle(ref, () => ({submit: handleSubmit}));

    useEffect(() => {
        if (!controlled || reviewedWordTiles || submitted) return;
        onInteraction?.(allPlaced);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controlled, allPlaced, submitted, reviewedWordTiles]);

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

            <DirectionInstruction exercise={exercise} />

            <p
                className="word-tiles-instructions"
                data-testid="word-tiles-instructions"
            >
                {t(
                    "lesson.exercise.word_tiles.instructions",
                    "Arrange the tiles in order. Tap to place; drag a placed tile (or use the arrows) to reorder.",
                )}
            </p>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
            >
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
                        <SortableContext
                            items={placed.map((i) => String(i))}
                            strategy={rectSortingStrategy}
                        >
                            <ul
                                className="word-tiles-list word-tiles-list-placed"
                                ref={placedListRef}
                            >
                                {placed.map((tileIndex, slotIndex) => (
                                    <PlacedTile
                                        key={tileIndex}
                                        tileIndex={tileIndex}
                                        slotIndex={slotIndex}
                                        label={tiles[tileIndex]}
                                        total={placed.length}
                                        submitted={submitted}
                                        isCorrect={isCorrect}
                                        reduceMotion={reduceMotion}
                                        t={t}
                                        onRemove={handleReturn}
                                        onMove={reorder}
                                        onKeyReorder={handleTileKeyDown}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    )}
                </div>

                <DragOverlay>
                    {activeId !== null ? (
                        <div
                            className="word-tile word-tile-placed"
                            data-testid="word-tile-drag-overlay"
                            style={{
                                cursor: "grabbing",
                                ...(reduceMotion
                                    ? {}
                                    : {
                                          transform: "scale(1.05)",
                                          boxShadow:
                                              "0 4px 12px rgba(0,0,0,0.2)",
                                          opacity: 0.95,
                                      }),
                            }}
                        >
                            {tiles[activeId]}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

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
                {!submitted && !controlled && (
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
                )}
                {submitted && (
                    <>
                        <p
                            className={`word-tiles-result answer-feedback${
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
                        <AnswerCelebration isCorrect={isCorrect} />
                        {!controlled && (
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
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

export default forwardRef(WordTilesExercise);

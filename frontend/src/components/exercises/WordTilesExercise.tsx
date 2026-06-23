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
import {Check, ChevronLeft, ChevronRight, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useEffect, useMemo, useRef, useState} from "react";

import {useControlledExercise} from "../../lib/exercises/useControlledExercise";

import {useI18n} from "../../hooks/ui/useI18n";
import {useLessonMode} from "../../hooks/lesson/useLessonMode";
import ExerciseHint from "./ExerciseHint";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import ExercisePromptRow from "./ExercisePromptRow";
import {deriveWordTilesAttempt} from "../../lib/srs/element-attempt";
import type {ContentLessonExercise} from "../../storage/types";
import AnswerCelebration from "./AnswerCelebration";
import DirectionInstruction from "./DirectionInstruction";
import ExerciseAnswerToggle, {type AnswerView} from "./ExerciseAnswerToggle";
import ExerciseFooter from "./ExerciseFooter";
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

/** Shared tile box styling (was .word-tile / .word-tile-placed).
 *  Reused by the scrambled tile, the placed tile, and the floating
 *  DragOverlay copy so they render identically. 44px min touch target. */
const WORD_TILE_BASE =
    "inline-flex min-h-11 items-center justify-center cursor-pointer rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-[0.9375rem] font-medium text-[var(--fg)] transition-[background,border-color] duration-150 enabled:hover:bg-[var(--surface-2)] disabled:cursor-not-allowed";
const WORD_TILE_PLACED =
    "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))]";

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

/** Per-position correctness of the learner's placed order, for the
 *  "My answer" view (#1005). A position is correct when its tile sits in
 *  its canonical slot (``tiles`` index === slot). When the whole answer is
 *  accepted (canonical OR an authored ``accept_orderings`` permutation),
 *  every position is marked correct so an accepted alternative shows all
 *  green. Pure + exported for unit tests. */
export function wordTilesPerTileCorrect(
    placed: readonly number[],
    isCorrect: boolean,
): boolean[] {
    if (isCorrect) return placed.map(() => true);
    return placed.map((tileIndex, slot) => tileIndex === slot);
}

/** Read-only tile row shown after checking. Each tile carries enough
 *  spacing (flex gap) to read as a sentence — replacing the old squished
 *  token-diff line (#1005). ``correctness === null`` paints every tile
 *  green (the all-correct solution view); otherwise per-position. */
function WordTilesAnswerView({
    labels,
    correctness,
    testId,
    ariaLabel,
}: {
    labels: string[];
    correctness: boolean[] | null;
    testId: string;
    ariaLabel: string;
}) {
    return (
        <div
            className="rounded-sm border border-border bg-[var(--surface)] p-2"
            data-testid={testId}
            aria-label={ariaLabel}
        >
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {labels.map((label, i) => {
                    const ok = correctness ? correctness[i] : true;
                    return (
                        <li key={i}>
                            <span
                                className={cn(
                                    WORD_TILE_BASE,
                                    "cursor-default",
                                    ok
                                        ? "border-[var(--exercise-correct)] bg-[color-mix(in_srgb,var(--exercise-correct)_18%,var(--surface))]"
                                        : "border-[var(--exercise-wrong)] bg-[color-mix(in_srgb,var(--exercise-wrong)_12%,var(--surface))]",
                                )}
                                data-testid={`${testId}-tile-${i}`}
                                data-correct={ok}
                            >
                                {label}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
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
            className={cn(
                "inline-flex cursor-grab items-center gap-0.5 motion-safe:transition-[transform,box-shadow] motion-safe:duration-150",
                isDragging &&
                    "is-dragging cursor-grabbing opacity-85 shadow-[var(--shadow-elevated)] motion-safe:scale-105",
            )}
        >
            {!submitted && (
                <button
                    type="button"
                    className="inline-flex min-h-11 min-w-6 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent px-0.5 text-[var(--fg-muted)] enabled:hover:bg-[var(--surface-2)] enabled:hover:text-[var(--accent-text)] disabled:cursor-not-allowed disabled:opacity-30"
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
                className={cn(
                    WORD_TILE_BASE,
                    WORD_TILE_PLACED,
                    "h-full",
                    submitted &&
                        isCorrect &&
                        "is-correct border-[var(--exercise-correct)] bg-[color-mix(in_srgb,var(--exercise-correct)_18%,var(--surface))]",
                    submitted &&
                        !isCorrect &&
                        "is-wrong border-[var(--exercise-wrong)] bg-[color-mix(in_srgb,var(--exercise-wrong)_12%,var(--surface))]",
                )}
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
                    className="inline-flex min-h-11 min-w-6 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent px-0.5 text-[var(--fg-muted)] enabled:hover:bg-[var(--surface-2)] enabled:hover:text-[var(--accent-text)] disabled:cursor-not-allowed disabled:opacity-30"
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

type Translate = (key: string, fallback?: string) => string;

/** Reviewed-revisit score for a persisted word-tiles answer, or null
 *  when there is no reviewed answer. */
function wordTilesReviewedResult(
    reviewedPlaced: readonly number[] | null | undefined,
    tileCount: number,
    acceptOrderings: readonly (readonly number[])[] | null | undefined,
): {correct: number; total: number} | null {
    if (reviewedPlaced == null) return null;
    return {
        correct: isWordTilesCorrect(reviewedPlaced, tileCount, acceptOrderings)
            ? 1
            : 0,
        total: 1,
    };
}

/** The "Need a hint?" disclosure; null until shown or once submitted. */
function WordTilesHint({
    hint,
    submitted,
    showHint,
    onShowHint,
}: {
    hint: string | null | undefined;
    submitted: boolean;
    showHint: boolean;
    onShowHint: () => void;
}) {
    const {t} = useI18n();
    if (!hint || submitted) return null;
    return (
        <div className="flex items-center gap-2">
            {!showHint ? (
                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="text-[var(--accent-text)] underline underline-offset-2 hover:no-underline"
                    onClick={onShowHint}
                    data-testid="word-tiles-hint-show"
                >
                    {t("lesson.exercise.word_tiles.hint_show", "Need a hint?")}
                </Button>
            ) : (
                <p
                    className="m-0 rounded-sm border px-3 py-2 text-sm text-[var(--fg)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] border-[color-mix(in_srgb,var(--accent)_25%,var(--border))]"
                    data-testid="word-tiles-hint"
                >
                    {hint}
                </p>
            )}
        </div>
    );
}

/** Correct/wrong feedback + celebration + the shared exercise footer.
 *  The readable correction (My answer / Solution tiles) lives in the
 *  toggle views above, not in a token-diff line (#1005). */
function WordTilesResult({
    submitted,
    isCorrect,
    controlled,
    canCheck,
    onCheck,
    onRetry,
    t,
}: {
    submitted: boolean;
    isCorrect: boolean;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
    t: Translate;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {submitted && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 inline-flex items-center gap-1.5 font-semibold",
                            isCorrect
                                ? "is-correct text-[var(--exercise-correct)]"
                                : "is-wrong text-[var(--danger)]",
                        )}
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
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="word-tiles"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t("lesson.exercise.word_tiles.submit", "Check answer")}
                retryLabel={t("lesson.exercise.word_tiles.retry", "Try again")}
            />
        </div>
    );
}

/** The "Available tiles" bar — the not-yet-placed tiles, tap to place. */
function WordTilesScrambledRow({
    scrambledIndices,
    tiles,
    submitted,
    onPlace,
}: {
    scrambledIndices: number[];
    tiles: string[];
    submitted: boolean;
    onPlace: (index: number) => void;
}) {
    const {t} = useI18n();
    return (
        <div
            className="rounded-sm border border-border bg-[var(--surface)] p-2"
            data-testid="word-tiles-scrambled-row"
            aria-label={t(
                "lesson.exercise.word_tiles.scrambled_label",
                "Available tiles",
            )}
        >
            {scrambledIndices.length === 0 ? (
                <p
                    className="m-0 p-2 text-center text-sm text-[var(--fg-muted)]"
                    data-testid="word-tiles-scrambled-empty"
                >
                    {t("lesson.exercise.word_tiles.scrambled_done", "All tiles placed.")}
                </p>
            ) : (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {scrambledIndices.map((tileIndex) => (
                        <li key={tileIndex}>
                            <button
                                type="button"
                                className={cn(WORD_TILE_BASE, "h-full")}
                                onClick={() => onPlace(tileIndex)}
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
    );
}

interface WordTilesEditorProps {
    submitted: boolean;
    sensors: ReturnType<typeof useSensors>;
    placed: number[];
    tiles: string[];
    scrambledIndices: number[];
    placedListRef: Ref<HTMLUListElement>;
    reduceMotion: boolean;
    activeId: number | null;
    isCorrect: boolean;
    t: (key: string, fallback?: string) => string;
    onDragStart: (event: DragStartEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onDragCancel: () => void;
    onPlace: (index: number) => void;
    onRemove: (index: number) => void;
    onMove: (from: number, to: number) => void;
    onKeyReorder: (
        slot: number,
        e: React.KeyboardEvent<HTMLButtonElement>,
    ) => void;
}

/** The pre-check editing surface: instructions, the drag-and-drop answer
 *  row, and the scrambled tile bank. Self-gated — renders ``null`` once the
 *  answer is submitted, so the parent drops three ``!submitted &&`` guards
 *  and the answer-row ternaries (cohesion / #1047). */
function WordTilesEditor({
    submitted,
    sensors,
    placed,
    tiles,
    scrambledIndices,
    placedListRef,
    reduceMotion,
    activeId,
    isCorrect,
    t,
    onDragStart,
    onDragEnd,
    onDragCancel,
    onPlace,
    onRemove,
    onMove,
    onKeyReorder,
}: WordTilesEditorProps) {
    if (submitted) return null;
    return (
        <>
            <p
                className="m-0 text-[0.8125rem] text-[var(--fg-muted)]"
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
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
            >
                <div
                    className="min-h-16 rounded-sm border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-2"
                    data-testid="word-tiles-answer-row"
                    aria-label={t(
                        "lesson.exercise.word_tiles.answer_label",
                        "Your answer",
                    )}
                    aria-live="polite"
                >
                    {placed.length === 0 ? (
                        <p
                            className="m-0 p-2 text-center text-sm italic text-[var(--fg-muted)]"
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
                                className="m-0 flex list-none flex-wrap gap-2 p-0"
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
                                        onRemove={onRemove}
                                        onMove={onMove}
                                        onKeyReorder={onKeyReorder}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    )}
                </div>

                <DragOverlay>
                    {activeId !== null ? (
                        <div
                            className={cn(WORD_TILE_BASE, WORD_TILE_PLACED)}
                            data-testid="word-tile-drag-overlay"
                            style={{
                                cursor: "grabbing",
                                ...(reduceMotion
                                    ? {}
                                    : {
                                          transform: "scale(1.05)",
                                          boxShadow: "var(--shadow-elevated)",
                                          opacity: 0.95,
                                      }),
                            }}
                        >
                            {tiles[activeId]}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            <WordTilesScrambledRow
                scrambledIndices={scrambledIndices}
                tiles={tiles}
                submitted={submitted}
                onPlace={onPlace}
            />
        </>
    );
}

interface WordTilesReviewProps {
    submitted: boolean;
    showAnswerToggle: boolean;
    view: AnswerView;
    myAnswerLabels: string[];
    myAnswerCorrectness: boolean[];
    tiles: string[];
    t: (key: string, fallback?: string) => string;
    onShowMyAnswer: () => void;
    onShowSolution: () => void;
}

/** The post-check My-answer / Solution toggle (#1005). Self-gated — renders
 *  ``null`` until the answer is submitted and the mode allows the toggle, so
 *  the parent drops the ``submitted && showAnswerToggle &&`` guard and the
 *  view ternary (cohesion / #1047). */
function WordTilesReview({
    submitted,
    showAnswerToggle,
    view,
    myAnswerLabels,
    myAnswerCorrectness,
    tiles,
    t,
    onShowMyAnswer,
    onShowSolution,
}: WordTilesReviewProps) {
    if (!submitted || !showAnswerToggle) return null;
    return (
        <>
            <ExerciseAnswerToggle
                view={view}
                onShowMyAnswer={onShowMyAnswer}
                onShowSolution={onShowSolution}
                testIdPrefix="word-tiles"
            />
            {view === "my-answer" ? (
                <WordTilesAnswerView
                    labels={myAnswerLabels}
                    correctness={myAnswerCorrectness}
                    testId="word-tiles-my-answer-view"
                    ariaLabel={t(
                        "lesson.exercise.toggle.my_answer",
                        "My answer",
                    )}
                />
            ) : (
                <WordTilesAnswerView
                    labels={tiles}
                    correctness={null}
                    testId="word-tiles-solution-view"
                    ariaLabel={t(
                        "lesson.exercise.toggle.solution",
                        "Solution",
                    )}
                />
            )}
        </>
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
        ttsLang = null,
        codeMode = false,
    }: WordTilesExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
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
    const [showHint, setShowHint] = useState(false);
    /** #1005 — after checking, toggle between the learner's graded order
     *  ("my-answer") and the correct order ("solution"). Default is the
     *  learner's own answer. */
    const [view, setView] = useState<AnswerView>("my-answer");
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

    const reviewedResult = wordTilesReviewedResult(
        reviewedWordTiles?.placed,
        tiles.length,
        acceptOrderings,
    );

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: allPlaced,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const isCorrect = isWordTilesCorrect(
                placed,
                tiles.length,
                acceptOrderings,
            );
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveWordTilesAttempt(
                        exercise,
                        {setId, lessonId},
                        placed,
                        isCorrect,
                    ),
                ],
                raw_answer: {kind: "word_tiles", placed: [...placed]},
            };
        },
        resetAnswer: () => {
            setPlaced([]);
            setView("my-answer");
        },
    });

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

    /** #1005 — the My-answer / Solution toggle views. My-answer shows the
     *  learner's tiles in their chosen order with per-position green/red;
     *  Solution shows the canonical ``tiles`` order, all green and readable
     *  (the schema guarantees the canonical order is always accepted). */
    const myAnswerLabels = placed.map((idx) => tiles[idx]);
    const myAnswerCorrectness = wordTilesPerTileCorrect(placed, isCorrect);

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="word-tiles-exercise"
        >
            <ExercisePromptRow
                prompt={exercise.prompt ?? ""}
                ttsLang={ttsLang}
                codeMode={codeMode}
                testId="word-tiles-prompt"
            />

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="word-tiles-hint-button"
            />

            <DirectionInstruction exercise={exercise} />

            <WordTilesEditor
                submitted={submitted}
                sensors={sensors}
                placed={placed}
                tiles={tiles}
                scrambledIndices={scrambledIndices}
                placedListRef={placedListRef}
                reduceMotion={reduceMotion}
                activeId={activeId}
                isCorrect={isCorrect}
                t={t}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
                onPlace={handlePlace}
                onRemove={handleReturn}
                onMove={reorder}
                onKeyReorder={handleTileKeyDown}
            />

            <WordTilesHint
                hint={exercise.hint}
                submitted={submitted}
                showHint={showHint}
                onShowHint={() => setShowHint(true)}
            />

            <WordTilesReview
                submitted={submitted}
                showAnswerToggle={showAnswerToggle}
                view={view}
                myAnswerLabels={myAnswerLabels}
                myAnswerCorrectness={myAnswerCorrectness}
                tiles={tiles}
                t={t}
                onShowMyAnswer={() => setView("my-answer")}
                onShowSolution={() => setView("solution")}
            />

            <WordTilesResult
                submitted={submitted}
                isCorrect={isCorrect}
                controlled={controlled}
                canCheck={allPlaced}
                onCheck={submit}
                onRetry={reset}
                t={t}
            />
        </section>
    );
}

export default forwardRef(WordTilesExercise);

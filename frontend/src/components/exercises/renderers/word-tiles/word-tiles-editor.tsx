/**
 * Word-Tiles pre-check editing surface (#1776 — extracted from
 * WordTilesExercise.tsx, sibling of word-tiles-parts.tsx).
 *
 * Holds the placed sortable tile, the scrambled tile bank, and the
 * DndContext-wrapped editor composition. Pure presentation — every
 * piece of state and every handler arrives via props (the DnD
 * orchestration lives in ``useWordTilesDnd``).
 */

import {
    DndContext,
    DragOverlay,
    closestCenter,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    rectSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {ChevronLeft, ChevronRight} from "lucide-react";
import type {Ref} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {cn} from "@/lib/utils";
import {WORD_TILE_BASE, WORD_TILE_PLACED} from "./word-tiles-parts";

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

/** The "Available tiles" bar — the not-yet-placed tiles, tap to place. */
export function WordTilesScrambledRow({
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

export interface WordTilesEditorProps {
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
export function WordTilesEditor({
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

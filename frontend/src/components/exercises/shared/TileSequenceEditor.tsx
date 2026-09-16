/**
 * TileSequenceEditor (#3110) — the shared tap-to-place + drag-to-reorder
 * tile editor for exercise types that grade an EXACT sequence with no
 * authored alternatives: ``ext:al-ordering`` and ``ext:al-parsons``.
 *
 * Generalised from ``word-tiles/word-tiles-editor.tsx``'s
 * ``WordTilesEditor`` (the ``@dnd-kit`` DndContext + SortableContext
 * composition, the placed-tile arrow/keyboard reorder, the scrambled tile
 * bank), which stays dedicated to core ``word_tiles`` because that
 * renderer additionally supports ``accept_orderings`` alternatives and a
 * My-answer/Solution toggle this shared editor does not need. The DnD
 * MECHANICS (``useWordTilesDnd``) are already fully generic and are reused
 * as-is by both this component and ``WordTilesExercise`` — only the
 * presentational shell is generalised here, parameterised by an i18n key
 * PREFIX (so each caller gets its own ``lesson.exercise.<type>.*``
 * namespace, not ``word_tiles``'s) and a testid prefix.
 *
 * ``renderTileExtra`` lets a caller (``ext:al-parsons``) render a per-slot
 * control INSIDE each placed tile — the indent stepper — without this
 * component knowing anything about indentation.
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
import type {Ref, ReactNode} from "react";

import {cn} from "@/lib/utils";
import {
    WORD_TILE_BASE,
    WORD_TILE_PLACED,
} from "../renderers/word-tiles/word-tiles-parts";

export type Translate = (key: string, fallback?: string) => string;

interface PlacedTileProps {
    tileIndex: number;
    slotIndex: number;
    label: string;
    total: number;
    submitted: boolean;
    isCorrect: boolean;
    reduceMotion: boolean;
    t: Translate;
    i18nPrefix: string;
    testIdPrefix: string;
    monospace: boolean;
    onRemove: (tileIndex: number) => void;
    onMove: (from: number, to: number) => void;
    onKeyReorder: (slot: number, e: React.KeyboardEvent<HTMLButtonElement>) => void;
    renderTileExtra?: (slot: number, tileIndex: number) => ReactNode;
}

function PlacedTile({
    tileIndex,
    slotIndex,
    label,
    total,
    submitted,
    isCorrect,
    reduceMotion,
    t,
    i18nPrefix,
    testIdPrefix,
    monospace,
    onRemove,
    onMove,
    onKeyReorder,
    renderTileExtra,
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
                    aria-label={t(`${i18nPrefix}.move_left`, "Move left")}
                    data-testid={`${testIdPrefix}-move-left-${slotIndex}`}
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
                    monospace && "font-mono",
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
                data-testid={`${testIdPrefix}-placed-${slotIndex}`}
                data-tile-index={tileIndex}
                data-slot={slotIndex}
                aria-label={t(
                    `${i18nPrefix}.reorder_aria`,
                    "Tile {tile}, position {n} of {total}. Drag or use arrow keys to reorder, Enter to remove.",
                )
                    .replace("{tile}", label)
                    .replace("{n}", String(slotIndex + 1))
                    .replace("{total}", String(total))}
            >
                {label}
            </button>
            {renderTileExtra?.(slotIndex, tileIndex)}
            {!submitted && (
                <button
                    type="button"
                    className="inline-flex min-h-11 min-w-6 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent px-0.5 text-[var(--fg-muted)] enabled:hover:bg-[var(--surface-2)] enabled:hover:text-[var(--accent-text)] disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => onMove(slotIndex, slotIndex + 1)}
                    disabled={slotIndex === total - 1}
                    tabIndex={-1}
                    aria-label={t(`${i18nPrefix}.move_right`, "Move right")}
                    data-testid={`${testIdPrefix}-move-right-${slotIndex}`}
                >
                    <ChevronRight size={14} aria-hidden="true" />
                </button>
            )}
        </li>
    );
}

function TileScrambledRow({
    scrambledIndices,
    tiles,
    submitted,
    t,
    i18nPrefix,
    testIdPrefix,
    monospace,
    onPlace,
}: {
    scrambledIndices: number[];
    tiles: string[];
    submitted: boolean;
    t: Translate;
    i18nPrefix: string;
    testIdPrefix: string;
    monospace: boolean;
    onPlace: (index: number) => void;
}) {
    return (
        <div
            className="rounded-sm border border-border bg-[var(--surface)] p-2"
            data-testid={`${testIdPrefix}-scrambled-row`}
            aria-label={t(`${i18nPrefix}.scrambled_label`, "Available tiles")}
        >
            {scrambledIndices.length === 0 ? (
                <p
                    className="m-0 p-2 text-center text-sm text-[var(--fg-muted)]"
                    data-testid={`${testIdPrefix}-scrambled-empty`}
                >
                    {t(`${i18nPrefix}.scrambled_done`, "All tiles placed.")}
                </p>
            ) : (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {scrambledIndices.map((tileIndex) => (
                        <li key={tileIndex}>
                            <button
                                type="button"
                                className={cn(WORD_TILE_BASE, "h-full", monospace && "font-mono")}
                                onClick={() => onPlace(tileIndex)}
                                disabled={submitted}
                                data-testid={`${testIdPrefix}-scrambled-${tileIndex}`}
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

export interface TileSequenceEditorProps {
    submitted: boolean;
    sensors: ReturnType<typeof useSensors>;
    placed: number[];
    tiles: string[];
    scrambledIndices: number[];
    placedListRef: Ref<HTMLUListElement>;
    reduceMotion: boolean;
    activeId: number | null;
    isCorrect: boolean;
    t: Translate;
    /** i18n key prefix, e.g. ``"lesson.exercise.al_ordering"``. */
    i18nPrefix: string;
    /** Testid prefix, e.g. ``"ordering"`` → ``ordering-answer-row`` etc. */
    testIdPrefix: string;
    /** Monospace tile text (``ext:al-parsons`` code lines). */
    monospace?: boolean;
    onDragStart: (event: DragStartEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onDragCancel: () => void;
    onPlace: (index: number) => void;
    onRemove: (index: number) => void;
    onMove: (from: number, to: number) => void;
    onKeyReorder: (slot: number, e: React.KeyboardEvent<HTMLButtonElement>) => void;
    /** Extra content rendered inside each placed tile (parsons' indent stepper). */
    renderTileExtra?: (slot: number, tileIndex: number) => ReactNode;
}

/** The pre-check editing surface: instructions, the drag-and-drop answer
 *  row, and the scrambled tile bank. Self-gated — renders ``null`` once
 *  the answer is submitted, mirroring ``WordTilesEditor``. */
export function TileSequenceEditor({
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
    i18nPrefix,
    testIdPrefix,
    monospace = false,
    onDragStart,
    onDragEnd,
    onDragCancel,
    onPlace,
    onRemove,
    onMove,
    onKeyReorder,
    renderTileExtra,
}: TileSequenceEditorProps) {
    if (submitted) return null;
    return (
        <>
            <p
                className="m-0 text-[0.8125rem] text-[var(--fg-muted)]"
                data-testid={`${testIdPrefix}-instructions`}
            >
                {t(
                    `${i18nPrefix}.instructions`,
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
                    data-testid={`${testIdPrefix}-answer-row`}
                    aria-label={t(`${i18nPrefix}.answer_label`, "Your answer")}
                    aria-live="polite"
                >
                    {placed.length === 0 ? (
                        <p
                            className="m-0 p-2 text-center text-sm italic text-[var(--fg-muted)]"
                            data-testid={`${testIdPrefix}-answer-empty`}
                        >
                            {t(
                                `${i18nPrefix}.answer_placeholder`,
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
                                        i18nPrefix={i18nPrefix}
                                        testIdPrefix={testIdPrefix}
                                        monospace={monospace}
                                        onRemove={onRemove}
                                        onMove={onMove}
                                        onKeyReorder={onKeyReorder}
                                        renderTileExtra={renderTileExtra}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    )}
                </div>

                <DragOverlay>
                    {activeId !== null ? (
                        <div
                            className={cn(WORD_TILE_BASE, WORD_TILE_PLACED, monospace && "font-mono")}
                            data-testid={`${testIdPrefix}-drag-overlay`}
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

            <TileScrambledRow
                scrambledIndices={scrambledIndices}
                tiles={tiles}
                submitted={submitted}
                t={t}
                i18nPrefix={i18nPrefix}
                testIdPrefix={testIdPrefix}
                monospace={monospace}
                onPlace={onPlace}
            />
        </>
    );
}

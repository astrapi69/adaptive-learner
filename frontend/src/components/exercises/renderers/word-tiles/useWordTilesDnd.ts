/**
 * useWordTilesDnd (#1776 — extracted from WordTilesExercise.tsx).
 *
 * Owns the drag-and-drop mechanics of the Word-Tiles exercise:
 * the deterministic display shuffle, the @dnd-kit sensor setup,
 * the drag-overlay + keyboard-focus state, and every
 * place / remove / reorder handler. The ANSWER state
 * (``placed``) stays in the renderer — it feeds the scoring
 * closure of ``useControlledExercise`` — so this hook receives
 * it by reference and never owns it.
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
 */

import {
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {arrayMove} from "@dnd-kit/sortable";
import type {Ref} from "react";
import {useEffect, useMemo, useRef, useState} from "react";

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

export interface UseWordTilesDndOptions {
    /** Exercise id — keys the per-mount shuffle seed. */
    exerciseId: string;
    /** Canonical ordered tile list from the schema. */
    tiles: readonly string[];
    /** The learner's placed-index sequence (owned by the renderer). */
    placed: number[];
    /** State setter for ``placed`` (owned by the renderer). */
    setPlaced: React.Dispatch<React.SetStateAction<number[]>>;
    /** True once the answer is checked — every handler no-ops. */
    submitted: boolean;
}

export interface UseWordTilesDndResult {
    /** @dnd-kit sensor set (PointerSensor, 5px activation). */
    sensors: ReturnType<typeof useSensors>;
    /** Tile index currently pointer-dragged (drives the DragOverlay). */
    activeId: number | null;
    /** Ref for the placed-tile list, used for focus restoration. */
    placedListRef: Ref<HTMLUListElement>;
    /** Snapshot of ``prefers-reduced-motion`` at mount. */
    reduceMotion: boolean;
    /** Display-shuffled indices of the not-yet-placed tiles. */
    scrambledIndices: number[];
    /** Place a scrambled tile at the end of the answer row. */
    handlePlace: (index: number) => void;
    /** Return a placed tile to the scrambled bar. */
    handleReturn: (index: number) => void;
    /** Move the placed tile at ``from`` to position ``to``. */
    reorder: (from: number, to: number) => void;
    /** Arrow-key reorder handler for a placed tile at ``slot``. */
    handleTileKeyDown: (
        slot: number,
        e: React.KeyboardEvent<HTMLButtonElement>,
    ) => void;
    handleDragStart: (event: DragStartEvent) => void;
    handleDragEnd: (event: DragEndEvent) => void;
    handleDragCancel: () => void;
}

/**
 * Drag-and-drop orchestration for the Word-Tiles exercise.
 *
 * @example
 * const [placed, setPlaced] = useState<number[]>([]);
 * const dnd = useWordTilesDnd({
 *     exerciseId: exercise.id, tiles, placed, setPlaced, submitted,
 * });
 * <WordTilesEditor sensors={dnd.sensors} onPlace={dnd.handlePlace} ... />
 */
export function useWordTilesDnd({
    exerciseId,
    tiles,
    placed,
    setPlaced,
    submitted,
}: UseWordTilesDndOptions): UseWordTilesDndResult {
    // Stable seed per-mount so the scrambled bar doesn't
    // re-shuffle on every render.
    const [shuffleSeed] = useState(
        () => `${exerciseId}#${Date.now() & 0xffff}`,
    );

    /** Display order = shuffled permutation of [0..tiles.length-1].
     *  The scrambled bar iterates this list (and skips any
     *  index that is currently placed). The answer row
     *  iterates ``placed`` in user-tap order. */
    const displayOrder: number[] = useMemo(() => {
        const indices = Array.from({length: tiles.length}, (_, i) => i);
        return _shuffle(indices, shuffleSeed);
    }, [tiles.length, shuffleSeed]);

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

    return {
        sensors,
        activeId,
        placedListRef,
        reduceMotion,
        scrambledIndices,
        handlePlace,
        handleReturn,
        reorder,
        handleTileKeyDown,
        handleDragStart,
        handleDragEnd,
        handleDragCancel: () => setActiveId(null),
    };
}

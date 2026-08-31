/**
 * Word-Tiles concern group (#1776, #2820) — the DnD hook, the pre-check
 * editing surface, the post-check feedback surfaces, and the shared
 * tile styling / answer view. The renderer (``WordTilesExercise.tsx``)
 * lives alongside this barrel in the same folder (#2820 completed the
 * concern grouping the earlier split left half-done).
 */

export {applyDragReorder, useWordTilesDnd} from "./useWordTilesDnd";
export type {
    UseWordTilesDndOptions,
    UseWordTilesDndResult,
} from "./useWordTilesDnd";
export {WordTilesEditor, WordTilesScrambledRow} from "./word-tiles-editor";
export type {WordTilesEditorProps} from "./word-tiles-editor";
export {
    WordTilesHint,
    WordTilesResult,
    WordTilesReveal,
    type Translate,
} from "./word-tiles-feedback";
export {
    WORD_TILE_BASE,
    WORD_TILE_PLACED,
    WordTilesAnswerView,
} from "./word-tiles-parts";

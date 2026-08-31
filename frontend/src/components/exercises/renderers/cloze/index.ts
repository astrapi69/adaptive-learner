/**
 * Cloze concern group (#1782, #2820) — shared types, the editing/display
 * surfaces, and the post-check feedback surfaces. The renderer
 * (``ClozeExercise.tsx``) and the ``multiselect`` branch
 * (``ClozeMultiSelect.tsx``) live alongside this barrel in the same
 * folder (#2820 completed the concern grouping the earlier split left
 * half-done).
 */

export type {ClozeBlank} from "./cloze-types";
export {
    ClozePromptRow,
    ClozeSelectChoices,
    ClozeSentence,
} from "./cloze-editor";
export {ClozeHint, ClozeResult} from "./cloze-feedback";

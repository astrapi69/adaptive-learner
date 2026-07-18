/**
 * Cloze concern group (#1782) — shared types, the editing/display
 * surfaces, and the post-check feedback surfaces. The renderer itself
 * stays one level up (``renderers/ClozeExercise.tsx``) beside its
 * exercise siblings, as does the ``multiselect`` branch
 * (``renderers/ClozeMultiSelect.tsx``, kept in place so its direct
 * test import stays untouched).
 */

export type {ClozeBlank} from "./cloze-types";
export {
    ClozePromptRow,
    ClozeSelectChoices,
    ClozeSentence,
} from "./cloze-editor";
export {ClozeHint, ClozeResult} from "./cloze-feedback";

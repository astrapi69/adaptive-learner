/**
 * Shared Cloze types (#1782 — extracted from ClozeExercise.tsx).
 */

import type {ContentLessonExercise} from "../../../../storage/types";

/** One blank's authored metadata (accept list, hint, placeholder). */
export type ClozeBlank = NonNullable<ContentLessonExercise["blanks"]>[number];

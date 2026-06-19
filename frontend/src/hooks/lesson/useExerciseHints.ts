/**
 * useExerciseHints — app glue between the pure hint generator and the
 * presentational ``shared/HintButton`` (#590).
 *
 * Reads the user's hint preferences (enabled + XP cost), generates the
 * staged hints for an exercise, and formats them with i18n. Returns an
 * empty hint list when hints are disabled or none can be derived, so
 * the caller can simply render a HintButton (which hides itself on an
 * empty list).
 */

import {useMemo} from "react";

import {useI18n} from "../ui/useI18n";
import {formatHint, generateHints} from "../../lib/hints/generate-hint";
import {readHintsEnabled, readHintXpCost} from "../../lib/hints/hintPref";
import type {ContentLessonExercise} from "../../storage/types";

export interface ExerciseHintsResult {
    /** Ready-to-display, ordered hint strings (empty when off/none). */
    hints: string[];
    /** Configured XP cost per hint. */
    xpCost: number;
    /** Whether hints are enabled in settings. When false the caller shows
     *  the disabled "feature unavailable" affordance instead of hiding it
     *  (feature-state policy #335 / #624). */
    available: boolean;
    /** Whether this exercise *would* yield hints if enabled — lets the
     *  caller surface the disabled affordance only where it is relevant. */
    hasHints: boolean;
}

export function useExerciseHints(
    exercise: ContentLessonExercise,
): ExerciseHintsResult {
    const {t, lang} = useI18n();
    return useMemo(() => {
        const generated = generateHints(exercise);
        const hasHints = generated.length > 0;
        if (!readHintsEnabled()) {
            return {hints: [], xpCost: 0, available: false, hasHints};
        }
        const hints = generated.map((h) => formatHint(h, t));
        return {hints, xpCost: readHintXpCost(), available: true, hasHints};
        // lang is in deps so hints re-format on a language switch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exercise, lang]);
}

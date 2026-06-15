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

import {useI18n} from "./useI18n";
import {formatHint, generateHints} from "../lib/hints/generate-hint";
import {readHintsEnabled, readHintXpCost} from "../lib/hints/hintPref";
import type {ContentLessonExercise} from "../storage/types";

export interface ExerciseHintsResult {
    /** Ready-to-display, ordered hint strings (empty when off/none). */
    hints: string[];
    /** Configured XP cost per hint. */
    xpCost: number;
}

export function useExerciseHints(
    exercise: ContentLessonExercise,
): ExerciseHintsResult {
    const {t, lang} = useI18n();
    return useMemo(() => {
        if (!readHintsEnabled()) return {hints: [], xpCost: 0};
        const hints = generateHints(exercise).map((h) => formatHint(h, t));
        return {hints, xpCost: readHintXpCost()};
        // lang is in deps so hints re-format on a language switch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exercise, lang]);
}

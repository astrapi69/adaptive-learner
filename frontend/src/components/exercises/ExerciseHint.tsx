/**
 * ExerciseHint — the per-exercise hint affordance (#590). Wires the
 * pure hint generator + user prefs (via useExerciseHints) to the
 * presentational shared/HintButton, with the i18n labels.
 *
 * Renders nothing once the answer is submitted (hints are a pre-answer
 * aid) or when no hint can be derived / hints are disabled. Drop it into
 * any renderer's prompt area.
 */

import HintButton from "../../shared/HintButton";
import {useExerciseHints} from "../../hooks/useExerciseHints";
import {useI18n} from "../../hooks/useI18n";
import type {ContentLessonExercise} from "../../storage/types";

export interface ExerciseHintProps {
    exercise: ContentLessonExercise;
    /** Hide once the answer is checked. */
    submitted: boolean;
    testId?: string;
}

export default function ExerciseHint({
    exercise,
    submitted,
    testId,
}: ExerciseHintProps) {
    const {t} = useI18n();
    const {hints, xpCost} = useExerciseHints(exercise);
    if (submitted || hints.length === 0) return null;
    return (
        <HintButton
            hints={hints}
            revealLabel={t("hints.reveal", "Show a hint")}
            costLabel={
                xpCost > 0
                    ? t("hints.cost", "−{n} XP").replace("{n}", String(xpCost))
                    : undefined
            }
            testId={testId ?? "exercise-hint"}
        />
    );
}

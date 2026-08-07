/**
 * ExerciseHint — the per-exercise hint affordance (#590, economy #594).
 * Wires the pure hint generator + user prefs (via useExerciseHints) to the
 * presentational shared/HintButton, with the i18n labels.
 *
 * On each reveal it charges the configured XP cost (#594 Hint Economy):
 * the spend is self-contained here, so every surface that renders the hint
 * (main lesson, review, adaptive, error-replay) deducts XP without extra
 * wiring. The reveal also records hint usage for the active exercise so the
 * lesson's recordBulk / step-result can shorten the SRS interval and count
 * the hint. A non-blocking ``XP_SPENT_EVENT`` flashes the header badge red.
 *
 * Renders nothing once the answer is submitted (hints are a pre-answer
 * aid) or when no hint can be derived. When hints are *disabled* in
 * settings but this exercise would have one, it renders a disabled
 * "Hints are off" affordance with a reason rather than hiding (feature-
 * state policy #335 / #624). Drop it into any renderer's prompt area.
 */

import HintButton from "../../../shared/gamification/HintButton";
import { useExerciseHints } from "../../../hooks/lesson/interaction/useExerciseHints";
import { useLessonMode } from "../../../hooks/lesson/modes/useLessonMode";
import { useI18n } from "../../../hooks/ui/useI18n";
import { emitXpSpent } from "../../../lib/gamification/xp-spent-event";
import { markHintUsed } from "../../../lib/hints/hint-usage";
import { exerciseIdentityOf } from "../../../lib/srs/exercise-identity";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { getStorage } from "../../../storage";
import type { ContentLessonExercise } from "../../../storage/types";

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
    const {showHints} = useLessonMode();
    const {hints, xpCost, available, hasHints} = useExerciseHints(exercise);
    // Hints are a scaffolding aid — hidden in modes that disable them (#1011).
    if (!showHints) return null;
    if (submitted) return null;

    // Hints turned off in settings: show the disabled affordance with a
    // reason (only where a hint would otherwise be offered), never hide it.
    if (!available) {
        if (!hasHints) return null;
        return (
            <HintButton
                hints={[]}
                revealLabel={t("hints.reveal", "Show a hint")}
                disabled
                disabledLabel={t(
                    "hints.disabled",
                    "Hints are off. Enable them in Settings.",
                )}
                testId={testId ?? "exercise-hint"}
            />
        );
    }

    if (hints.length === 0) return null;

    const handleReveal = () => {
        // Record usage for this exercise so the lesson's recordBulk +
        // step-result can mark the SRS row + count the hint (#594). Keyed by
        // the same identity the attempts carry (#2130: stable_id ?? id).
        markHintUsed(exerciseIdentityOf(exercise) ?? exercise.id);
        if (xpCost <= 0) return;
        const userId = readLearnerState().userId;
        if (!userId) return;
        // Deduct + flash. Best-effort: a spend failure never blocks the
        // learner from reading the hint they asked for.
        void getStorage()
            .gamification.spendXp(userId, xpCost, "hint_revealed")
            .then(() => emitXpSpent(xpCost, "hint_revealed"))
            .catch(() => {
                /* XP is supplementary; the hint still shows */
            });
    };

    return (
        <HintButton
            hints={hints}
            revealLabel={t("hints.reveal", "Show a hint")}
            costLabel={
                xpCost > 0
                    ? t("hints.cost", "−{n} XP").replace("{n}", String(xpCost))
                    : undefined
            }
            onReveal={handleReveal}
            testId={testId ?? "exercise-hint"}
        />
    );
}

/**
 * useLessonCombo (#2874) - lesson-scoped combo state fed by the
 * celebration bus. Mounted ONCE per lesson page (the chip and the
 * summary read the same state); ``enabled`` gates the subscription
 * on playful mode so the reducer never runs outside the game mode.
 * Exam mode needs no extra gate: per-answer celebrations are not
 * emitted there, so the combo correctly stays silent.
 *
 * @example
 * const {combo, resetCombo} = useLessonCombo(modeConfig.playful);
 */

import {useCallback, useEffect, useState} from "react";

import {
    comboAfterAnswer,
    initialCombo,
    type ComboState,
} from "../../lib/lesson/combo";
import {subscribeCelebration} from "../../lib/praise/celebration-bus";

export interface LessonCombo {
    combo: ComboState;
    /** Reset for a new lesson (or a restart). */
    resetCombo: () => void;
}

export function useLessonCombo(enabled: boolean): LessonCombo {
    const [combo, setCombo] = useState<ComboState>(initialCombo);

    useEffect(() => {
        if (!enabled) return;
        return subscribeCelebration((event) => {
            if (event.type === "answer_correct") {
                setCombo((prev) => comboAfterAnswer(prev, true));
            } else if (event.type === "answer_wrong") {
                setCombo((prev) => comboAfterAnswer(prev, false));
            }
        });
    }, [enabled]);

    const resetCombo = useCallback(() => setCombo(initialCombo()), []);

    return {combo, resetCombo};
}

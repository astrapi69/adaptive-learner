/**
 * useLessonHearts (#2878) - lesson-scoped lives fed by the celebration
 * bus, the game-mode hearts system. Mounted once per lesson page;
 * ``enabled`` gates the subscription so hearts only fall during the
 * live run (the caller passes ``false`` on the summary, which also
 * keeps the correction-round drills from costing hearts). Exam mode
 * needs no extra gate: per-answer celebrations are not emitted there.
 *
 * The countdown expiry path (#2878) emits a wrong-answer celebration
 * on the same bus, so an expired timer costs a heart through the one
 * subscription below - no second decrement channel exists.
 *
 * @example
 * const {hearts, depleted, resetHearts} = useLessonHearts(active, 3);
 */

import {useCallback, useEffect, useState} from "react";

import {subscribeCelebration} from "../../lib/praise/celebration-bus";

export interface LessonHearts {
    /** Remaining lives, 0..maxHearts. */
    hearts: number;
    /** The configured maximum this run started with. */
    maxHearts: number;
    /** True once the run is out of hearts. */
    depleted: boolean;
    /** Refill for a restart, to the CURRENT max. */
    resetHearts: () => void;
}

export function useLessonHearts(
    enabled: boolean,
    maxHearts: number,
): LessonHearts {
    const [hearts, setHearts] = useState<number>(maxHearts);

    useEffect(() => {
        if (!enabled) return;
        return subscribeCelebration((event) => {
            if (event.type === "answer_wrong") {
                setHearts((prev) => Math.max(0, prev - 1));
            }
        });
    }, [enabled]);

    const resetHearts = useCallback(
        () => setHearts(maxHearts),
        [maxHearts],
    );

    return {
        hearts,
        maxHearts,
        depleted: enabled && hearts === 0,
        resetHearts,
    };
}

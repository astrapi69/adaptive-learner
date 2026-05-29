/**
 * useCountUp (EXP-008 / Phase 55C).
 *
 * Animates an integer from 0 up to ``target`` over ``durationMs``
 * using ``requestAnimationFrame`` with an ease-out curve. Returns
 * the current value for rendering.
 *
 * Under ``prefers-reduced-motion`` (or when ``enabled`` is false)
 * it jumps straight to the target - no animation, no rAF loop.
 */

import {useEffect, useState} from "react";

import {prefersReducedMotion} from "../lib/feedback/feedbackPref";

export function useCountUp(
    target: number,
    durationMs = 1000,
    enabled = true,
): number {
    const reduced = prefersReducedMotion();
    const instant = !enabled || reduced || durationMs <= 0 || target <= 0;
    const [value, setValue] = useState<number>(instant ? target : 0);

    useEffect(() => {
        if (instant) {
            setValue(target);
            return;
        }
        let raf = 0;
        let start: number | null = null;
        const step = (ts: number) => {
            if (start === null) start = ts;
            const elapsed = ts - start;
            const progress = Math.min(1, elapsed / durationMs);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(target * eased));
            if (progress < 1) {
                raf = requestAnimationFrame(step);
            } else {
                setValue(target);
            }
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, durationMs, instant]);

    return value;
}

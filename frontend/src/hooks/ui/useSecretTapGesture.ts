/**
 * A hidden multi-tap activation gesture.
 *
 * Fires ``onTrigger`` once ``taps`` pointer-downs land within ``windowMs`` of
 * one another. The short window makes an accidental trigger from ordinary
 * taps effectively impossible while staying reachable on a phone (no keyboard,
 * no hover). When ``enabled`` is false the returned handler is inert.
 *
 * Returns a handler to spread onto the target element:
 * ``<div {...gesture}>…</div>``.
 *
 * @example
 * const gesture = useSecretTapGesture({taps: 6, windowMs: 2000, onTrigger: enable});
 */

import {useCallback, useRef} from "react";

export interface SecretTapGestureOptions {
    /** Number of taps required within the window. */
    taps: number;
    /** Max gap (ms) between consecutive taps before the count resets. */
    windowMs: number;
    /** Called once when the tap count reaches ``taps`` in time. */
    onTrigger: () => void;
    /** When false, taps are ignored. Defaults to true. */
    enabled?: boolean;
}

export interface SecretTapGestureHandlers {
    onPointerDown: () => void;
}

export function useSecretTapGesture({
    taps,
    windowMs,
    onTrigger,
    enabled = true,
}: SecretTapGestureOptions): SecretTapGestureHandlers {
    const countRef = useRef(0);
    const lastRef = useRef(0);

    const onPointerDown = useCallback(() => {
        if (!enabled) return;
        const now = Date.now();
        if (now - lastRef.current > windowMs) countRef.current = 0;
        lastRef.current = now;
        countRef.current += 1;
        if (countRef.current >= taps) {
            countRef.current = 0;
            onTrigger();
        }
    }, [enabled, taps, windowMs, onTrigger]);

    return {onPointerDown};
}

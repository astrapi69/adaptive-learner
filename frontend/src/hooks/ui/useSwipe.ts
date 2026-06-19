/**
 * v1.10.0 / Phase 23A — reusable horizontal-swipe hook.
 *
 * Attach the returned ref to a container; the hook listens for
 * passive touch events on it and fires ``onSwipeLeft`` /
 * ``onSwipeRight`` callbacks when the user completes a
 * horizontal swipe gesture.
 *
 * Design notes:
 *
 * - **Horizontal-only.** A swipe registers only if
 *   ``|dx| > |dy|`` so vertical scroll is never hijacked. The
 *   page-level scroll wins by default; the hook only acts when
 *   the user's intent is clearly horizontal.
 * - **Threshold.** Default 50 px on the X-axis. With
 *   ``prefers-reduced-motion``, the threshold doubles to 100 px
 *   so motion-sensitive users do not trigger gestures
 *   accidentally.
 * - **Velocity gate.** Slow drags below ~0.15 px/ms are
 *   ignored; a real swipe is a quick flick, not a careful
 *   drag-and-release.
 * - **Passive listeners.** ``{passive: true}`` so the browser
 *   keeps scroll on the compositor thread.
 * - **enabled flag.** When ``false``, the listeners are
 *   detached entirely. Lets the Settings toggle disable the
 *   feature without unmounting consumers.
 */

import {useEffect, useRef} from "react";

export interface UseSwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    /** Minimum horizontal distance (px) to count as a swipe. */
    threshold?: number;
    /** Minimum px/ms velocity at touchend. */
    velocityThreshold?: number;
    /** When false, listeners are not attached. */
    enabled?: boolean;
}

export interface UseSwipeResult<T extends HTMLElement> {
    ref: React.RefObject<T | null>;
}

const DEFAULT_THRESHOLD = 50;
const REDUCED_MOTION_THRESHOLD = 100;
const DEFAULT_VELOCITY = 0.15; // px/ms

function prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useSwipe<T extends HTMLElement = HTMLDivElement>(
    options: UseSwipeOptions,
): UseSwipeResult<T> {
    const ref = useRef<T | null>(null);
    // Keep callbacks in a ref so the listener doesn't need to
    // re-attach when only the callback identity changes (consumers
    // commonly pass inline arrow functions).
    const optionsRef = useRef(options);
    optionsRef.current = options;

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        if (options.enabled === false) return;

        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let lastX = 0;
        let lastY = 0;
        let tracking = false;

        const handleStart = (event: TouchEvent) => {
            const t = event.touches[0];
            if (!t) return;
            startX = t.clientX;
            startY = t.clientY;
            lastX = startX;
            lastY = startY;
            startTime = Date.now();
            tracking = true;
        };

        const handleMove = (event: TouchEvent) => {
            if (!tracking) return;
            const t = event.touches[0];
            if (!t) return;
            lastX = t.clientX;
            lastY = t.clientY;
        };

        const handleEnd = () => {
            if (!tracking) return;
            tracking = false;
            const dx = lastX - startX;
            const dy = lastY - startY;
            const elapsed = Math.max(1, Date.now() - startTime);
            const velocity = Math.abs(dx) / elapsed;

            const threshold =
                optionsRef.current.threshold ??
                (prefersReducedMotion()
                    ? REDUCED_MOTION_THRESHOLD
                    : DEFAULT_THRESHOLD);
            const velocityFloor =
                optionsRef.current.velocityThreshold ?? DEFAULT_VELOCITY;

            // Horizontal intent: |dx| must beat |dy| AND the
            // threshold AND the velocity floor.
            if (Math.abs(dx) <= Math.abs(dy)) return;
            if (Math.abs(dx) < threshold) return;
            if (velocity < velocityFloor) return;

            if (dx < 0) optionsRef.current.onSwipeLeft?.();
            else optionsRef.current.onSwipeRight?.();
        };

        const handleCancel = () => {
            tracking = false;
        };

        node.addEventListener("touchstart", handleStart, {passive: true});
        node.addEventListener("touchmove", handleMove, {passive: true});
        node.addEventListener("touchend", handleEnd, {passive: true});
        node.addEventListener("touchcancel", handleCancel, {passive: true});

        return () => {
            node.removeEventListener("touchstart", handleStart);
            node.removeEventListener("touchmove", handleMove);
            node.removeEventListener("touchend", handleEnd);
            node.removeEventListener("touchcancel", handleCancel);
        };
    }, [options.enabled]);

    return {ref};
}

/**
 * Subtle haptic feedback for a successful swipe. No-op on
 * platforms without ``navigator.vibrate``.
 */
export function hapticSwipe(): void {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
            navigator.vibrate(10);
        } catch {
            /* ignore */
        }
    }
}

/**
 * AnimatedCounter — counts an integer up to ``value`` on mount /
 * change, with an ease-out curve via ``requestAnimationFrame``.
 *
 * App-agnostic and self-contained: it reads ``prefers-reduced-motion``
 * itself (and honours ``enabled``), jumping straight to the target
 * with no animation when motion is reduced. Reusable for XP gains,
 * scores, counters of any kind. Renders a ``<span>`` with the current
 * value; pass ``format`` to wrap/format it.
 *
 * @example
 * <AnimatedCounter value={220} durationMs={1000} format={(n) => `+${n} XP`} />
 */

import {useEffect, useRef, useState} from "react";

export interface AnimatedCounterProps {
    /** Target value to count up to. */
    value: number;
    /** Animation duration in ms. Default 1000. */
    durationMs?: number;
    /** Disable the animation (jump to target). Default true = animate. */
    enabled?: boolean;
    /** Format the current value for display. */
    format?: (n: number) => React.ReactNode;
    className?: string;
    testId?: string;
    /** Accessible label; defaults to the final value via aria-live. */
    ariaLabel?: string;
}

function reducedMotion(): boolean {
    try {
        return (
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    } catch {
        return false;
    }
}

export default function AnimatedCounter({
    value,
    durationMs = 1000,
    enabled = true,
    format,
    className,
    testId = "animated-counter",
    ariaLabel,
}: AnimatedCounterProps) {
    const instant = !enabled || durationMs <= 0 || value <= 0 || reducedMotion();
    const [current, setCurrent] = useState<number>(instant ? value : 0);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (instant) {
            setCurrent(value);
            return;
        }
        let start: number | null = null;
        const step = (ts: number) => {
            if (start === null) start = ts;
            const progress = Math.min(1, (ts - start) / durationMs);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(Math.round(value * eased));
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                setCurrent(value);
            }
        };
        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
    }, [value, durationMs, instant]);

    return (
        <span
            className={className}
            data-testid={testId}
            aria-label={ariaLabel}
        >
            {format ? format(current) : current}
        </span>
    );
}

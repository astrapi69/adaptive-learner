/**
 * FeedbackPulse — a brief, app-agnostic motion wrapper for answer
 * feedback: a ``success`` pulse (scale) or an ``error`` shake
 * (translate), played once on mount via the Web Animations API.
 *
 * Self-contained: it reads ``prefers-reduced-motion`` and skips the
 * animation entirely when motion is reduced (the wrapped content
 * still renders). No CSS dependency, no color of its own — the caller
 * supplies the (token-colored) children. Reusable for any
 * correct/incorrect micro-feedback.
 *
 * @example
 * <FeedbackPulse variant="success"><Check className="text-[var(--success-fg)]" /></FeedbackPulse>
 */

import {useEffect, useRef} from "react";

export type FeedbackVariant = "success" | "error";

export interface FeedbackPulseProps {
    variant: FeedbackVariant;
    children?: React.ReactNode;
    className?: string;
    testId?: string;
}

const KEYFRAMES: Record<FeedbackVariant, Keyframe[]> = {
    success: [
        {transform: "scale(1)"},
        {transform: "scale(1.18)"},
        {transform: "scale(1)"},
    ],
    error: [
        {transform: "translateX(0)"},
        {transform: "translateX(-4px)"},
        {transform: "translateX(4px)"},
        {transform: "translateX(-3px)"},
        {transform: "translateX(0)"},
    ],
};

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

export default function FeedbackPulse({
    variant,
    children,
    className,
    testId = "feedback-pulse",
}: FeedbackPulseProps) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || reducedMotion() || typeof el.animate !== "function") return;
        const anim = el.animate(KEYFRAMES[variant], {
            duration: variant === "success" ? 360 : 420,
            easing: "ease-in-out",
        });
        return () => anim.cancel();
    }, [variant]);

    return (
        <span
            ref={ref}
            className={className}
            data-testid={testId}
            data-variant={variant}
            style={{display: "inline-flex"}}
        >
            {children}
        </span>
    );
}

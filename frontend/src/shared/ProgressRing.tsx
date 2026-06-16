/**
 * ProgressRing — a generic circular (radial) progress indicator.
 *
 * App-agnostic and props-driven: pass a ``value`` / ``max`` and it
 * renders an accessible SVG ring (track + progress arc) with optional
 * center content. Colors come from design tokens, so it themes for
 * free. Reusable for level progress, mastery, download progress, any
 * "N of M" radial metric.
 *
 * @example
 * <ProgressRing value={3} max={5} ariaLabel="Level 3 progress">
 *   <strong>3</strong>
 * </ProgressRing>
 */

import type {ReactNode} from "react";

export interface ProgressRingProps {
    /** Current value. Clamped into ``[0, max]``. */
    value: number;
    /** Maximum value. Non-positive ``max`` renders an empty ring. */
    max: number;
    /** Outer diameter in px. Default 64. */
    size?: number;
    /** Ring thickness in px. Default 6. */
    strokeWidth?: number;
    /** Accessible name for the progressbar. */
    ariaLabel?: string;
    /** Optional center content (e.g. a level number or percentage). */
    children?: ReactNode;
    className?: string;
    testId?: string;
}

export default function ProgressRing({
    value,
    max,
    size = 64,
    strokeWidth = 6,
    ariaLabel,
    children,
    className,
    testId = "progress-ring",
}: ProgressRingProps) {
    const safeMax = max > 0 ? max : 0;
    const clamped = safeMax > 0 ? Math.min(Math.max(value, 0), safeMax) : 0;
    const fraction = safeMax > 0 ? clamped / safeMax : 0;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - fraction);
    const center = size / 2;

    return (
        <div
            className={className}
            data-testid={testId}
            role="progressbar"
            aria-label={ariaLabel}
            aria-valuenow={Math.round(clamped)}
            aria-valuemin={0}
            aria-valuemax={safeMax}
            style={{
                position: "relative",
                display: "inline-flex",
                width: size,
                height: size,
            }}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                aria-hidden="true"
            >
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{transition: "stroke-dashoffset 400ms ease"}}
                />
            </svg>
            {children != null && (
                <span
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--fg-primary)",
                    }}
                >
                    {children}
                </span>
            )}
        </div>
    );
}

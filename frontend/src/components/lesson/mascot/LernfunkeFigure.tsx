/**
 * Lernfunke figure (#2849) - the playful-mode mascot, a little
 * spark/flame drawn as an inline token-SVG so it recolors with
 * every theme (the #2847 umbrella guideline; unlike the Stufe-A
 * avatar presets this renders inline, so ``var()`` resolves).
 *
 * Pure presentational: the pose only changes the face and the
 * sparkles - motion lives on the wrapper (``LessonMascot``), so
 * reduced-motion users still see the expression change without
 * any animation.
 *
 * @param pose - Facial expression: idle, cheer (correct answer),
 *     encourage (wrong answer), celebrate (milestones).
 * @param size - Rendered width/height in px.
 * @param colors - Optional variant colors (#2861, token ``var()``
 *     values from the mascot-variant catalog); defaults to the
 *     classic funke scheme.
 *
 * @example
 * <LernfunkeFigure pose="cheer" size={40} />
 */

export const MASCOT_POSES = [
    "idle",
    "cheer",
    "encourage",
    "celebrate",
] as const;

export type MascotPose = (typeof MASCOT_POSES)[number];

export interface MascotColors {
    /** Body/flame fill (token ``var()`` value). */
    body: string;
    /** Celebrate-pose sparkle fill (token ``var()`` value). */
    spark: string;
}

export interface LernfunkeFigureProps {
    pose: MascotPose;
    size: number;
    colors?: MascotColors;
}

const DEFAULT_COLORS: MascotColors = {
    body: "var(--method-contextual)",
    spark: "var(--star)",
};
const INNER = "var(--bg-primary)";
const FACE = "var(--fg-primary)";

function Face({pose}: {pose: MascotPose}) {
    switch (pose) {
        case "cheer":
            return (
                <g stroke={FACE} strokeWidth="2.4" fill="none" strokeLinecap="round">
                    <path d="M24 36q3-3.6 6 0" />
                    <path d="M34 36q3-3.6 6 0" />
                    <path d="M27 43q5 4.4 10 0" />
                </g>
            );
        case "encourage":
            return (
                <g>
                    <circle cx="27" cy="36" r="1.9" fill={FACE} />
                    <circle cx="37" cy="36" r="1.9" fill={FACE} />
                    <circle
                        cx="32"
                        cy="44"
                        r="2.4"
                        stroke={FACE}
                        strokeWidth="2"
                        fill="none"
                    />
                </g>
            );
        case "celebrate":
            return (
                <g>
                    <path
                        d="M27 33l1.1 2.3 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z"
                        fill={FACE}
                    />
                    <path
                        d="M37 33l1.1 2.3 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z"
                        fill={FACE}
                    />
                    <path
                        d="M26 43q6 5.6 12 0"
                        stroke={FACE}
                        strokeWidth="2.4"
                        fill="none"
                        strokeLinecap="round"
                    />
                </g>
            );
        default:
            return (
                <g>
                    <circle cx="27" cy="36" r="2.2" fill={FACE} />
                    <circle cx="37" cy="36" r="2.2" fill={FACE} />
                    <path
                        d="M28 43q4 2.8 8 0"
                        stroke={FACE}
                        strokeWidth="2.2"
                        fill="none"
                        strokeLinecap="round"
                    />
                </g>
            );
    }
}

export default function LernfunkeFigure({
    pose,
    size,
    colors = DEFAULT_COLORS,
}: LernfunkeFigureProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M32 4c2.4 9.6 7.2 13 11.2 18 4 5 5.6 9 5.6 14a16.8 16.8 0 0 1-33.6 0c0-5.6 3.2-10 6.4-14.4C24.8 17 30 13.6 32 4z"
                fill={colors.body}
            />
            <path
                d="M32 26c3.6 5 6.4 7.6 6.4 12.4a6.4 6.4 0 0 1-12.8 0c0-4.8 2.8-7.4 6.4-12.4z"
                fill={INNER}
                opacity="0.35"
            />
            <Face pose={pose} />
            {pose === "celebrate" && (
                <g fill={colors.spark}>
                    <path d="M10 14l1.6 3.4 3.4 1.6-3.4 1.6L10 24l-1.6-3.4L5 19l3.4-1.6z" />
                    <path d="M54 10l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4z" />
                    <path d="M53 30l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" />
                </g>
            )}
        </svg>
    );
}

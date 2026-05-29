/**
 * Confetti (EXP-008 / Phase 55C).
 *
 * CSS-only celebration burst: a fixed number of small coloured
 * particles fall + rotate + fade over ~2s. NO canvas, NO external
 * library, zero bundle weight beyond this component + its
 * keyframes. Each particle's trajectory is randomised once at
 * mount via inline CSS custom properties; the animation itself
 * lives in global.css (``confetti-fall``).
 *
 * The component renders nothing under ``prefers-reduced-motion``
 * (motion-sensitive users get the instant state instead). Callers
 * additionally gate it on the feedback intensity (no confetti at
 * "subtle").
 *
 * It self-unmounts after the animation window via ``onDone`` so
 * the particles do not linger in the DOM.
 */

import {useEffect, useRef, useState} from "react";

import {prefersReducedMotion} from "../../lib/feedback/feedbackPref";

const PARTICLE_COUNT = 30;
const DURATION_MS = 2000;

// Confetti colours drawn from the accent / status palette.
const COLORS = [
    "var(--accent)",
    "var(--success)",
    "var(--warning)",
    "#fbbf24",
    "#ec4899",
    "#38bdf8",
];

export interface ConfettiProps {
    /** Called once the burst finishes (after ~2s) so the parent
     *  can drop the component from the tree. */
    onDone?: () => void;
}

interface Particle {
    left: number; // vw start position 0..100
    drift: number; // horizontal drift in px
    delay: number; // ms
    rotate: number; // deg
    duration: number; // ms
    color: string;
    round: boolean;
}

export default function Confetti({onDone}: ConfettiProps) {
    const reduced = prefersReducedMotion();
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    // Generate particles once. Randomness is fine in component
    // code (only the workflow runtime forbids Math.random).
    const [particles] = useState<Particle[]>(() => {
        if (reduced) return [];
        return Array.from({length: PARTICLE_COUNT}, (_, i) => ({
            left: Math.random() * 100,
            drift: (Math.random() - 0.5) * 160,
            delay: Math.random() * 250,
            rotate: (Math.random() - 0.5) * 720,
            duration: DURATION_MS - Math.random() * 500,
            color: COLORS[i % COLORS.length],
            round: Math.random() > 0.5,
        }));
    });

    useEffect(() => {
        if (reduced) {
            onDoneRef.current?.();
            return;
        }
        const id = window.setTimeout(() => {
            onDoneRef.current?.();
        }, DURATION_MS + 300);
        return () => window.clearTimeout(id);
    }, [reduced]);

    if (reduced || particles.length === 0) return null;

    return (
        <div
            className="confetti"
            aria-hidden="true"
            data-testid="confetti"
            data-particle-count={particles.length}
        >
            {particles.map((p, i) => (
                <span
                    key={i}
                    className={`confetti-piece${p.round ? " is-round" : ""}`}
                    style={
                        {
                            left: `${p.left}%`,
                            background: p.color,
                            "--confetti-drift": `${p.drift}px`,
                            "--confetti-rotate": `${p.rotate}deg`,
                            "--confetti-delay": `${p.delay}ms`,
                            "--confetti-duration": `${p.duration}ms`,
                        } as React.CSSProperties
                    }
                />
            ))}
        </div>
    );
}

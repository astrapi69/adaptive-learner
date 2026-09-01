/**
 * Mascot state (#2849): maps celebration-bus events onto the
 * Lernfunke's pose and speech bubble.
 *
 * - ``answer_correct`` -> cheer, ``answer_wrong`` -> encourage.
 *   Pose only, NO phrase: ``AnswerCelebration`` already shows the
 *   per-answer praise line, and its frequency counter
 *   (``nextCorrectAnswerIndex``) is read-and-increment - a second
 *   consumer would double-advance the cadence.
 * - Every other celebration type -> celebrate.
 * - ``lesson_complete`` additionally fills the bubble with a
 *   localized ``lesson_complete`` praise phrase (the one moment
 *   the mascot speaks; milestone TEXT stays with MilestoneOverlay).
 *
 * Poses decay back to idle; ``reactionKey`` advances per event so
 * a keyed wrapper restarts its CSS animation on repeats. While
 * ``enabled`` is false nothing is subscribed.
 */

import {useEffect, useRef, useState} from "react";

import {
    subscribeCelebration,
    type CelebrationEvent,
} from "../../../lib/praise/celebration-bus";
import {nextPraise} from "../../../lib/praise/phrase-picker";
import type {MascotPose} from "./LernfunkeFigure";

export interface MascotState {
    pose: MascotPose;
    bubble: string | null;
    reactionKey: number;
}

const ANSWER_DECAY_MS = 2500;
const CELEBRATE_DECAY_MS = 5000;

export function useMascotState(lang: string, enabled: boolean): MascotState {
    const [pose, setPose] = useState<MascotPose>("idle");
    const [bubble, setBubble] = useState<string | null>(null);
    const [reactionKey, setReactionKey] = useState(0);
    const decayRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const react = (
            nextPose: MascotPose,
            nextBubble: string | null,
            decayMs: number,
        ) => {
            setPose(nextPose);
            setBubble(nextBubble);
            setReactionKey((k) => k + 1);
            if (decayRef.current !== null) {
                window.clearTimeout(decayRef.current);
            }
            decayRef.current = window.setTimeout(() => {
                setPose("idle");
                setBubble(null);
                decayRef.current = null;
            }, decayMs);
        };

        const unsubscribe = subscribeCelebration((event: CelebrationEvent) => {
            switch (event.type) {
                case "answer_correct":
                    react("cheer", null, ANSWER_DECAY_MS);
                    break;
                case "answer_wrong":
                    react("encourage", null, ANSWER_DECAY_MS);
                    break;
                case "lesson_complete":
                    react(
                        "celebrate",
                        nextPraise("lesson_complete", lang)?.phrase ?? null,
                        CELEBRATE_DECAY_MS,
                    );
                    break;
                default:
                    react("celebrate", null, CELEBRATE_DECAY_MS);
            }
        });

        return () => {
            unsubscribe();
            if (decayRef.current !== null) {
                window.clearTimeout(decayRef.current);
                decayRef.current = null;
            }
        };
    }, [enabled, lang]);

    return {pose, bubble, reactionKey};
}

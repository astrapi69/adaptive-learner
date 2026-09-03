/**
 * useSummaryCelebration - the lesson summary's mount celebration in one
 * hook (extracted unchanged from ``LessonSummary``): the confetti gate,
 * the praise phrase picked ONCE at mount so it never reshuffles on a
 * re-render, the per-star encouraging headline, and the one-shot
 * celebration-bus emits on mount.
 *
 * ``immediateStars`` (first-pass) ties the burst to the completion
 * moment (#2479 - never re-triggered by a later correction);
 * ``stars`` (correction-adjusted final) drives the headline message.
 *
 * @example
 * const {celebrateConfetti, celebrateMessage} = useSummaryCelebration({
 *     immediateStars, stars, intensity, lang, t,
 * });
 */

import {useEffect, useRef, useState} from "react";

import {allowsConfetti} from "../../lib/feedback/feedbackPref";
import type {FeedbackIntensity} from "../../lib/feedback/feedbackPref";
import type {StarRating} from "../../lib/lesson/lesson-summary";
import {emitCelebration} from "../../lib/praise/celebration-bus";
import {nextPraise} from "../../lib/praise/phrase-picker";

const ENCOURAGE_FALLBACK: Record<StarRating, string> = {
    0: "Practice makes perfect!",
    1: "Good start - keep going!",
    2: "Almost perfect!",
    3: "Perfect score!",
};

export interface SummaryCelebrationInput {
    /** First-pass stars - the mount celebration + confetti follow these. */
    immediateStars: StarRating;
    /** Correction-adjusted final stars - the headline message follows these. */
    stars: StarRating;
    intensity: FeedbackIntensity;
    lang: string;
    t: (key: string, fallback: string) => string;
}

export function useSummaryCelebration({
    immediateStars,
    stars,
    intensity,
    lang,
    t,
}: SummaryCelebrationInput): {
    celebrateConfetti: boolean;
    celebrateMessage: string;
} {
    // Confetti only on a perfect (3-star) first pass, and only when the
    // intensity allows it. Self-dismisses after the burst.
    const celebrateConfetti = immediateStars === 3 && allowsConfetti(intensity);

    // The random "lesson_complete" praise phrase (perfect run + phrases
    // allowed) is picked ONCE, at the mount moment.
    const [mountPraisePhrase] = useState<string | null>(() => {
        if (immediateStars === 3 && intensity !== "subtle") {
            return nextPraise("lesson_complete", lang)?.phrase ?? null;
        }
        return null;
    });
    const celebrateMessage =
        stars === 3 && mountPraisePhrase
            ? mountPraisePhrase
            : t(`lesson.summary.encourage_${stars}`, ENCOURAGE_FALLBACK[stars]);

    // Fire the lesson-complete celebration sounds once on mount. The star
    // chime + confetti sparkle only on a perfect run.
    const celebrationFired = useRef(false);
    useEffect(() => {
        if (celebrationFired.current) return;
        celebrationFired.current = true;
        emitCelebration({
            type: "lesson_complete",
            payload: {stars: immediateStars},
        });
        if (immediateStars === 3) {
            emitCelebration({type: "stars_earned"});
            if (celebrateConfetti) emitCelebration({type: "confetti"});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {celebrateConfetti, celebrateMessage};
}

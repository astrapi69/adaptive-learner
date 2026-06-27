/**
 * AnswerCelebration (EXP-008 / Phase 55B).
 *
 * The single reusable home for the NEW per-answer micro-feedback
 * that every exercise renderer shares:
 *   - haptic pulse on a correct answer (correct only),
 *   - a short praise phrase below the answer, gated by the
 *     effective feedback intensity + frequency control.
 *
 * The information-carrying feedback (correct/wrong colour, icon,
 * token-diff) stays in each exercise component; this adds only
 * the supplementary delight, so a "subtle" intensity (or
 * ``prefers-reduced-motion``) simply renders nothing here.
 *
 * Centralising it here means later sub-phases (sound in 55F, the
 * celebration bus in 55G) extend ONE component, not five.
 *
 * The effect is guarded with a ref so React's dev/StrictMode
 * double-effect-mount cannot fire the haptic or advance the
 * phrase cycle twice (see lessons-learned).
 */

import {useEffect, useRef, useState} from "react";

import {Check, X} from "lucide-react";

import {useFeedbackIntensity} from "../../../hooks/settings/useFeedbackIntensity";
import {useLessonMode} from "../../../hooks/lesson/useLessonMode";
import {useI18n} from "../../../hooks/ui/useI18n";
import FeedbackPulse from "../../../shared/feedback/FeedbackPulse";
import {
    nextCorrectAnswerIndex,
    shouldPraiseCorrect,
} from "../../../lib/feedback/feedbackPref";
import {fireHaptic} from "../../../lib/feedback/haptic";
import {emitCelebration} from "../../../lib/praise/celebration-bus";
import {nextPraise} from "../../../lib/praise/phrase-picker";

export interface AnswerCelebrationProps {
    /** Whether the submitted answer was correct. */
    isCorrect: boolean;
}

export default function AnswerCelebration({
    isCorrect,
}: AnswerCelebrationProps) {
    const {lang} = useI18n();
    const intensity = useFeedbackIntensity();
    const {immediateFeedback} = useLessonMode();
    const [phrase, setPhrase] = useState<string | null>(null);
    const fired = useRef(false);

    useEffect(() => {
        // No immediate celebration in modes without immediate feedback (#1011).
        if (!immediateFeedback || fired.current) return;
        fired.current = true;
        // Route through the bus so the sound layer reacts
        // (sound self-gates on the sound preference).
        emitCelebration({
            type: isCorrect ? "answer_correct" : "answer_wrong",
        });
        if (!isCorrect) return;
        fireHaptic();
        const index = nextCorrectAnswerIndex();
        if (shouldPraiseCorrect(intensity, index)) {
            const picked = nextPraise("correct_answer", lang);
            if (picked) setPhrase(picked.phrase);
        }
    }, [isCorrect, intensity, lang, immediateFeedback]);

    // A green pulse on a correct answer / a red shake on a wrong one,
    // reusing the shared FeedbackPulse (no-op under reduced motion).
    // Gated on intensity so "subtle" stays silent (parity with praise).
    const showPulse = intensity !== "subtle";

    // Exam mode (#1007): suppress all immediate per-answer feedback.
    if (!immediateFeedback) return null;
    if (!showPulse && (!isCorrect || phrase === null)) return null;

    return (
        <>
            {showPulse && (
                <FeedbackPulse
                    variant={isCorrect ? "success" : "error"}
                    testId="answer-pulse"
                    className="answer-feedback-pulse"
                >
                    {isCorrect ? (
                        <Check
                            size={18}
                            aria-hidden="true"
                            style={{color: "var(--exercise-correct)"}}
                        />
                    ) : (
                        <X
                            size={18}
                            aria-hidden="true"
                            style={{color: "var(--exercise-wrong)"}}
                        />
                    )}
                </FeedbackPulse>
            )}
            {isCorrect && phrase !== null && (
                <p
                    className="answer-feedback-praise"
                    data-testid="answer-praise"
                    role="status"
                >
                    {phrase}
                </p>
            )}
        </>
    );
}

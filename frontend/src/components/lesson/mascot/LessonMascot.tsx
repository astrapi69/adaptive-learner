/**
 * LessonMascot (#2849) - the Lernfunke companion in the lesson
 * runner. Renders ONLY while playful mode is on (live via
 * ``usePlayfulMode``, so the Settings toggle and the lesson-start
 * hint take effect without a reload) and reacts to the
 * celebration bus: cheering on correct answers, encouraging on
 * wrong ones, celebrating milestones, and speaking one localized
 * praise phrase when the lesson completes.
 *
 * Motion is wrapper-level and ``motion-safe:`` gated (keyframes in
 * ``styles/legacy/43-mascot.css``); reduced-motion users still see
 * the pose change, just without animation.
 *
 * @param large - Bigger figure for the summary screen.
 *
 * @example
 * <LessonMascot large={isSummary} />
 */

import {useI18n} from "../../../hooks/ui/useI18n";
import {usePlayfulMode} from "../../../hooks/settings/usePlayfulMode";
import LernfunkeFigure from "./LernfunkeFigure";
import {useMascotState} from "./useMascotState";
import type {MascotPose} from "./LernfunkeFigure";

const POSE_ANIMATION: Record<MascotPose, string> = {
    idle: "",
    cheer: "motion-safe:animate-[lernfunke-hop_500ms_ease-out]",
    encourage: "motion-safe:animate-[lernfunke-wiggle_600ms_ease-in-out]",
    celebrate: "motion-safe:animate-[lernfunke-pop_700ms_ease-out]",
};

export interface LessonMascotProps {
    large?: boolean;
}

export default function LessonMascot({large = false}: LessonMascotProps) {
    const playful = usePlayfulMode();
    const {t, lang} = useI18n();
    const {pose, bubble, reactionKey} = useMascotState(lang, playful);

    if (!playful) return null;

    return (
        <div
            className="relative shrink-0 self-center"
            data-testid="lesson-mascot"
            data-pose={pose}
        >
            {bubble && (
                <div
                    role="status"
                    data-testid="lesson-mascot-bubble"
                    className="absolute right-0 top-full z-20 mt-1 max-w-[14rem] rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--fg-primary)] shadow-md"
                >
                    {bubble}
                </div>
            )}
            <span
                key={reactionKey}
                className={`inline-block ${POSE_ANIMATION[pose]}`}
                role="img"
                aria-label={t("lesson.mascot_label", "Your learning companion")}
                title={t("lesson.mascot_label", "Your learning companion")}
            >
                <LernfunkeFigure pose={pose} size={large ? 64 : 40} />
            </span>
        </div>
    );
}

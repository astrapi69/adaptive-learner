/**
 * /adaptive-lesson/:setId - adaptive lesson session
 * (Phase 53G / EXP-013 / F-115, F-116; on the LessonRunner shell since
 * EXP-052 slice 3, refs #3169).
 *
 * The full adaptive pipeline (analyse the learner's errors, build a pool,
 * generate a lesson) runs in ``useAdaptiveLesson``; the page owns only its
 * route params. ``useAdaptiveSource`` normalises the mode hook, the shell
 * renders header, progress, the controlled exercise, the footer, Enter
 * (new for this runner, which had none), the re-anchoring and the
 * answered-step lock with the adaptive policy (session header, Previous,
 * no pause, mode ``practice``). Two page-specific parts hang in:
 *
 * - F-115 transparency, before and during the lesson: the focus tags and
 *   the active-error count under the title (``headerExtra``). No black box.
 * - F-116 improvement indicator on the summary: the mastered-element delta
 *   the source computes once on arrival, plus the save-for-replay row
 *   (``AdaptiveSummary``).
 *
 * Adaptive sessions are ephemeral (no LessonProgress row), but ElementError
 * rows update on every attempt through the same ``recordBulk`` path the
 * viewer uses, closing the error -> analysis -> generation loop.
 * Dexie-mode-friendly: every storage call routes through ``getStorage()``.
 */

import {useNavigate, useParams, useSearchParams} from "react-router";

import {ADAPTIVE_POLICY, LessonRunner} from "../../components/lesson/runner";
import AdaptiveTransparencyDisplay from "../../components/lesson/runner/header-extras/AdaptiveTransparencyDisplay";
import AdaptiveSummary from "../../components/lesson/runner/summaries/AdaptiveSummary";
import {useAdaptiveSource} from "../../hooks/lesson/sources";

interface UrlParams {
    setId: string;
    [key: string]: string | undefined;
}

export default function AdaptiveLessonPage() {
    const params = useParams<UrlParams>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const setId = params.setId ?? "";
    // #1012 - optional ?lesson= scope: train only this lesson's failed cards.
    const lessonId = searchParams.get("lesson") ?? undefined;

    const source = useAdaptiveSource({setId, lessonId});

    return (
        <LessonRunner
            source={source}
            policy={ADAPTIVE_POLICY}
            headerExtra={() =>
                source.transparency && (
                    <AdaptiveTransparencyDisplay transparency={source.transparency} />
                )
            }
            summary={(tallies) => (
                <AdaptiveSummary
                    correct={tallies.correct}
                    total={tallies.total}
                    masteredDelta={tallies.masteredDelta ?? null}
                    lesson={source.lesson}
                    onExit={() => navigate("/dashboard")}
                />
            )}
        />
    );
}

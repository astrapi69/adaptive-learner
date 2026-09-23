/**
 * /review/:setId — SRS review session
 * (Phase 46D / C15 / P-129; on the LessonRunner shell since EXP-052
 * slice 1, refs #3169).
 *
 * Walks the learner through a synthesised mini-lesson built from the SRS
 * review queue of the requested set. The page owns only its route
 * params: ``useReviewSource`` calls the mode hook and normalises it, the
 * shell renders header, progress, the controlled exercise, the footer,
 * the Enter shortcut, the re-anchoring and the answered-step lock with
 * the review policy (session header, Previous, no pause, no options,
 * mode ``practice``), and ``ReviewSummaryPanel`` is the summary.
 *
 * Review sessions are ephemeral: no LessonProgress row, no step_results
 * persistence. ElementError rows DO get updated on every attempt via the
 * same recordBulk path the main viewer uses. Dexie-mode-friendly:
 * ``useReviewLesson`` routes through ``getStorage()``.
 */

import {useMemo} from "react";
import {useNavigate, useParams, useSearchParams} from "react-router";

import {LessonRunner, REVIEW_POLICY} from "../../components/lesson/runner";
import ReviewSummaryPanel from "../../components/lesson/runner/summaries/ReviewSummaryPanel";
import {useReviewSource} from "../../hooks/lesson/sources";
import {readReviewLimit} from "../../lib/learning/reviewLimitPref";

interface UrlParams {
    setId: string;
    [key: string]: string | undefined;
}

export default function ReviewPage() {
    const params = useParams<UrlParams>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const setId = params.setId ?? "";
    // #628 — a "quick review" is a shorter, finishable session. #718 — the
    // session length is configurable (Settings > Learning, default 10); a
    // quick review keeps its own fixed 5. Read once at mount so it stays
    // stable across the session (and "another round").
    const quick = searchParams.get("quick") === "1";
    const reviewLimit = useMemo(() => (quick ? 5 : readReviewLimit()), [quick]);

    const source = useReviewSource({setId, limit: reviewLimit});

    return (
        <LessonRunner
            source={source}
            policy={REVIEW_POLICY}
            summary={(tallies) => (
                <ReviewSummaryPanel
                    correct={tallies.correct}
                    total={tallies.total}
                    remaining={tallies.remaining ?? 0}
                    neutral={source.neutral}
                    onAnotherRound={source.reload}
                    onExit={() => navigate("/dashboard")}
                />
            )}
        />
    );
}

/**
 * /error-replay/:setSlug/:setId/:filename — "Fehler wiederholen"
 * (on the LessonRunner shell since EXP-052 slice 3, refs #3169).
 *
 * Replays the EXACT exercises the learner just failed in a lesson, one
 * more time. Distinct from:
 *   - the Correction Block (generates NEW cloze exercises),
 *   - the Adaptive Lesson (all errors across all lessons, regenerated),
 *   - the SRS Review queue (all lessons, on a schedule).
 *
 * The failed exercises arrive via router state (the lesson summary's
 * correction block, or a set's flash-round card, #2888).
 * ``useErrorReplaySource`` owns the round (only the failed exercises; "try
 * again" narrows to the still-wrong ones as a new section of the same run)
 * and the SRS merge (#1304). The shell renders header, progress, the
 * controlled exercise, the footer, Enter, the re-anchoring and the
 * answered-step lock with the replay policy: the back button leaves to the
 * lesson (or the flash round's origin), and Previous is a read-only look
 * back, an answered step stays answered and is recorded once. The flash
 * round's countdown ring hangs in under the title (``headerExtra``), the
 * celebration-or-retry recap is ``ErrorReplaySummary``.
 *
 * Ephemeral and practice-only: no LessonProgress / step_results writes, so
 * re-entering the original lesson is unaffected. Dexie-friendly.
 */

import {useLocation, useNavigate, useParams} from "react-router";

import {ERROR_REPLAY_POLICY, LessonRunner} from "../../components/lesson/runner";
import FlashRoundCountdown from "../../components/lesson/runner/header-extras/FlashRoundCountdown";
import ErrorReplaySummary from "../../components/lesson/runner/summaries/ErrorReplaySummary";
import {useErrorReplaySource, type ReplayState} from "../../hooks/lesson/sources";

interface UrlParams {
    setSlug?: string;
    setId?: string;
    filename?: string;
    [key: string]: string | undefined;
}

export default function ErrorReplayLesson() {
    const params = useParams<UrlParams>();
    const location = useLocation();
    const navigate = useNavigate();

    const source = useErrorReplaySource({
        state: location.state as ReplayState | null,
        setSlug: params.setSlug ?? "",
        setId: params.setId ?? "",
        filename: params.filename ?? "",
    });

    return (
        <LessonRunner
            source={source}
            policy={ERROR_REPLAY_POLICY}
            headerExtra={(run) =>
                source.flashRound && (
                    <FlashRoundCountdown
                        seconds={source.flashRound.seconds}
                        step={run.step}
                        stepIndex={run.position?.index ?? 0}
                        answered={source.stepAnswered}
                    />
                )
            }
            summary={(tallies) => (
                <ErrorReplaySummary
                    correct={tallies.correct}
                    total={tallies.total}
                    stillWrong={source.stillWrong}
                    onRetry={source.retryStillWrong}
                    onDone={() => navigate(source.backTo)}
                />
            )}
        />
    );
}

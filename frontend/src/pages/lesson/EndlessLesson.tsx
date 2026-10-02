/**
 * /endless-lesson/:setId — Endlos-Modus session (#1015; on the
 * LessonRunner shell since EXP-052 slice 2, refs #3169).
 *
 * A continuous, never-finishing SRS practice stream over a set: due/error
 * cards first, then new cards, then random repetition (see
 * ``useEndlessLesson`` + ``buildEndlessPlan``). There is no "lesson
 * complete" screen by itself: the learner pauses or ends the stream from
 * the footer, and End shows the recap (duration, cards, correct, reviews
 * done, new learned, errors practised, practice XP).
 *
 * The page owns only its route param: ``useEndlessSource`` calls the mode
 * hook and adds the stream's own step counter, the active-seconds timer,
 * the pause and the end; the shell renders the header, the stat line in
 * the progress slot, the controlled exercise, the footer (pause and End,
 * no Previous: a stream has no previous step), Enter and the
 * re-anchoring; ``EndlessSummary`` is the recap.
 *
 * Ephemeral (no LessonProgress row); the SRS updates after every answer
 * via ``recordStepAttempts``. Dexie-mode-friendly via ``getStorage()``.
 */

import {useNavigate, useParams} from "react-router";

import {ENDLESS_POLICY, LessonRunner} from "../../components/lesson/runner";
import EndlessSummary from "../../components/lesson/runner/summaries/EndlessSummary";
import {useEndlessSource} from "../../hooks/lesson/sources";

interface UrlParams {
    setId: string;
    [key: string]: string | undefined;
}

/** A stream that ended before its first answer reports zero counters. */
const NO_STATS = {cards: 0, correct: 0, reviewsDone: 0, newLearned: 0, errorsPracticed: 0, xp: 0};

export default function EndlessLessonPage() {
    const params = useParams<UrlParams>();
    const navigate = useNavigate();
    const source = useEndlessSource({setId: params.setId ?? ""});

    return (
        <LessonRunner
            source={source}
            policy={ENDLESS_POLICY}
            summary={(tallies) => (
                <EndlessSummary
                    stats={tallies.stats ?? NO_STATS}
                    elapsedSec={tallies.elapsedSec ?? 0}
                    onExit={() => navigate("/dashboard")}
                />
            )}
        />
    );
}

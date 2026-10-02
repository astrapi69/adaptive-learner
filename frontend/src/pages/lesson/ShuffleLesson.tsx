/**
 * /shuffle-lesson/:setId — Zufall-Modus session (#1014; on the
 * LessonRunner shell since EXP-052 slice 2, refs #3169).
 *
 * Walks the learner through a synthesised mini-lesson that INTERLEAVES the
 * exercises of every lesson in a set (Fisher-Yates, no 3+ from one lesson in
 * a row, capped; see ``buildShuffleLesson``). The page owns only its route
 * params: ``useShuffleSource`` calls the mode hook and normalises it, the
 * shell renders header, progress, the controlled exercise, the lesson
 * footer, Enter, the re-anchoring and the answered-step lock with the
 * shuffle policy (session header, Previous, no pause, mode ``practice``),
 * and ``ShuffleSummary`` is the summary.
 *
 * Sessions are ephemeral (no LessonProgress row); ``ElementError`` rows DO
 * update on every attempt via the same ``recordBulk`` path the viewer and
 * review use. Dexie-mode-friendly: ``useShuffleLesson`` routes through
 * ``getStorage()``.
 */

import {useMemo} from "react";
import {useNavigate, useParams, useSearchParams} from "react-router";

import {LessonRunner, SHUFFLE_POLICY} from "../../components/lesson/runner";
import ShuffleSummary from "../../components/lesson/runner/summaries/ShuffleSummary";
import {useShuffleSource} from "../../hooks/lesson/sources";
import {DEFAULT_SHUFFLE_LIMIT} from "../../lib/shuffle/shuffle-lesson";

interface UrlParams {
    setId: string;
    [key: string]: string | undefined;
}

/** Selectable session lengths (issue #1014); default 20. */
const ALLOWED_LENGTHS = [10, 20, 30, 50];

export default function ShuffleLessonPage() {
    const params = useParams<UrlParams>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const setId = params.setId ?? "";
    // Configurable session length via ?len= (10/20/30/50); default 20.
    const limit = useMemo(() => {
        const raw = Number(searchParams.get("len"));
        return ALLOWED_LENGTHS.includes(raw) ? raw : DEFAULT_SHUFFLE_LIMIT;
    }, [searchParams]);

    const source = useShuffleSource({setId, limit});

    return (
        <LessonRunner
            source={source}
            policy={SHUFFLE_POLICY}
            summary={(tallies) => (
                <ShuffleSummary
                    correct={tallies.correct}
                    total={tallies.total}
                    lessons={source.sourceLessonCount}
                    onAnotherRound={source.reload}
                    onExit={() => navigate("/dashboard")}
                />
            )}
        />
    );
}

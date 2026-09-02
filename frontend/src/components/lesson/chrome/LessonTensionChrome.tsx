/**
 * LessonTensionChrome (#2878) - the tension systems' chrome slot in
 * the sticky progress row: the hearts row and the per-exercise
 * countdown ring. Self-gating on the flags computed by
 * ``useLessonTension`` (renders nothing while both are off), so the
 * page mounts it unconditionally.
 */

import type {LessonTension} from "../../../hooks/lesson/useLessonTension";
import LessonCountdownRing from "./LessonCountdownRing";
import LessonHearts from "./LessonHearts";

export default function LessonTensionChrome({
    tension,
}: {
    tension: LessonTension;
}) {
    return (
        <>
            {tension.showHearts && (
                <LessonHearts
                    hearts={tension.hearts}
                    maxHearts={tension.maxHearts}
                />
            )}
            {tension.showRing && (
                <LessonCountdownRing
                    remaining={tension.countdown.remaining}
                    total={tension.countdown.total}
                    expired={tension.countdown.expired}
                />
            )}
        </>
    );
}

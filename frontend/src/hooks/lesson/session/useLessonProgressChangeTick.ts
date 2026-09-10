import {useEffect, useState} from "react";

import {subscribeLessonProgressChanged} from "../../../lib/lesson/progress-change-event";

/**
 * A counter that advances on every landed lesson-progress write (#3075).
 *
 * Put it in the dependency list of a data-loading effect and the effect
 * re-runs when a lesson row changes in this tab, so a surface mounted in
 * the same commit as a pause write (the dashboard replacing the lesson
 * page) does not keep the pre-write snapshot it read on mount.
 *
 * @example
 * const progressTick = useLessonProgressChangeTick();
 * useEffect(() => { void load(); }, [userId, progressTick]);
 */
export function useLessonProgressChangeTick(): number {
    const [tick, setTick] = useState(0);
    useEffect(
        () => subscribeLessonProgressChanged(() => setTick((value) => value + 1)),
        [],
    );
    return tick;
}

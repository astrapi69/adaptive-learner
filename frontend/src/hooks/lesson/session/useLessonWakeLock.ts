import { useMemo } from "react";

import { readKeepScreenOn } from "../../../lib/lesson/prefs/keepScreenOnPref";
import { useScreenWakeLock } from "../../ui/useScreenWakeLock";

/**
 * Keep the screen on while a lesson is open and not on its summary (#3358),
 * also during silent reading, unless the learner turned the setting off.
 * The preference is read once per mount, like the page's other one-shot reads.
 *
 * @example
 * useLessonWakeLock(statusKind, currentStepIndex, playedLesson);
 */
export function useLessonWakeLock(
  statusKind: string | null,
  currentStepIndex: number,
  lesson: { steps: readonly unknown[] } | null | undefined,
): void {
  const keepScreenOn = useMemo(() => readKeepScreenOn(), []);
  useScreenWakeLock(keepScreenOn && statusKind === null && currentStepIndex < (lesson?.steps.length ?? 0));
}

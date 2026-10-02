/**
 * FlashRoundCountdown (#2888; a header extension since EXP-052 slice 3,
 * refs #3169).
 *
 * The per-exercise countdown ring of a set flash round, under the title.
 * The #2878 semantics: expiry breaks the streak through the celebration
 * bus inside ``useLessonCountdown``, nothing auto-submits; the ring resets
 * on every step change and pauses once the step is graded. On the summary
 * (no step) it renders nothing and the timer stands still. Hung into
 * ``LessonRunner`` through its ``headerExtra`` render prop (EXP-052
 * Befund 3); a plain replay (no flash round) does not mount it. The title
 * itself is the source's (``useErrorReplaySource``); only the ring moved
 * here from the page's ``ReplayTitle``.
 *
 * @example
 * headerExtra={(run) =>
 *   source.flashRound && (
 *     <FlashRoundCountdown seconds={source.flashRound.seconds} step={run.step}
 *       stepIndex={run.position?.index ?? 0} answered={source.stepAnswered} />
 *   )}
 */

import { useLessonCountdown } from "../../../../hooks/lesson/useLessonCountdown";
import { isPlayableExerciseStep } from "../../../../lib/lesson/lesson-step-state";
import type { ContentLessonStep } from "../../../../storage/types";
import LessonCountdownRing from "../../chrome/tension/LessonCountdownRing";

export interface FlashRoundCountdownProps {
  /** Seconds per exercise (the flash round's setting). */
  seconds: number;
  /** The current step; ``null`` on the summary. */
  step: ContentLessonStep | null;
  /** The run's step index: a change resets the ring. */
  stepIndex: number;
  /** The step was graded in this round: the ring pauses. */
  answered: boolean;
}

/** The flash round's per-exercise countdown ring, or nothing off an exercise. */
export default function FlashRoundCountdown({
  seconds,
  step,
  stepIndex,
  answered,
}: FlashRoundCountdownProps) {
  const isExerciseStep = isPlayableExerciseStep(step);
  const countdown = useLessonCountdown({
    enabled: step !== null,
    seconds,
    stepIndex,
    isExerciseStep,
    checked: answered,
  });
  if (!isExerciseStep) return null;
  return (
    <LessonCountdownRing
      remaining={countdown.remaining}
      total={countdown.total}
      expired={countdown.expired}
    />
  );
}

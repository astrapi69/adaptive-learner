/**
 * Conditional wrapper around the floating read-aloud mini-player
 * (extracted from LessonPage for the complexity burn-down #417).
 *
 * Renders nothing unless a stream is playing; otherwise derives the
 * mini-player's position / total / hasPrev / hasNext from the current
 * theory block. Behaviour-preserving.
 */

import LessonTtsMiniPlayer from "./LessonTtsMiniPlayer";
import type { ReadAloudController } from "../../hooks/useReadAloud";
import type { TheoryBlock } from "../../lib/lesson/tts-text";

interface LessonTtsMiniPlayerSlotProps {
  tts: ReadAloudController;
  theoryBlock: TheoryBlock | null;
  currentStepIndex: number;
  onReadStepAt: (index: number) => void;
}

/** The floating mini-player (C8); null unless the engine is active. */
export default function LessonTtsMiniPlayerSlot({
  tts,
  theoryBlock,
  currentStepIndex,
  onReadStepAt,
}: LessonTtsMiniPlayerSlotProps) {
  if (!tts.speaking) return null;

  return (
    <LessonTtsMiniPlayer
      paused={tts.paused}
      position={theoryBlock?.position ?? 0}
      total={theoryBlock?.total ?? 0}
      hasPrev={theoryBlock !== null && currentStepIndex > theoryBlock.start}
      hasNext={theoryBlock !== null && currentStepIndex < theoryBlock.end}
      onPrev={() => onReadStepAt(currentStepIndex - 1)}
      onPlayPause={() => (tts.paused ? tts.resume() : tts.pause())}
      onNext={() => onReadStepAt(currentStepIndex + 1)}
      onStop={() => tts.stop()}
    />
  );
}

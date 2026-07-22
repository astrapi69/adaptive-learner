/**
 * LessonOptionsBar (#1625).
 *
 * The playing-view slice of the lesson's mode/display settings: it wires
 * the favorite toggle, mode toggle, and auto read-aloud into the
 * collapsible {@link LessonOptionsPanel}. Extracted from ``LessonPage`` so
 * the page function doesn't carry the mode/tts branches (complexity gate).
 *
 * Returns ``null`` on the summary screen (the mode toggle is exam-locked
 * there anyway), so the parent renders it unconditionally. The inner panel
 * is keyed by ``set/filename`` so a new lesson starts collapsed while a
 * step change within the same lesson preserves the choice.
 */

import LessonFavoriteToggle from "./LessonFavoriteToggle";
import LessonModeToggle from "./LessonModeToggle";
import LessonOptionsPanel from "./LessonOptionsPanel";
import LessonTtsControls from "../tts/LessonTtsControls";
import type { ContentLesson } from "../../../storage/types";
import type { LessonMode } from "../../../lib/learning/lessonModePref";
import type { ReadAloudController } from "../../../hooks/lesson/audio/useReadAloud";
import { useI18n } from "../../../hooks/ui/useI18n";

export interface LessonOptionsBarProps {
  isSummary: boolean;
  /** Extra utility classes on the options panel section (e.g. flex-row
   *  sizing when it sits beside the progress bar). */
  className?: string;
  userId: string;
  source: string;
  setId: string;
  filename: string;
  title: string;
  setTitle: string;
  lessonMode: LessonMode;
  onModeChange: (mode: LessonMode) => void;
  /** Lock the mode toggle once the lesson is under way. */
  modeLocked: boolean;
  /** Read-aloud is a scaffolding aid shown only in modes that enable it. */
  showReadAloud: boolean;
  lesson: ContentLesson;
  tts: ReadAloudController;
  autoRead: boolean;
  toggleAutoRead: () => void;
  startContinuous: () => void;
  isContinuous: boolean;
  continuousAvailable: boolean;
}

/**
 * Render the collapsible options group for the playing view.
 *
 * @param props - See {@link LessonOptionsBarProps}.
 */
export default function LessonOptionsBar({
  isSummary,
  className,
  userId,
  source,
  setId,
  filename,
  title,
  setTitle,
  lessonMode,
  onModeChange,
  modeLocked,
  showReadAloud,
  lesson,
  tts,
  autoRead,
  toggleAutoRead,
  startContinuous,
  isContinuous,
  continuousAvailable,
}: LessonOptionsBarProps) {
  const { t } = useI18n();
  if (isSummary) return null;

  return (
    <LessonOptionsPanel
      key={`${setId}/${filename}`}
      summary={t(`lesson.mode.${lessonMode}`, lessonMode)}
      className={className}
    >
      <div className="flex justify-end">
        <LessonFavoriteToggle
          userId={userId}
          source={source}
          setId={setId}
          filename={filename}
          title={title}
          setTitle={setTitle}
        />
      </div>

      {/* #1007 — mode toggle (Practice / Exam / Timed / Reverse). Locked
          once the lesson is under way so a mid-run flip can't change the
          rules. */}
      <LessonModeToggle
        mode={lessonMode}
        onChange={onModeChange}
        disabled={modeLocked}
      />

      {showReadAloud && (
        <LessonTtsControls
          isSummary={isSummary}
          lesson={lesson}
          tts={tts}
          autoRead={autoRead}
          toggleAutoRead={toggleAutoRead}
          startContinuous={startContinuous}
          isContinuous={isContinuous}
          continuousAvailable={continuousAvailable}
        />
      )}
    </LessonOptionsPanel>
  );
}

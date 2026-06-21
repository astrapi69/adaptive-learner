/**
 * Read-aloud control bar shown above the lesson step (#406 follow-up,
 * extracted from LessonPage for the complexity burn-down #417).
 *
 * Renders the auto-read toggle, the continuous "read all" toggle, the
 * inline speed control (only while a stream plays), and the no-voice
 * warning. Returns ``null`` on the summary screen or when TTS is
 * disabled, so the parent renders it unconditionally.
 */

import { Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ContentLesson } from "../../../storage/types";
import {
  READ_ALOUD_SPEEDS,
  type ReadAloudController,
} from "../../../hooks/lesson/useReadAloud";
import { useI18n } from "../../../hooks/ui/useI18n";

interface LessonTtsControlsProps {
  isSummary: boolean;
  lesson: ContentLesson;
  tts: ReadAloudController;
  autoRead: boolean;
  toggleAutoRead: () => void;
  startContinuous: () => void;
  isContinuous: boolean;
  continuousAvailable: boolean;
}

/** The read-aloud control bar; null unless a non-summary step has TTS. */
export default function LessonTtsControls({
  isSummary,
  lesson,
  tts,
  autoRead,
  toggleAutoRead,
  startContinuous,
  isContinuous,
  continuousAvailable,
}: LessonTtsControlsProps) {
  const { t } = useI18n();
  if (isSummary || !tts.enabled) return null;

  return (
    <div className="lesson-tts-controls" data-testid="lesson-tts-controls">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`lesson-tts-autoread${autoRead ? " is-on" : ""}`}
        data-testid="lesson-tts-autoread"
        aria-pressed={autoRead}
        onClick={toggleAutoRead}
      >
        <Volume2 size={14} aria-hidden="true" />
        {t("lesson.tts.auto_read", "Auto read-aloud")}
      </Button>

      {/* Continuous theory reading (C7) — reads the whole run of
                consecutive theory steps, auto-advancing the viewer; stops at
                the next exercise. */}
      {continuousAvailable && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`lesson-tts-autoread${isContinuous ? " is-on" : ""}`}
          data-testid="lesson-tts-readall"
          aria-pressed={isContinuous}
          onClick={() => (isContinuous ? tts.stop() : startContinuous())}
        >
          {isContinuous ? (
            <Square size={14} aria-hidden="true" />
          ) : (
            <Volume2 size={14} aria-hidden="true" />
          )}
          {isContinuous
            ? t("lesson.tts.stop", "Stop")
            : t("lesson.tts.read_all", "Read all")}
        </Button>
      )}

      {/* Inline speed control — only while a stream is playing (C4).
                Changing it restarts the current read at the new rate. */}
      {tts.speaking && (
        <div
          className="lesson-tts-speed"
          data-testid="lesson-tts-speed"
          role="group"
          aria-label={t("lesson.tts.speed", "Speed")}
        >
          <span className="lesson-tts-speed-label">
            {t("lesson.tts.speed", "Speed")}
          </span>
          {READ_ALOUD_SPEEDS.map((s) => (
            <Button
              key={s}
              type="button"
              variant="ghost"
              size="sm"
              className={`lesson-tts-speed-btn${
                tts.speed === s ? " is-active" : ""
              }`}
              data-testid={`lesson-tts-speed-${s}`}
              aria-pressed={tts.speed === s}
              onClick={() => tts.setSpeed(s)}
            >
              {s}x
            </Button>
          ))}
        </div>
      )}

      {/* No-voice warning — the requested language has no installed
                voice; playback falls back to the engine default. */}
      {!tts.voiceAvailable && (
        <span
          className="lesson-tts-novoice"
          data-testid="lesson-tts-novoice"
          role="status"
        >
          {t("lesson.tts.no_voice", "No voice available for {language}").replace(
            "{language}",
            lesson.target_language ?? "",
          )}
        </span>
      )}
    </div>
  );
}

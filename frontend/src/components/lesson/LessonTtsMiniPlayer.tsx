/**
 * LessonTtsMiniPlayer — a floating media-player bar shown while the
 * lesson read-aloud engine is active (TTS feature C8).
 *
 * Step-based controls (the recommended-first approach; time-based
 * seek deferred): previous theory step (re-read) / play-pause / next
 * theory step, plus a "Step X of N theory steps" readout and a stop
 * (close) button. Web Speech can't seek, but step skip is both
 * simpler and more useful for learning than an arbitrary 10s jump.
 *
 * Pure presentational: all behaviour is passed in by the Lesson page.
 */

import {Pause, Play, SkipBack, SkipForward, Square} from "lucide-react";

import {useI18n} from "../../hooks/useI18n";

interface LessonTtsMiniPlayerProps {
    paused: boolean;
    /** 1-based position + total within the current theory block. */
    position: number;
    total: number;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onPlayPause: () => void;
    onNext: () => void;
    onStop: () => void;
}

export default function LessonTtsMiniPlayer({
    paused,
    position,
    total,
    hasPrev,
    hasNext,
    onPrev,
    onPlayPause,
    onNext,
    onStop,
}: LessonTtsMiniPlayerProps) {
    const {t} = useI18n();
    const playPauseLabel = paused
        ? t("lesson.tts.play", "Play")
        : t("lesson.tts.pause", "Pause");
    return (
        <div
            className="lesson-tts-player"
            data-testid="lesson-tts-player"
            role="group"
            aria-label={t("lesson.tts.reading", "Reading…")}
        >
            <button
                type="button"
                className="lesson-tts-player-btn"
                data-testid="lesson-tts-player-prev"
                aria-label={t("lesson.tts.prev_step", "Previous step")}
                disabled={!hasPrev}
                onClick={onPrev}
            >
                <SkipBack size={16} aria-hidden="true" />
            </button>
            <button
                type="button"
                className="lesson-tts-player-btn lesson-tts-player-playpause"
                data-testid="lesson-tts-player-playpause"
                aria-label={playPauseLabel}
                aria-pressed={paused}
                onClick={onPlayPause}
            >
                {paused ? (
                    <Play size={18} aria-hidden="true" />
                ) : (
                    <Pause size={18} aria-hidden="true" />
                )}
            </button>
            <button
                type="button"
                className="lesson-tts-player-btn"
                data-testid="lesson-tts-player-next"
                aria-label={t("lesson.tts.next_step", "Next step")}
                disabled={!hasNext}
                onClick={onNext}
            >
                <SkipForward size={16} aria-hidden="true" />
            </button>
            {total > 0 && (
                <span
                    className="lesson-tts-player-pos"
                    data-testid="lesson-tts-player-pos"
                >
                    {t(
                        "lesson.tts.step_position",
                        "Step {current} of {total} theory steps",
                    )
                        .replace("{current}", String(position))
                        .replace("{total}", String(total))}
                </span>
            )}
            <button
                type="button"
                className="lesson-tts-player-btn lesson-tts-player-stop"
                data-testid="lesson-tts-player-stop"
                aria-label={t("lesson.tts.stop", "Stop")}
                onClick={onStop}
            >
                <Square size={14} aria-hidden="true" />
            </button>
        </div>
    );
}

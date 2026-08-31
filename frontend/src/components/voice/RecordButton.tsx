/**
 * RecordButton - audio-recording start/stop toggle (engine#68 idea 3:
 * speak-and-record). The recording analogue of {@link MicButton}: click to
 * start, click again to stop; auto-stops at
 * {@link MAX_RECORDING_DURATION_MS}. Unlike ``MicButton`` (which yields a
 * live TEXT transcript) this yields the raw audio clip itself via
 * ``onRecorded``, for playback/storage - no speech-to-text involved.
 *
 * Hides itself when the browser doesn't support MediaRecorder/getUserMedia
 * (graceful degradation, matching the other voice buttons' pattern). No
 * Settings toggle to gate on - unlike TTS/STT, recording is opt-in per
 * click, there is nothing ambient to disable.
 */

import {useEffect, useRef, useState} from "react";

import {useButtonTooltips} from "../../hooks/settings/useButtonTooltips";
import {useI18n} from "../../hooks/ui/useI18n";
import {
    isMediaRecordingSupported,
    startRecording,
    type RecordingHandle,
} from "../../lib/voice/audio-recording";
import {notify} from "../../utils/notify";

interface RecordButtonProps {
    /** Called with the captured clip once recording stops (explicit stop
     *  or the duration-cap auto-stop). */
    onRecorded: (clip: {blob: Blob; mimeType: string; durationMs: number}) => void;
    className?: string;
    testId?: string;
}

export default function RecordButton({
    onRecorded,
    className,
    testId,
}: RecordButtonProps) {
    const {t} = useI18n();
    const tooltipsOn = useButtonTooltips();
    const [recording, setRecording] = useState(false);
    const handleRef = useRef<RecordingHandle | null>(null);
    const supported = isMediaRecordingSupported();

    useEffect(() => {
        return () => {
            // Stop any in-flight recording on unmount so the microphone
            // isn't left open after the learner navigates away.
            if (handleRef.current) handleRef.current.stop();
        };
    }, []);

    if (!supported) {
        return null;
    }

    const onClick = () => {
        if (recording) {
            handleRef.current?.stop();
            return;
        }
        setRecording(true);
        void startRecording({
            onStop: (clip) => {
                setRecording(false);
                handleRef.current = null;
                onRecorded(clip);
            },
            onError: (code) => {
                setRecording(false);
                handleRef.current = null;
                if (code === "not-allowed") {
                    notify.error(
                        t(
                            "voice.mic_permission_denied",
                            "Microphone access denied. Allow microphone access in your browser to dictate.",
                        ),
                    );
                } else if (code === "no-device") {
                    notify.error(
                        t(
                            "voice.mic_no_device",
                            "No microphone found. Connect one and try again.",
                        ),
                    );
                } else {
                    notify.error(
                        t("voice.record_error", "Recording didn't work. Please try again."),
                    );
                }
            },
        }).then((handle) => {
            if (handle) {
                handleRef.current = handle;
            } else {
                setRecording(false);
            }
        });
    };

    const aria = recording
        ? t("voice.stop_recording", "Stop recording")
        : t("voice.start_recording", "Start recording");

    // Tailwind utilities, not a new legacy CSS rule (#1467 - global.css/
    // styles/legacy is a frozen size ratchet; new component styling
    // belongs on the component). Mirrors SpeechButton's idle/active
    // two-state recipe; `motion-safe:animate-pulse` is the recording
    // indicator, respecting prefers-reduced-motion automatically.
    const recordingClasses = recording
        ? "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)] motion-safe:animate-pulse"
        : "border-border bg-transparent text-fg-muted hover:bg-bg-elevated hover:text-fg-primary";

    return (
        <button
            type="button"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-base transition-colors duration-150 ${recordingClasses} ${className ?? ""}`}
            data-testid={testId ? `record-button-${testId}` : "record-button"}
            data-recording={recording ? "true" : "false"}
            onClick={onClick}
            aria-label={aria}
            title={tooltipsOn ? aria : undefined}
        >
            <span aria-hidden="true">{recording ? "■" : "⏺"}</span>
        </button>
    );
}

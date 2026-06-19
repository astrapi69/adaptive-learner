/**
 * MicButton — STT start/stop toggle (Phase 31B).
 *
 * Click → start listening, click again → stop. Visual states:
 *   - idle: outlined mic icon
 *   - listening: pulsing accent-colored mic + dot indicator
 *
 * The transcribed text bubbles up via the ``onTranscript`` prop:
 *   - ``isFinal=false``: interim results, fired on each
 *     intermediate transcription. The consumer should typically
 *     SHOW these in the input field but not commit them.
 *   - ``isFinal=true``: terminal result. Safe to commit.
 *
 * The button hides itself when the browser doesn't support
 * Web Speech recognition OR when the user has STT off in
 * Settings (graceful degradation, not a broken state).
 */

import {useEffect, useRef, useState} from "react";

import {useButtonTooltips} from "../hooks/settings/useButtonTooltips";
import {useI18n} from "../hooks/ui/useI18n";
import {readVoicePrefs} from "../lib/voice/voicePref";
import {
    isSpeechRecognitionSupported,
    start as startRecognition,
    type RecognitionHandle,
} from "../lib/voice/speech-recognition";
import {notify} from "../utils/notify";

interface MicButtonProps {
    /** BCP-47 lang. Defaults to the user's i18n lang.  */
    lang?: string;
    /** Called on each interim + final transcript. */
    onTranscript: (text: string, isFinal: boolean) => void;
    className?: string;
    testId?: string;
}

export default function MicButton({
    lang,
    onTranscript,
    className,
    testId,
}: MicButtonProps) {
    const {lang: docLang, t} = useI18n();
    const tooltipsOn = useButtonTooltips();
    const [listening, setListening] = useState(false);
    const handleRef = useRef<RecognitionHandle | null>(null);
    const supported = isSpeechRecognitionSupported();
    const sttEnabled = readVoicePrefs().sttEnabled;
    const langOverride = readVoicePrefs().sttLangOverride;

    useEffect(() => {
        return () => {
            // Abort any in-flight recognition on unmount so the
            // browser doesn't keep transcribing in the background.
            if (handleRef.current) handleRef.current.abort();
        };
    }, []);

    if (!supported || !sttEnabled) {
        return null;
    }

    const effectiveLang = langOverride || lang || docLang || "en-US";

    const onClick = () => {
        if (listening) {
            handleRef.current?.stop();
            return;
        }
        const handle = startRecognition({
            lang: effectiveLang,
            continuous: false,
            interimResults: true,
            onInterim: (text) => onTranscript(text, false),
            onFinal: (text) => onTranscript(text, true),
            onError: (code) => {
                // Map the Web Speech API error code to a friendly,
                // actionable message. ``no-speech`` / ``aborted`` are
                // benign (the user said nothing or stopped) — stay
                // silent. Never surface the raw code to the user.
                if (code === "no-speech" || code === "aborted") {
                    // benign — no toast.
                } else if (
                    code === "not-allowed" ||
                    code === "service-not-allowed"
                ) {
                    notify.error(
                        t(
                            "voice.mic_permission_denied",
                            "Microphone access denied. Allow microphone access in your browser to dictate.",
                        ),
                    );
                } else if (code === "audio-capture") {
                    notify.error(
                        t(
                            "voice.mic_no_device",
                            "No microphone found. Connect one and try again.",
                        ),
                    );
                } else if (code === "network") {
                    notify.error(
                        t(
                            "voice.mic_network",
                            "Speech recognition is offline. Check your internet connection.",
                        ),
                    );
                } else {
                    notify.error(
                        t(
                            "voice.mic_error",
                            "Speech recognition didn't work. Please try again.",
                        ),
                    );
                }
                setListening(false);
                handleRef.current = null;
            },
            onEnd: () => {
                setListening(false);
                handleRef.current = null;
            },
        });
        if (handle) {
            handleRef.current = handle;
            setListening(true);
        }
    };

    const aria = listening
        ? t("voice.stop_listening", "Stop listening")
        : t("voice.start_listening", "Start dictation");

    return (
        <button
            type="button"
            className={`mic-button ${listening ? "mic-button--listening" : ""} ${className ?? ""}`}
            data-testid={testId ? `mic-button-${testId}` : "mic-button"}
            data-listening={listening ? "true" : "false"}
            onClick={onClick}
            aria-label={aria}
            title={tooltipsOn ? aria : undefined}
        >
            <span className="mic-button__icon" aria-hidden="true">
                {listening ? "●" : "🎤"}
            </span>
        </button>
    );
}

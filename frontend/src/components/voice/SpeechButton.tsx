/**
 * SpeechButton — TTS play/stop toggle (Phase 31A).
 *
 * Renders as a small "speaker" icon button. When the user
 * clicks:
 *   - idle  → speak(text), button switches to "speaking" state
 *   - speaking → stop(), button returns to idle
 *
 * Hidden entirely when the browser doesn't support
 * speechSynthesis OR when the user has TTS disabled in
 * Settings (``voicePref.ttsEnabled``). The parent passes
 * ``lang`` for voice selection; defaults to the document
 * language if absent.
 */

import {useEffect, useRef, useState} from "react";

import {useButtonTooltips} from "../../hooks/settings/useButtonTooltips";
import {useI18n} from "../../hooks/ui/useI18n";
import {readVoicePrefs} from "../../lib/voice/voicePref";
import {
    isSpeechSynthesisSupported,
    loadVoices,
    pickVoice,
    speak,
    stop,
} from "../../lib/voice/speech-synthesis";

interface SpeechButtonProps {
    text: string;
    /** BCP-47 language code. Defaults to the user's i18n lang. */
    lang?: string;
    /** Compact (icon-only) vs labelled. */
    label?: string;
    className?: string;
    /** Optional ``data-testid`` suffix; the root gets
     *  ``speech-button-{suffix}``. */
    testId?: string;
}

export default function SpeechButton({
    text,
    lang,
    label,
    className,
    testId,
}: SpeechButtonProps) {
    const {lang: docLang, t} = useI18n();
    const tooltipsOn = useButtonTooltips();
    const [speaking, setSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const [voiceList, setVoiceList] = useState<SpeechSynthesisVoice[]>([]);
    const ttsEnabled = useRef(readVoicePrefs().ttsEnabled);

    useEffect(() => {
        if (!isSpeechSynthesisSupported()) {
            setSupported(false);
            return;
        }
        setSupported(true);
        let cancelled = false;
        loadVoices().then((vs) => {
            if (!cancelled) setVoiceList(vs);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        // Stop speech on unmount so a long message doesn't keep
        // playing after the user navigates away.
        return () => {
            if (speaking) stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!supported || !ttsEnabled.current) {
        return null;
    }

    const effectiveLang = lang || docLang || "en";
    const prefs = readVoicePrefs();
    const preferredVoice =
        prefs.ttsVoiceName.length > 0
            ? voiceList.find((v) => v.name === prefs.ttsVoiceName) ?? null
            : pickVoice(voiceList, effectiveLang);

    const onClick = () => {
        if (speaking) {
            stop();
            setSpeaking(false);
            return;
        }
        setSpeaking(true);
        speak(text, {
            lang: effectiveLang,
            voice: preferredVoice,
            rate: prefs.ttsRate,
            pitch: prefs.ttsPitch,
            onEnd: () => setSpeaking(false),
            onError: () => setSpeaking(false),
        });
    };

    const aria = speaking
        ? t("voice.stop_speaking", "Stop speaking")
        : t("voice.speak", "Read aloud");

    return (
        <button
            type="button"
            className={`speech-button ${speaking ? "speech-button--speaking" : ""} ${className ?? ""}`}
            data-testid={testId ? `speech-button-${testId}` : "speech-button"}
            data-speaking={speaking ? "true" : "false"}
            onClick={onClick}
            aria-label={aria}
            title={tooltipsOn ? aria : undefined}
        >
            <span className="speech-button__icon" aria-hidden="true">
                {speaking ? "■" : "▶"}
            </span>
            {label && <span className="speech-button__label">{label}</span>}
        </button>
    );
}

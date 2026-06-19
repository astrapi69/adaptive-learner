/**
 * ReadAloudButton — a compact speaker-icon button that reads one
 * piece of lesson text aloud (TTS feature C1/C2).
 *
 * Used inline next to theory headings, exercise prompts, matching /
 * picture / word-tile labels, cloze sentences, and the summary's
 * correct answers. Each instance owns its own play/stop state (the
 * same contract as the older SpeechButton); the underlying
 * ``speak()`` cancels any prior utterance so two buttons never
 * overlap.
 *
 * Hidden entirely when the browser has no speechSynthesis OR the
 * user disabled TTS in Voice Settings. ``lang`` drives voice
 * selection so a Spanish card speaks Spanish; the inline lesson
 * speed (0.5/0.75/1/1.25x, remembered) multiplies the saved rate.
 *
 * NOT rendered for code/formula content — reading code aloud is
 * useless; callers gate on ``media_type`` before mounting this.
 */

import {useEffect, useRef, useState} from "react";
import {Volume2, Square} from "lucide-react";

import {useButtonTooltips} from "../../hooks/settings/useButtonTooltips";
import {useI18n} from "../../hooks/ui/useI18n";
import {readLessonSpeed} from "../../hooks/lesson/useReadAloud";
import {
    isSpeechSynthesisSupported,
    loadVoices,
    pickVoice,
    speak,
    stop,
} from "../../lib/voice/speech-synthesis";
import {readVoicePrefs} from "../../lib/voice/voicePref";

interface ReadAloudButtonProps {
    /** The text to read. Empty / whitespace renders nothing. */
    text: string;
    /** BCP-47 language code for voice selection. */
    lang?: string;
    /** Optional visible label beside the icon (icon-only by default). */
    label?: string;
    className?: string;
    /** ``data-testid`` suffix; the root gets ``read-aloud-{suffix}``. */
    testId?: string;
}

export default function ReadAloudButton({
    text,
    lang,
    label,
    className,
    testId,
}: ReadAloudButtonProps) {
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

    // Stop on unmount so a label keeps no audio playing after the
    // step changes or the user navigates away.
    useEffect(() => {
        return () => {
            if (speaking) stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!supported || !ttsEnabled.current || !text.trim()) {
        return null;
    }

    const effectiveLang = lang || docLang || "en";

    const onClick = () => {
        if (speaking) {
            stop();
            setSpeaking(false);
            return;
        }
        const prefs = readVoicePrefs();
        const voice =
            prefs.ttsVoiceName.length > 0
                ? (voiceList.find((v) => v.name === prefs.ttsVoiceName) ?? null)
                : pickVoice(voiceList, effectiveLang);
        setSpeaking(true);
        speak(text, {
            lang: effectiveLang,
            voice,
            // Inline lesson speed (read fresh so a speed change mid-lesson
            // takes effect on the next click) multiplies the saved rate.
            rate: prefs.ttsRate * readLessonSpeed(),
            pitch: prefs.ttsPitch,
            onEnd: () => setSpeaking(false),
            onError: () => setSpeaking(false),
        });
    };

    const aria = speaking
        ? t("lesson.tts.stop", "Stop")
        : t("lesson.tts.read_aloud", "Read aloud");

    return (
        <button
            type="button"
            className={`read-aloud-button${
                speaking ? " is-speaking" : ""
            }${className ? ` ${className}` : ""}`}
            data-testid={testId ? `read-aloud-${testId}` : "read-aloud"}
            data-speaking={speaking ? "true" : "false"}
            onClick={onClick}
            aria-label={aria}
            title={tooltipsOn ? aria : undefined}
        >
            <span className="read-aloud-button__icon" aria-hidden="true">
                {speaking ? <Square size={14} /> : <Volume2 size={14} />}
            </span>
            {label && <span className="read-aloud-button__label">{label}</span>}
        </button>
    );
}

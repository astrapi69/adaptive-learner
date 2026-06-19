/**
 * Settings > Voice section (Phase 31D / v1.18.0).
 *
 * Six controls:
 *   - TTS enabled (localStorage)
 *   - TTS voice (dropdown of available browser voices, "Default" = empty)
 *   - TTS rate (slider 0.5..2.0)
 *   - TTS pitch (slider 0.5..2.0)
 *   - STT enabled (localStorage)
 *   - Auto-play AI responses (localStorage, default off)
 *   - STT language override (text input)
 *   - Pronunciation enabled (localStorage; per-spec defaults true,
 *     and the page hides itself anyway when the project has no
 *     Languages subject)
 *
 * Hides the entire section when the browser supports neither
 * speechSynthesis nor SpeechRecognition (graceful degradation —
 * the user sees no broken controls).
 */

import {useEffect, useState} from "react";

import {useI18n} from "../hooks/ui/useI18n";
import {
    isSpeechRecognitionSupported,
} from "../lib/voice/speech-recognition";
import {
    isSpeechSynthesisSupported,
    loadVoices,
} from "../lib/voice/speech-synthesis";
import {
    readVoicePrefs,
    writeAutoPlayAi,
    writePronunciationEnabled,
    writeSttEnabled,
    writeSttLangOverride,
    writeTtsEnabled,
    writeTtsPitch,
    writeTtsRate,
    writeTtsVoiceName,
} from "../lib/voice/voicePref";

export default function VoiceSettingsSection() {
    const {t} = useI18n();
    const [prefs, setPrefs] = useState(() => readVoicePrefs());
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const ttsSupported = isSpeechSynthesisSupported();
    const sttSupported = isSpeechRecognitionSupported();

    useEffect(() => {
        if (!ttsSupported) return;
        let cancelled = false;
        loadVoices().then((vs) => {
            if (!cancelled) setVoices(vs);
        });
        return () => {
            cancelled = true;
        };
    }, [ttsSupported]);

    if (!ttsSupported && !sttSupported) {
        // Browser supports neither — hide the section entirely
        // rather than render a row of disabled controls.
        return null;
    }

    const setLocal = (patch: Partial<typeof prefs>) =>
        setPrefs((p) => ({...p, ...patch}));

    return (
        <section
            className="settings-section"
            data-testid="settings-section-voice"
        >
            <h2 className="settings-section-title">
                {t("settings.section_voice", "Voice")}
            </h2>

            {ttsSupported && (
                <>
                    <label className="form-row form-row-toggle">
                        <span className="form-label-stack">
                            <span className="form-label">
                                {t(
                                    "settings.voice.tts_enabled",
                                    "Show speech buttons",
                                )}
                            </span>
                            <span className="form-hint">
                                {t(
                                    "settings.voice.tts_enabled_help",
                                    "Reads AI responses aloud when you click the speaker icon.",
                                )}
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={prefs.ttsEnabled}
                            onChange={(e) => {
                                writeTtsEnabled(e.target.checked);
                                setLocal({ttsEnabled: e.target.checked});
                            }}
                            data-testid="settings-tts-enabled"
                        />
                    </label>

                    <label className="form-row form-row-toggle">
                        <span className="form-label-stack">
                            <span className="form-label">
                                {t(
                                    "settings.voice.auto_play",
                                    "Auto-play AI responses",
                                )}
                            </span>
                            <span className="form-hint">
                                {t(
                                    "settings.voice.auto_play_help",
                                    "Speak each AI response automatically (default off).",
                                )}
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={prefs.autoPlayAi}
                            onChange={(e) => {
                                writeAutoPlayAi(e.target.checked);
                                setLocal({autoPlayAi: e.target.checked});
                            }}
                            data-testid="settings-auto-play"
                        />
                    </label>

                    <label className="form-row">
                        <span className="form-label-stack">
                            <span className="form-label">
                                {t("settings.voice.tts_voice", "Voice")}
                            </span>
                            <span className="form-hint">
                                {t(
                                    "settings.voice.tts_voice_help",
                                    "Default uses the closest match for your project language.",
                                )}
                            </span>
                        </span>
                        <select
                            value={prefs.ttsVoiceName}
                            onChange={(e) => {
                                writeTtsVoiceName(e.target.value);
                                setLocal({ttsVoiceName: e.target.value});
                            }}
                            data-testid="settings-tts-voice"
                        >
                            <option value="">
                                {t(
                                    "settings.voice.voice_default",
                                    "Default (auto-pick)",
                                )}
                            </option>
                            {voices.map((v) => (
                                <option key={v.name} value={v.name}>
                                    {v.name} ({v.lang})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="form-row">
                        <span className="form-label-stack">
                            <span className="form-label">
                                {t("settings.voice.tts_rate", "Rate")}
                            </span>
                            <span className="form-hint">
                                {prefs.ttsRate.toFixed(2)} ×
                            </span>
                        </span>
                        <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.05"
                            value={prefs.ttsRate}
                            onChange={(e) => {
                                const v = Number.parseFloat(e.target.value);
                                writeTtsRate(v);
                                setLocal({ttsRate: v});
                            }}
                            data-testid="settings-tts-rate"
                        />
                    </label>

                    <label className="form-row">
                        <span className="form-label-stack">
                            <span className="form-label">
                                {t("settings.voice.tts_pitch", "Pitch")}
                            </span>
                            <span className="form-hint">
                                {prefs.ttsPitch.toFixed(2)} ×
                            </span>
                        </span>
                        <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.05"
                            value={prefs.ttsPitch}
                            onChange={(e) => {
                                const v = Number.parseFloat(e.target.value);
                                writeTtsPitch(v);
                                setLocal({ttsPitch: v});
                            }}
                            data-testid="settings-tts-pitch"
                        />
                    </label>
                </>
            )}

            {sttSupported && (
                <>
                    <label className="form-row form-row-toggle">
                        <span className="form-label-stack">
                            <span className="form-label">
                                {t(
                                    "settings.voice.stt_enabled",
                                    "Show microphone button",
                                )}
                            </span>
                            <span className="form-hint">
                                {t(
                                    "settings.voice.stt_enabled_help",
                                    "Dictate your replies via the browser's speech recognition.",
                                )}
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={prefs.sttEnabled}
                            onChange={(e) => {
                                writeSttEnabled(e.target.checked);
                                setLocal({sttEnabled: e.target.checked});
                            }}
                            data-testid="settings-stt-enabled"
                        />
                    </label>

                    <label className="form-row">
                        <span className="form-label-stack">
                            <span className="form-label">
                                {t(
                                    "settings.voice.stt_lang",
                                    "Dictation language override",
                                )}
                            </span>
                            <span className="form-hint">
                                {t(
                                    "settings.voice.stt_lang_help",
                                    "Leave empty to use the project / UI language. Format: BCP-47 (e.g. en-US, es-ES).",
                                )}
                            </span>
                        </span>
                        <input
                            type="text"
                            value={prefs.sttLangOverride}
                            placeholder="en-US"
                            onChange={(e) => {
                                writeSttLangOverride(e.target.value);
                                setLocal({sttLangOverride: e.target.value});
                            }}
                            data-testid="settings-stt-lang"
                        />
                    </label>
                </>
            )}

            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t(
                            "settings.voice.pronunciation_enabled",
                            "Pronunciation Practice",
                        )}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.voice.pronunciation_enabled_help",
                            "Surfaces a 'Pronunciation Practice' button on language-learning project dashboards.",
                        )}
                    </span>
                </span>
                <input
                    type="checkbox"
                    checked={prefs.pronunciationEnabled}
                    onChange={(e) => {
                        writePronunciationEnabled(e.target.checked);
                        setLocal({pronunciationEnabled: e.target.checked});
                    }}
                    data-testid="settings-pronunciation-enabled"
                />
            </label>
        </section>
    );
}

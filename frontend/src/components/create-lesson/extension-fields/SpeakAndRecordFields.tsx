/**
 * Authoring fields for ``ext:al-speak-and-record`` (#2817, editor 7): the
 * sentence read aloud plus an optional reference clip. Pure + props-driven,
 * mirrors {@link DictationFields} — the audio picker is the SAME
 * {@link DictationAudioField} (#1911), reused as-is per the reusability
 * hierarchy (no near-duplicate audio-upload control). Unlike dictation this
 * extension is deliberately UNGRADED (engine#68 idea 3): no accepted-answers
 * list, no conversion target — there is nothing to check a recording
 * against.
 */

import {Input} from "@/components/ui/input";
import {DictationAudioField} from "../fields";

type Translate = (key: string, fallback?: string) => string;

interface SpeakAndRecordPayload {
    sentence: string;
    audio?: string;
}

export default function SpeakAndRecordFields({
    id,
    payload,
    onChange,
    t,
}: {
    id: string;
    payload: SpeakAndRecordPayload;
    onChange: (payload: SpeakAndRecordPayload) => void;
    t: Translate;
}) {
    const sentence = payload?.sentence ?? "";
    const audio = payload?.audio ?? "";

    return (
        <div className="flex flex-col gap-3">
            <label className="form-field flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.extensions.edit.sar_sentence_label",
                        "Sentence to speak",
                    )}
                </span>
                <Input
                    type="text"
                    maxLength={500}
                    value={sentence}
                    placeholder={t(
                        "create_lesson.extensions.edit.sar_sentence_placeholder",
                        "The sentence the learner hears and repeats",
                    )}
                    data-testid={`exercise-ext-sar-sentence-${id}`}
                    onChange={(e) => onChange({sentence: e.target.value, audio})}
                />
            </label>

            <DictationAudioField
                id={id}
                value={audio}
                onChange={(next) => onChange({sentence, audio: next})}
                t={t}
            />
        </div>
    );
}

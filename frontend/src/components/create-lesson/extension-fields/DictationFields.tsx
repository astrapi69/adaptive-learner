/**
 * Authoring fields for ``ext:al-dictation`` (#1887, editor 5): a typed audio
 * reference plus the accepted transcriptions the learner may type. Pure +
 * props-driven — the parent owns the ``ext_payload``.
 *
 * v1 takes a typed ``assets/`` path only (no upload — that is a later
 * sub-step, analogous to the card image upload #1764). The accepted answers
 * reuse the shared {@link StringListEditor}; the renderer grades them with the
 * shared free-text matcher, so there is no dictation-specific list control or
 * grader.
 */

import {Input} from "@/components/ui/input";
import StringListEditor from "../../../shared/forms/StringListEditor";

type Translate = (key: string, fallback?: string) => string;

interface DictationPayload {
    audio: string;
    accept: string[];
}

export default function DictationFields({
    id,
    payload,
    onChange,
    t,
}: {
    id: string;
    payload: DictationPayload;
    onChange: (payload: DictationPayload) => void;
    t: Translate;
}) {
    const audio = payload?.audio ?? "";
    const accept = payload?.accept ?? [];

    return (
        <div className="flex flex-col gap-3">
            <label className="form-field flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.extensions.edit.dict_audio_label",
                        "Audio file path",
                    )}
                </span>
                <Input
                    type="text"
                    maxLength={500}
                    value={audio}
                    placeholder={t(
                        "create_lesson.extensions.edit.dict_audio_placeholder",
                        "assets/audio/clip.mp3",
                    )}
                    data-testid={`exercise-ext-dict-audio-${id}`}
                    onChange={(e) => onChange({audio: e.target.value, accept})}
                />
                <span className="form-hint text-xs text-fg-muted">
                    {t(
                        "create_lesson.extensions.edit.dict_audio_hint",
                        "Relative path to the audio clip inside the set's assets folder.",
                    )}
                </span>
            </label>

            <StringListEditor
                values={accept}
                onChange={(next) => onChange({audio, accept: next})}
                label={t(
                    "create_lesson.extensions.edit.dict_accept_label",
                    "Accepted transcriptions",
                )}
                addButtonLabel={t(
                    "create_lesson.extensions.edit.dict_accept_add",
                    "Add",
                )}
                removeItemLabel={t(
                    "create_lesson.extensions.edit.dict_accept_remove",
                    "Remove transcription",
                )}
                placeholder={t(
                    "create_lesson.extensions.edit.dict_accept_placeholder",
                    "What the learner should type",
                )}
                testIdPrefix={`exercise-ext-dict-accept-${id}`}
            />
        </div>
    );
}

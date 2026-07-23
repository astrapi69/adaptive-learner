/**
 * Authoring fields for ``ext:al-dictation`` (#1887, editor 5): the audio
 * reference plus the accepted transcriptions the learner may type. Pure +
 * props-driven — the parent owns the ``ext_payload``.
 *
 * The audio reference is edited via {@link DictationAudioField} (#1911, Slice
 * 3): upload a clip (stored self-contained as a data URI) OR type an
 * ``assets/`` path — the typed path kept as an alternative, not replaced. The
 * accepted answers reuse the shared {@link StringListEditor}; the renderer
 * grades them with the shared free-text matcher, so there is no
 * dictation-specific list control or grader.
 */

import StringListEditor from "../../../shared/forms/StringListEditor";
import DictationAudioField from "../DictationAudioField";

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
            <DictationAudioField
                id={id}
                value={audio}
                onChange={(next) => onChange({audio: next, accept})}
                t={t}
            />

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

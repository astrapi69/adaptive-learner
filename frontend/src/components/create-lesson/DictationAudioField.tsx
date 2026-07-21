/**
 * DictationAudioField — audio picker for the dictation editor (#1911,
 * ext:al-dictation Slice 3).
 *
 * Adds a real, browser-only file upload to the ``ext:al-dictation`` audio
 * field, mirroring {@link CardImageField} (#1763/#1764): pick a clip, it is
 * validated + read client-side into a base64 data URI ({@link
 * processAudioFile}) and reported via ``onChange`` for storage in
 * ``ext_payload.audio`` (self-contained, survives lesson export/import, plays
 * in Dexie mode without an assets folder). An inline ``<audio controls>``
 * preview + Remove control follow.
 *
 * The manual asset-path entry is KEPT as an alternative for content-repo
 * authors who reference a clip that ships in the set's ``assets/`` directory —
 * upload is additive, not a replacement (#1881 shipped the typed path). The
 * path input keeps its established ``exercise-ext-dict-audio-<id>`` testid and
 * shows blank while an uploaded data URI is active (the base64 blob never
 * leaks into the plain-text box).
 *
 * Presentational + props-driven (``t`` injected like the sibling extension
 * fields); the parent owns the value. Failures show an inline, translated
 * error rather than crashing.
 */

import {useRef, useState} from "react";
import {FileAudio, Trash2} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import FormHint from "../../shared/forms/FormHint";
import {
    AUDIO_ACCEPT_ATTR,
    DICT_AUDIO_ERROR_DECODE,
    isDataUri,
    processAudioFile,
} from "../../lib/content/lesson/dictation-audio";

type Translate = (key: string, fallback?: string) => string;

export interface DictationAudioFieldProps {
    /** Exercise id — keeps the field's testids stable + unique per row. */
    id: string;
    /** Current audio reference: an uploaded data URI, an asset path, or "". */
    value: string;
    /** Receives the new value (data URI, path, or "" when cleared). */
    onChange: (value: string) => void;
    /** Injected translator (the extension fields are ``t``-driven). */
    t: Translate;
}

export default function DictationAudioField({
    id,
    value,
    onChange,
    t,
}: DictationAudioFieldProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasUpload = isDataUri(value);

    function resetFileInput(): void {
        if (fileRef.current) fileRef.current.value = "";
    }

    async function handleFile(file: File | undefined): Promise<void> {
        setError(null);
        if (!file) return;
        setBusy(true);
        try {
            const dataUrl = await processAudioFile(file);
            onChange(dataUrl);
        } catch (uploadError) {
            setError(
                uploadError instanceof Error
                    ? uploadError.message
                    : DICT_AUDIO_ERROR_DECODE,
            );
        } finally {
            setBusy(false);
            resetFileInput();
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <span className="form-label text-sm font-medium text-fg-primary">
                {t("create_lesson.extensions.edit.dict_audio_label", "Audio")}
            </span>

            {hasUpload ? (
                <div className="flex flex-wrap items-center gap-3">
                    <audio
                        controls
                        src={value}
                        className="h-11 max-w-full"
                        data-testid={`exercise-ext-dict-audio-preview-${id}`}
                        aria-label={t(
                            "create_lesson.extensions.edit.dict_audio_preview_label",
                            "Audio preview",
                        )}
                    >
                        <track kind="captions" />
                    </audio>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 gap-1.5"
                        disabled={busy}
                        onClick={() => {
                            onChange("");
                            setError(null);
                        }}
                        data-testid={`exercise-ext-dict-audio-remove-${id}`}
                    >
                        <Trash2 aria-hidden="true" />
                        {t("create_lesson.extensions.edit.dict_audio_remove", "Remove")}
                    </Button>
                </div>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-fit gap-1.5"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    data-testid={`exercise-ext-dict-audio-upload-${id}`}
                >
                    <FileAudio aria-hidden="true" />
                    {t(
                        "create_lesson.extensions.edit.dict_audio_upload",
                        "Upload audio",
                    )}
                </Button>
            )}

            <input
                ref={fileRef}
                type="file"
                accept={AUDIO_ACCEPT_ATTR}
                className="hidden"
                aria-label={t(
                    "create_lesson.extensions.edit.dict_audio_upload",
                    "Upload audio",
                )}
                data-testid={`exercise-ext-dict-audio-file-${id}`}
                onChange={(e) => void handleFile(e.target.files?.[0])}
            />

            {error && (
                <FormHint
                    as="span"
                    role="alert"
                    className="text-[var(--error)]"
                    data-testid={`exercise-ext-dict-audio-error-${id}`}
                >
                    {t(error, "That audio file could not be used.")}
                </FormHint>
            )}

            <label className="flex flex-col gap-1">
                <span className="sr-only">
                    {t(
                        "create_lesson.extensions.edit.dict_audio_path_label",
                        "Or type an asset path",
                    )}
                </span>
                <Input
                    type="text"
                    maxLength={500}
                    value={isDataUri(value) ? "" : value}
                    placeholder={t(
                        "create_lesson.extensions.edit.dict_audio_placeholder",
                        "assets/audio/clip.mp3",
                    )}
                    data-testid={`exercise-ext-dict-audio-${id}`}
                    aria-label={t(
                        "create_lesson.extensions.edit.dict_audio_path_label",
                        "Or type an asset path",
                    )}
                    onChange={(e) => onChange(e.target.value)}
                />
                <FormHint as="span">
                    {t(
                        "create_lesson.extensions.edit.dict_audio_hint",
                        "Relative path to the audio clip inside the set's assets folder.",
                    )}
                </FormHint>
            </label>
        </div>
    );
}

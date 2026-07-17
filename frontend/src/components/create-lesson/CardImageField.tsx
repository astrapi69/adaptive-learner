/**
 * CardImageField — card image picker for the Lesson Creator (#1763).
 *
 * Replaces the old "type an asset path" text box with a real, browser-only
 * file upload: pick an image, it is compressed client-side to a small
 * base64 data URI ({@link processCardImageFile}) and reported via
 * ``onChange`` for storage in the card's ``image`` field (self-contained,
 * survives lesson export/import). A live preview + Remove control follow.
 *
 * The manual asset-path entry is kept as an "Advanced" fallback for
 * content-repo authors who reference an image that ships in the set's
 * ``assets/`` directory. It opens automatically when the current value is
 * a plain path rather than an uploaded data URI.
 *
 * Presentational + props-driven; the parent owns the value. Failures show
 * an inline, translated error rather than crashing.
 */

import {useRef, useState} from "react";
import {ImagePlus, Trash2} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useI18n} from "../../hooks/ui/useI18n";
import FormHint from "../../shared/forms/FormHint";
import {
    ACCEPTED_CARD_IMAGE_TYPES,
    CARD_IMAGE_ERROR_DECODE,
    isDataUri,
    processCardImageFile,
} from "../../lib/content/lesson/card-image";

export interface CardImageFieldProps {
    /** Current image reference: an uploaded data URI, an asset path, or "". */
    value: string;
    /** Receives the new value (data URI, path, or "" when cleared). */
    onChange: (value: string) => void;
    /** Alt text for the preview (e.g. the card's front). */
    previewAlt?: string;
    /** Testid prefix, so add-form and per-row edit instances stay distinct. */
    idPrefix?: string;
}

export default function CardImageField({
    value,
    onChange,
    previewAlt,
    idPrefix = "card",
}: CardImageFieldProps) {
    const {t} = useI18n();
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPath, setShowPath] = useState(
        () => value.trim().length > 0 && !isDataUri(value),
    );

    const hasImage = isDataUri(value);

    function resetFileInput(): void {
        if (fileRef.current) fileRef.current.value = "";
    }

    async function handleFile(file: File | undefined): Promise<void> {
        setError(null);
        if (!file) return;
        setBusy(true);
        try {
            const dataUrl = await processCardImageFile(file);
            onChange(dataUrl);
        } catch (e) {
            setError(e instanceof Error ? e.message : CARD_IMAGE_ERROR_DECODE);
        } finally {
            setBusy(false);
            resetFileInput();
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <span className="form-label text-sm font-medium text-fg-primary">
                {t("create_lesson.cards.image_label", "Image (optional)")}
            </span>

            {hasImage ? (
                <div className="flex items-center gap-3">
                    <img
                        src={value}
                        alt={
                            previewAlt ??
                            t("create_lesson.cards.image_preview_alt", "Card image")
                        }
                        className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
                        data-testid={`${idPrefix}-image-preview`}
                    />
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
                        data-testid={`${idPrefix}-image-remove`}
                    >
                        <Trash2 aria-hidden="true" />
                        {t("create_lesson.cards.image_remove", "Remove")}
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
                    data-testid={`${idPrefix}-image-upload`}
                >
                    <ImagePlus aria-hidden="true" />
                    {t("create_lesson.cards.image_upload", "Upload image")}
                </Button>
            )}

            <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_CARD_IMAGE_TYPES.join(",")}
                className="hidden"
                aria-label={t("create_lesson.cards.image_upload", "Upload image")}
                data-testid={`${idPrefix}-image-file`}
                onChange={(e) => void handleFile(e.target.files?.[0])}
            />

            {error && (
                <FormHint
                    as="span"
                    role="alert"
                    className="text-[var(--error)]"
                    data-testid={`${idPrefix}-image-error`}
                >
                    {t(error, "That image could not be used.")}
                </FormHint>
            )}

            <button
                type="button"
                className="w-fit text-left text-xs text-fg-muted underline-offset-2 hover:underline"
                aria-expanded={showPath}
                onClick={() => setShowPath((v) => !v)}
                data-testid={`${idPrefix}-image-path-toggle`}
            >
                {t("create_lesson.cards.image_path_toggle", "Advanced: use an asset path")}
            </button>

            {showPath && (
                <label className="flex flex-col gap-1">
                    <span className="sr-only">
                        {t("create_lesson.cards.image_path_label", "Asset path")}
                    </span>
                    <Input
                        type="text"
                        value={isDataUri(value) ? "" : value}
                        placeholder="img/bonjour.png"
                        data-testid={`${idPrefix}-image-path`}
                        aria-label={t(
                            "create_lesson.cards.image_path_label",
                            "Asset path",
                        )}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <FormHint as="span">
                        {t(
                            "create_lesson.cards.image_path_hint",
                            "A path inside the set's assets/ folder. For repo-published sets only.",
                        )}
                    </FormHint>
                </label>
            )}
        </div>
    );
}

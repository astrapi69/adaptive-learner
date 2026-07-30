/**
 * Authoring fields for ``ext:al-image-description`` (#2095, editor 6): the
 * image the learner must describe plus the accepted answers. Pure +
 * props-driven — the parent owns the ``ext_payload``.
 *
 * The image is edited via the shared {@link CardImageField}: upload a file
 * (compressed client-side to a small, self-contained ``data:`` URI via
 * ``processCardImageFile`` — max ~150 KB / 512 px) OR type an ``assets/`` path.
 * Uploading keeps the exercise offline-capable and makes it ride the ``.alb``
 * backup verbatim. A visible size-budget hint surfaces the embedded cost so the
 * author knows what each image adds to IndexedDB / the backup (relevant to the
 * iOS eviction risk). The accepted answers reuse the shared
 * {@link StringListEditor}; the renderer grades them with the shared free-text
 * matcher, so there is no image-specific list control or grader.
 */

import CardImageField from "../CardImageField";
import StringListEditor from "../../../shared/forms/StringListEditor";
import FormHint from "../../../shared/forms/FormHint";

type Translate = (key: string, fallback?: string) => string;

interface ImageDescriptionPayload {
    image: string;
    accept: string[];
}

export default function ImageDescriptionFields({
    id,
    payload,
    onChange,
    t,
}: {
    id: string;
    payload: ImageDescriptionPayload;
    onChange: (payload: ImageDescriptionPayload) => void;
    t: Translate;
}) {
    const image = payload?.image ?? "";
    const accept = payload?.accept ?? [];

    return (
        <div className="flex flex-col gap-3">
            <CardImageField
                value={image}
                onChange={(next) => onChange({image: next, accept})}
                idPrefix={`exercise-ext-imgdesc-${id}`}
                label={t(
                    "create_lesson.extensions.edit.imgdesc_image_label",
                    "Image to describe",
                )}
                previewAlt={t(
                    "create_lesson.extensions.edit.imgdesc_image_preview_alt",
                    "Image to describe",
                )}
            />

            <FormHint as="span" data-testid={`exercise-ext-imgdesc-budget-${id}`}>
                {t(
                    "create_lesson.extensions.edit.imgdesc_image_budget_hint",
                    "The image is compressed and embedded (max ~150 KB, 512 px) so the exercise works offline and travels in the backup. Remote links are not allowed.",
                )}
            </FormHint>

            <StringListEditor
                values={accept}
                onChange={(next) => onChange({image, accept: next})}
                label={t(
                    "create_lesson.extensions.edit.imgdesc_accept_label",
                    "Accepted answers",
                )}
                addButtonLabel={t(
                    "create_lesson.extensions.edit.imgdesc_accept_add",
                    "Add",
                )}
                removeItemLabel={t(
                    "create_lesson.extensions.edit.imgdesc_accept_remove",
                    "Remove answer",
                )}
                placeholder={t(
                    "create_lesson.extensions.edit.imgdesc_accept_placeholder",
                    "What the learner should type",
                )}
                testIdPrefix={`exercise-ext-imgdesc-accept-${id}`}
            />
        </div>
    );
}

/**
 * Authoring fields for ``ext:al-ordering`` (#3110): the steps in their
 * correct order. Pure + props-driven — the parent owns the
 * ``ext_payload``. Reuses the shared {@link StringListEditor} (mirrors
 * ``DictationFields``'s accept-list authoring); the renderer grades the
 * exact index sequence, so there is no ordering-specific list control.
 */

import StringListEditor from "../../../shared/forms/StringListEditor";

type Translate = (key: string, fallback?: string) => string;

interface OrderingPayload {
    items: string[];
}

export default function OrderingFields({
    id,
    payload,
    onChange,
    t,
}: {
    id: string;
    payload: OrderingPayload;
    onChange: (payload: OrderingPayload) => void;
    t: Translate;
}) {
    const items = payload?.items ?? [];

    return (
        <StringListEditor
            values={items}
            onChange={(next) => onChange({items: next})}
            label={t(
                "create_lesson.extensions.edit.ordering_items_label",
                "Steps, in the correct order",
            )}
            addButtonLabel={t("create_lesson.extensions.edit.ordering_item_add", "Add step")}
            removeItemLabel={t(
                "create_lesson.extensions.edit.ordering_item_remove",
                "Remove step",
            )}
            placeholder={t(
                "create_lesson.extensions.edit.ordering_item_placeholder",
                "Step",
            )}
            testIdPrefix={`exercise-ext-ordering-items-${id}`}
        />
    );
}

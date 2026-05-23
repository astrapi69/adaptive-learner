/**
 * TagManager (Phase 22D).
 *
 * Per-user list of tags with:
 *  - inline create (name + optional color picker)
 *  - inline rename
 *  - per-row delete with confirm
 *  - optional click-to-select callback for filter use (Dashboard)
 *
 * Tags belong to a user; the parent component passes ``userId``
 * once. Color is an HTML <input type="color"> for simplicity;
 * the UI renders each tag as a colored badge.
 */

import {useEffect, useState} from "react";

import {useI18n} from "../hooks/useI18n";
import {getStorage} from "../storage";
import type {Tag} from "../types/domain";
import {notify} from "../utils/notify";

interface TagManagerProps {
    userId: string;
    /** Currently-selected tag ids (multi-select friendly). */
    selectedTagIds?: ReadonlySet<string>;
    /** Toggle a single tag's selection. */
    onToggleSelected?: (tagId: string) => void;
    /** When true, hides create + rename + delete affordances. */
    readOnly?: boolean;
}

const DEFAULT_COLOR = "#6366f1";

export default function TagManager({
    userId,
    selectedTagIds,
    onToggleSelected,
    readOnly = false,
}: TagManagerProps) {
    const {t} = useI18n();
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState(DEFAULT_COLOR);
    const [submitting, setSubmitting] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

    async function refresh() {
        setLoading(true);
        try {
            const rows = await getStorage().tags.list(userId);
            setTags(rows);
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.tag_load_failed", "Failed to load tags."),
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, [userId]);

    async function handleCreate() {
        const trimmed = newName.trim();
        if (!trimmed) return;
        setSubmitting(true);
        try {
            await getStorage().tags.create(userId, {
                name: trimmed,
                color: newColor,
            });
            notify.success(t("taxonomy.tag_added", "Tag added."));
            setNewName("");
            setNewColor(DEFAULT_COLOR);
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.tag_add_failed", "Could not add tag."),
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function handleRename(tagId: string) {
        const trimmed = renameValue.trim();
        if (!trimmed) return;
        setSubmitting(true);
        try {
            await getStorage().tags.update(tagId, {name: trimmed});
            notify.success(t("taxonomy.tag_renamed", "Tag renamed."));
            setRenamingId(null);
            setRenameValue("");
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.tag_rename_failed", "Could not rename tag."),
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function handleColorChange(tag: Tag, color: string) {
        try {
            await getStorage().tags.update(tag.id, {color});
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.tag_color_failed", "Could not update color."),
            );
        }
    }

    async function handleDelete(tag: Tag) {
        if (!window.confirm(t("taxonomy.tag_delete_confirm", `Delete tag '${tag.name}'?`))) {
            return;
        }
        try {
            await getStorage().tags.remove(tag.id);
            notify.success(t("taxonomy.tag_deleted", "Tag deleted."));
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.tag_delete_failed", "Could not delete tag."),
            );
        }
    }

    if (loading) {
        return (
            <div className="tag-manager" data-testid="tag-manager-loading">
                {t("taxonomy.loading", "Loading tags…")}
            </div>
        );
    }

    return (
        <div className="tag-manager" data-testid="tag-manager">
            {!readOnly && (
                <form
                    className="tag-create-form"
                    data-testid="tag-create-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleCreate();
                    }}
                >
                    <input
                        type="text"
                        data-testid="tag-create-input"
                        placeholder={t("taxonomy.tag_name", "New tag")}
                        aria-label={t("taxonomy.tag_name", "New tag")}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        disabled={submitting}
                    />
                    <input
                        type="color"
                        data-testid="tag-create-color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        disabled={submitting}
                        aria-label={t("taxonomy.tag_color", "Tag color")}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        data-testid="tag-create-submit"
                        disabled={submitting || newName.trim().length === 0}
                    >
                        {t("taxonomy.add_tag", "Add")}
                    </button>
                </form>
            )}
            {tags.length === 0 ? (
                <div className="tag-manager-empty" data-testid="tag-manager-empty">
                    {t("taxonomy.no_tags", "No tags yet.")}
                </div>
            ) : (
                <ul className="tag-list" data-testid="tag-list">
                    {tags.map((tag) => {
                        const isSelected = selectedTagIds?.has(tag.id) ?? false;
                        return (
                            <li
                                key={tag.id}
                                className="tag-list-item"
                                data-testid={`tag-item-${tag.id}`}
                            >
                                {renamingId === tag.id ? (
                                    <form
                                        className="tag-rename-form"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            void handleRename(tag.id);
                                        }}
                                    >
                                        <input
                                            type="text"
                                            data-testid={`tag-rename-input-${tag.id}`}
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            autoFocus
                                            disabled={submitting}
                                        />
                                        <button
                                            type="submit"
                                            className="btn btn-primary btn-sm"
                                            disabled={
                                                submitting ||
                                                renameValue.trim().length === 0
                                            }
                                        >
                                            {t("common.save", "Save")}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setRenamingId(null)}
                                        >
                                            {t("common.cancel", "Cancel")}
                                        </button>
                                    </form>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className={`tag-badge${isSelected ? " tag-badge-selected" : ""}`}
                                            data-testid={`tag-badge-${tag.id}`}
                                            style={{
                                                backgroundColor:
                                                    tag.color ?? DEFAULT_COLOR,
                                            }}
                                            onClick={() => onToggleSelected?.(tag.id)}
                                        >
                                            {tag.name}
                                        </button>
                                        {!readOnly && (
                                            <>
                                                <input
                                                    type="color"
                                                    className="tag-color-picker"
                                                    data-testid={`tag-color-picker-${tag.id}`}
                                                    value={tag.color ?? DEFAULT_COLOR}
                                                    onChange={(e) =>
                                                        void handleColorChange(
                                                            tag,
                                                            e.target.value,
                                                        )
                                                    }
                                                    aria-label={t(
                                                        "taxonomy.tag_color",
                                                        "Tag color",
                                                    )}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    data-testid={`tag-rename-${tag.id}`}
                                                    onClick={() => {
                                                        setRenamingId(tag.id);
                                                        setRenameValue(tag.name);
                                                    }}
                                                >
                                                    {t("common.rename", "Rename")}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-danger btn-sm"
                                                    data-testid={`tag-delete-${tag.id}`}
                                                    onClick={() => void handleDelete(tag)}
                                                >
                                                    {t("common.delete", "Delete")}
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

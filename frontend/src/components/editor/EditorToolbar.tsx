/**
 * EditorToolbar — formatting controls for ``RichTextEditor``
 * (Phase 27A).
 *
 * Receives the live ``Editor`` instance from the parent
 * (typically via the ``onEditorReady`` callback on
 * ``RichTextEditor``) and wires every button to its command
 * API. Re-renders on every TipTap transaction so
 * ``aria-pressed`` reflects the current selection state.
 *
 * Since #672 the run/isActive/disabled logic + glyph + label for every
 * action live in the shared ``editor-commands`` registry, consumed by
 * BOTH this toolbar and ``EditorContextMenu`` (DRY — no duplicated
 * ``editor.chain()`` calls).
 *
 * Groups (separated by ``.editor-toolbar-divider``):
 *
 *   text style  | structure       | insert       | history
 *   B I U S H   | H1 H2 H3 lists  | link code <> | undo redo
 *
 * Mobile-friendly: the toolbar container is
 * ``overflow-x: auto`` so the row scrolls horizontally on
 * narrow viewports. Buttons render text glyphs (no icon
 * library), matching the project's no-icon-library convention.
 */

import type {Editor} from "@tiptap/react";
import {Fragment, useEffect, useState} from "react";
import {useI18n} from "../../hooks/ui/useI18n";
import {EDITOR_COMMANDS, TOOLBAR_GROUPS} from "./editor-commands";

interface Props {
    /** TipTap ``Editor`` instance. ``null`` (e.g. parent is
     *  still mounting) -> component renders nothing. */
    editor: Editor | null;
    /** Testid namespace. Each button gets ``${ns}-${action}``. */
    testidNamespace?: string;
    /** When false, hides the heading group (H1-H3). Useful
     *  for short fields like the rating-dialog notes box. */
    showHeadings?: boolean;
    /** When false, hides undo / redo. */
    showHistory?: boolean;
}

export default function EditorToolbar({
    editor,
    testidNamespace = "editor-toolbar",
    showHeadings = true,
    showHistory = true,
}: Props) {
    const {t} = useI18n();
    // Force a re-render on every editor transaction so the
    // ``isActive`` reads below reflect the current selection.
    const [, forceUpdate] = useState({});
    useEffect(() => {
        if (!editor) return;
        const handler = () => forceUpdate({});
        editor.on("transaction", handler);
        editor.on("selectionUpdate", handler);
        return () => {
            editor.off("transaction", handler);
            editor.off("selectionUpdate", handler);
        };
    }, [editor]);

    if (!editor) return null;

    const liveEditor = editor;
    const editingDisabled = !liveEditor.isEditable;

    const visibleGroups = TOOLBAR_GROUPS.filter((group) => {
        if (group.key === "headings") return showHeadings;
        if (group.key === "history") return showHistory;
        return true;
    });

    return (
        <div
            data-testid={`${testidNamespace}-root`}
            className="editor-toolbar"
            role="toolbar"
            aria-label={t("editor.toolbar_label", "Text formatting")}
        >
            {visibleGroups.map((group, index) => (
                <Fragment key={group.key}>
                    {index > 0 ? (
                        <span
                            className="editor-toolbar-divider"
                            aria-hidden="true"
                        />
                    ) : null}
                    <div className="editor-toolbar-group">
                        {group.ids.map((id) => {
                            const command = EDITOR_COMMANDS[id];
                            const active = command.isActive
                                ? command.isActive(liveEditor)
                                : false;
                            const disabled =
                                editingDisabled ||
                                (command.canRun
                                    ? !command.canRun(liveEditor)
                                    : false);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => command.run(liveEditor, {t})}
                                    disabled={disabled}
                                    {...(command.isActive
                                        ? {"aria-pressed": active}
                                        : {})}
                                    data-testid={`${testidNamespace}-${id}`}
                                    title={t(
                                        command.labelKey,
                                        command.labelFallback,
                                    )}
                                    className={`editor-toolbar-btn${active ? " is-active" : ""}`}
                                >
                                    {command.glyph}
                                </button>
                            );
                        })}
                    </div>
                </Fragment>
            ))}
        </div>
    );
}

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
 * Groups (separated by ``.editor-toolbar-divider``):
 *
 *   text style  | structure       | insert       | history
 *   B I U S H   | H1 H2 H3 lists  | link code <> | undo redo
 *
 * Mobile-friendly: the toolbar container is
 * ``overflow-x: auto`` so the row scrolls horizontally on
 * narrow viewports. Buttons are 36 px square (with 44 px
 * tap-target padding on touch-capable devices) to keep
 * touch interactions comfortable.
 *
 * Buttons render text glyphs (no icon library) so the
 * component has zero non-TipTap dependencies and matches the
 * project's existing no-icon-library convention.
 */

import type {Editor} from "@tiptap/react";
import {useEffect, useState} from "react";
import {useI18n} from "../../hooks/useI18n";

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

    const disabled = !editor.isEditable;
    const isActive = (
        name: string,
        attrs?: Record<string, unknown>,
    ): boolean => {
        try {
            return attrs ? editor.isActive(name, attrs) : editor.isActive(name);
        } catch {
            return false;
        }
    };

    const promptForLink = () => {
        const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
        // eslint-disable-next-line no-alert
        const url = window.prompt(
            t("editor.link_prompt", "URL (leave empty to remove the link)"),
            previous,
        );
        if (url === null) return;
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({href: url})
            .run();
    };

    const btnClass = (active: boolean): string =>
        `editor-toolbar-btn${active ? " is-active" : ""}`;

    return (
        <div
            data-testid={`${testidNamespace}-root`}
            className="editor-toolbar"
            role="toolbar"
            aria-label={t("editor.toolbar_label", "Text formatting")}
        >
            <div className="editor-toolbar-group">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={disabled}
                    aria-pressed={isActive("bold")}
                    data-testid={`${testidNamespace}-bold`}
                    title={t("editor.bold", "Bold (Ctrl+B)")}
                    className={btnClass(isActive("bold"))}
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={disabled}
                    aria-pressed={isActive("italic")}
                    data-testid={`${testidNamespace}-italic`}
                    title={t("editor.italic", "Italic (Ctrl+I)")}
                    className={btnClass(isActive("italic"))}
                >
                    <em>I</em>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    disabled={disabled}
                    aria-pressed={isActive("underline")}
                    data-testid={`${testidNamespace}-underline`}
                    title={t("editor.underline", "Underline (Ctrl+U)")}
                    className={btnClass(isActive("underline"))}
                >
                    <span style={{textDecoration: "underline"}}>U</span>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    disabled={disabled}
                    aria-pressed={isActive("strike")}
                    data-testid={`${testidNamespace}-strike`}
                    title={t("editor.strike", "Strikethrough")}
                    className={btnClass(isActive("strike"))}
                >
                    <span style={{textDecoration: "line-through"}}>S</span>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                    disabled={disabled}
                    aria-pressed={isActive("highlight")}
                    data-testid={`${testidNamespace}-highlight`}
                    title={t("editor.highlight", "Highlight")}
                    className={btnClass(isActive("highlight"))}
                >
                    <span className="editor-toolbar-highlight-swatch">H</span>
                </button>
            </div>

            {showHeadings ? (
                <>
                    <span className="editor-toolbar-divider" aria-hidden="true" />
                    <div className="editor-toolbar-group">
                        <button
                            type="button"
                            onClick={() =>
                                editor.chain().focus().toggleHeading({level: 1}).run()
                            }
                            disabled={disabled}
                            aria-pressed={isActive("heading", {level: 1})}
                            data-testid={`${testidNamespace}-h1`}
                            title={t("editor.h1", "Heading 1")}
                            className={btnClass(isActive("heading", {level: 1}))}
                        >
                            H1
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor.chain().focus().toggleHeading({level: 2}).run()
                            }
                            disabled={disabled}
                            aria-pressed={isActive("heading", {level: 2})}
                            data-testid={`${testidNamespace}-h2`}
                            title={t("editor.h2", "Heading 2")}
                            className={btnClass(isActive("heading", {level: 2}))}
                        >
                            H2
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor.chain().focus().toggleHeading({level: 3}).run()
                            }
                            disabled={disabled}
                            aria-pressed={isActive("heading", {level: 3})}
                            data-testid={`${testidNamespace}-h3`}
                            title={t("editor.h3", "Heading 3")}
                            className={btnClass(isActive("heading", {level: 3}))}
                        >
                            H3
                        </button>
                    </div>
                </>
            ) : null}

            <span className="editor-toolbar-divider" aria-hidden="true" />
            <div className="editor-toolbar-group">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    disabled={disabled}
                    aria-pressed={isActive("bulletList")}
                    data-testid={`${testidNamespace}-bullet-list`}
                    title={t("editor.bullet_list", "Bullet list")}
                    className={btnClass(isActive("bulletList"))}
                >
                    •
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    disabled={disabled}
                    aria-pressed={isActive("orderedList")}
                    data-testid={`${testidNamespace}-ordered-list`}
                    title={t("editor.ordered_list", "Ordered list")}
                    className={btnClass(isActive("orderedList"))}
                >
                    1.
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    disabled={disabled}
                    aria-pressed={isActive("taskList")}
                    data-testid={`${testidNamespace}-task-list`}
                    title={t("editor.task_list", "Task list")}
                    className={btnClass(isActive("taskList"))}
                >
                    ☐
                </button>
            </div>

            <span className="editor-toolbar-divider" aria-hidden="true" />
            <div className="editor-toolbar-group">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    disabled={disabled}
                    aria-pressed={editor.isActive({textAlign: "left"})}
                    data-testid={`${testidNamespace}-align-left`}
                    title={t("editor.align_left", "Align left")}
                    className={btnClass(editor.isActive({textAlign: "left"}))}
                >
                    ⇤
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    disabled={disabled}
                    aria-pressed={editor.isActive({textAlign: "center"})}
                    data-testid={`${testidNamespace}-align-center`}
                    title={t("editor.align_center", "Align center")}
                    className={btnClass(editor.isActive({textAlign: "center"}))}
                >
                    ⇔
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    disabled={disabled}
                    aria-pressed={editor.isActive({textAlign: "right"})}
                    data-testid={`${testidNamespace}-align-right`}
                    title={t("editor.align_right", "Align right")}
                    className={btnClass(editor.isActive({textAlign: "right"}))}
                >
                    ⇥
                </button>
            </div>

            <span className="editor-toolbar-divider" aria-hidden="true" />
            <div className="editor-toolbar-group">
                <button
                    type="button"
                    onClick={promptForLink}
                    disabled={disabled}
                    aria-pressed={isActive("link")}
                    data-testid={`${testidNamespace}-link`}
                    title={t("editor.link", "Insert link")}
                    className={btnClass(isActive("link"))}
                >
                    ↗
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    disabled={disabled}
                    aria-pressed={isActive("code")}
                    data-testid={`${testidNamespace}-inline-code`}
                    title={t("editor.inline_code", "Inline code")}
                    className={btnClass(isActive("code"))}
                >
                    <code>{`<>`}</code>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    disabled={disabled}
                    aria-pressed={isActive("codeBlock")}
                    data-testid={`${testidNamespace}-code-block`}
                    title={t("editor.code_block", "Code block")}
                    className={btnClass(isActive("codeBlock"))}
                >
                    <code>{`{ }`}</code>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    disabled={disabled}
                    aria-pressed={isActive("blockquote")}
                    data-testid={`${testidNamespace}-blockquote`}
                    title={t("editor.blockquote", "Quote")}
                    className={btnClass(isActive("blockquote"))}
                >
                    ❝
                </button>
            </div>

            {showHistory ? (
                <>
                    <span className="editor-toolbar-divider" aria-hidden="true" />
                    <div className="editor-toolbar-group">
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().undo().run()}
                            disabled={disabled || !editor.can().undo()}
                            data-testid={`${testidNamespace}-undo`}
                            title={t("editor.undo", "Undo (Ctrl+Z)")}
                            className="editor-toolbar-btn"
                        >
                            ↶
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().redo().run()}
                            disabled={disabled || !editor.can().redo()}
                            data-testid={`${testidNamespace}-redo`}
                            title={t("editor.redo", "Redo (Ctrl+Shift+Z)")}
                            className="editor-toolbar-btn"
                        >
                            ↷
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

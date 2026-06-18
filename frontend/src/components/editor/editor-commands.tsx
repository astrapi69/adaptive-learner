/**
 * editor-commands — the single source of truth for every editor
 * formatting/insert/history/clipboard action (#672, DRY).
 *
 * Both ``EditorToolbar`` and ``EditorContextMenu`` render from this
 * registry, so a command's run/isActive/disabled logic and its label +
 * glyph live in exactly one place — no duplicated ``editor.chain()``
 * calls across the two surfaces.
 *
 * Glyphs are text nodes (no icon library), matching the editor's
 * existing convention. Clipboard ops are best-effort foreground actions
 * (the page is focused when the menu is open); they no-op gracefully
 * where the Clipboard API is unavailable.
 */

import type {Editor} from "@tiptap/react";
import type {ReactNode} from "react";

export type EditorCommandId =
    | "bold"
    | "italic"
    | "underline"
    | "strike"
    | "inline-code"
    | "subscript"
    | "superscript"
    | "highlight"
    | "h1"
    | "h2"
    | "h3"
    | "paragraph"
    | "bullet-list"
    | "ordered-list"
    | "task-list"
    | "align-left"
    | "align-center"
    | "align-right"
    | "align-justify"
    | "link"
    | "table"
    | "horizontal-rule"
    | "code-block"
    | "blockquote"
    | "undo"
    | "redo"
    | "select-all"
    | "cut"
    | "copy"
    | "paste";

/** Translate helper, passed in so commands stay UI-framework-agnostic. */
export interface EditorCommandContext {
    t: (key: string, fallback: string) => string;
}

export interface EditorCommand {
    /** Stable id; also the testid suffix (``${ns}-${id}``). */
    id: EditorCommandId;
    labelKey: string;
    labelFallback: string;
    /** Visual glyph for the toolbar / menu row. */
    glyph: ReactNode;
    /** Run the command against the live editor. */
    run: (editor: Editor, ctx: EditorCommandContext) => void;
    /** Toggle/selection state for the active highlight. Omitted for
     *  one-shot actions (history, clipboard, insert-once). */
    isActive?: (editor: Editor) => boolean;
    /** Extra enablement beyond ``editor.isEditable`` (e.g. undo can()). */
    canRun?: (editor: Editor) => boolean;
}

/** ``editor.isActive`` with a try/catch (some marks throw pre-mount). */
function activeSafe(
    editor: Editor,
    name: string,
    attrs?: Record<string, unknown>,
): boolean {
    try {
        // Attribute-only form (e.g. text alignment) when no node/mark name.
        if (name === "" && attrs) return editor.isActive(attrs);
        return attrs ? editor.isActive(name, attrs) : editor.isActive(name);
    } catch {
        return false;
    }
}

/** Shared link prompt (mirrors the original toolbar behaviour). */
export function promptForLink(editor: Editor, ctx: EditorCommandContext): void {
    const previous =
        (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt(
        ctx.t("editor.link_prompt", "URL (leave empty to remove the link)"),
        previous,
    );
    if (url === null) return;
    if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({href: url}).run();
}

function selectedText(editor: Editor): string {
    const {from, to} = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n");
}

function copySelection(editor: Editor): void {
    const text = selectedText(editor);
    if (!text) return;
    try {
        void navigator.clipboard?.writeText(text).catch(() => {});
    } catch {
        /* clipboard unavailable — no-op */
    }
}

function pasteFromClipboard(editor: Editor): void {
    try {
        void navigator.clipboard
            ?.readText()
            .then((text) => {
                if (text) editor.chain().focus().insertContent(text).run();
            })
            .catch(() => {});
    } catch {
        /* clipboard unavailable — no-op */
    }
}

export const EDITOR_COMMANDS: Record<EditorCommandId, EditorCommand> = {
    bold: {
        id: "bold",
        labelKey: "editor.bold",
        labelFallback: "Bold (Ctrl+B)",
        glyph: <strong>B</strong>,
        run: (e) => e.chain().focus().toggleBold().run(),
        isActive: (e) => activeSafe(e, "bold"),
    },
    italic: {
        id: "italic",
        labelKey: "editor.italic",
        labelFallback: "Italic (Ctrl+I)",
        glyph: <em>I</em>,
        run: (e) => e.chain().focus().toggleItalic().run(),
        isActive: (e) => activeSafe(e, "italic"),
    },
    underline: {
        id: "underline",
        labelKey: "editor.underline",
        labelFallback: "Underline (Ctrl+U)",
        glyph: <span style={{textDecoration: "underline"}}>U</span>,
        run: (e) => e.chain().focus().toggleUnderline().run(),
        isActive: (e) => activeSafe(e, "underline"),
    },
    strike: {
        id: "strike",
        labelKey: "editor.strike",
        labelFallback: "Strikethrough",
        glyph: <span style={{textDecoration: "line-through"}}>S</span>,
        run: (e) => e.chain().focus().toggleStrike().run(),
        isActive: (e) => activeSafe(e, "strike"),
    },
    "inline-code": {
        id: "inline-code",
        labelKey: "editor.inline_code",
        labelFallback: "Inline code",
        glyph: <code>{`<>`}</code>,
        run: (e) => e.chain().focus().toggleCode().run(),
        isActive: (e) => activeSafe(e, "code"),
    },
    subscript: {
        id: "subscript",
        labelKey: "editor.subscript",
        labelFallback: "Subscript",
        glyph: (
            <span>
                X<sub>2</sub>
            </span>
        ),
        run: (e) => e.chain().focus().toggleSubscript().run(),
        isActive: (e) => activeSafe(e, "subscript"),
    },
    superscript: {
        id: "superscript",
        labelKey: "editor.superscript",
        labelFallback: "Superscript",
        glyph: (
            <span>
                X<sup>2</sup>
            </span>
        ),
        run: (e) => e.chain().focus().toggleSuperscript().run(),
        isActive: (e) => activeSafe(e, "superscript"),
    },
    highlight: {
        id: "highlight",
        labelKey: "editor.highlight",
        labelFallback: "Highlight",
        glyph: <span className="editor-toolbar-highlight-swatch">H</span>,
        run: (e) => e.chain().focus().toggleHighlight().run(),
        isActive: (e) => activeSafe(e, "highlight"),
    },
    h1: {
        id: "h1",
        labelKey: "editor.h1",
        labelFallback: "Heading 1",
        glyph: "H1",
        run: (e) => e.chain().focus().toggleHeading({level: 1}).run(),
        isActive: (e) => activeSafe(e, "heading", {level: 1}),
    },
    h2: {
        id: "h2",
        labelKey: "editor.h2",
        labelFallback: "Heading 2",
        glyph: "H2",
        run: (e) => e.chain().focus().toggleHeading({level: 2}).run(),
        isActive: (e) => activeSafe(e, "heading", {level: 2}),
    },
    h3: {
        id: "h3",
        labelKey: "editor.h3",
        labelFallback: "Heading 3",
        glyph: "H3",
        run: (e) => e.chain().focus().toggleHeading({level: 3}).run(),
        isActive: (e) => activeSafe(e, "heading", {level: 3}),
    },
    paragraph: {
        id: "paragraph",
        labelKey: "editor.paragraph",
        labelFallback: "Normal text",
        glyph: "¶",
        run: (e) => e.chain().focus().setParagraph().run(),
        isActive: (e) =>
            activeSafe(e, "paragraph") &&
            !activeSafe(e, "heading", {level: 1}) &&
            !activeSafe(e, "heading", {level: 2}) &&
            !activeSafe(e, "heading", {level: 3}),
    },
    "bullet-list": {
        id: "bullet-list",
        labelKey: "editor.bullet_list",
        labelFallback: "Bullet list",
        glyph: "•",
        run: (e) => e.chain().focus().toggleBulletList().run(),
        isActive: (e) => activeSafe(e, "bulletList"),
    },
    "ordered-list": {
        id: "ordered-list",
        labelKey: "editor.ordered_list",
        labelFallback: "Ordered list",
        glyph: "1.",
        run: (e) => e.chain().focus().toggleOrderedList().run(),
        isActive: (e) => activeSafe(e, "orderedList"),
    },
    "task-list": {
        id: "task-list",
        labelKey: "editor.task_list",
        labelFallback: "Task list",
        glyph: "☐",
        run: (e) => e.chain().focus().toggleTaskList().run(),
        isActive: (e) => activeSafe(e, "taskList"),
    },
    "align-left": {
        id: "align-left",
        labelKey: "editor.align_left",
        labelFallback: "Align left",
        glyph: "⇤",
        run: (e) => e.chain().focus().setTextAlign("left").run(),
        isActive: (e) => activeSafe(e, "", {textAlign: "left"}),
    },
    "align-center": {
        id: "align-center",
        labelKey: "editor.align_center",
        labelFallback: "Align center",
        glyph: "⇔",
        run: (e) => e.chain().focus().setTextAlign("center").run(),
        isActive: (e) => activeSafe(e, "", {textAlign: "center"}),
    },
    "align-right": {
        id: "align-right",
        labelKey: "editor.align_right",
        labelFallback: "Align right",
        glyph: "⇥",
        run: (e) => e.chain().focus().setTextAlign("right").run(),
        isActive: (e) => activeSafe(e, "", {textAlign: "right"}),
    },
    "align-justify": {
        id: "align-justify",
        labelKey: "editor.align_justify",
        labelFallback: "Justify",
        glyph: "☰",
        run: (e) => e.chain().focus().setTextAlign("justify").run(),
        isActive: (e) => activeSafe(e, "", {textAlign: "justify"}),
    },
    link: {
        id: "link",
        labelKey: "editor.link",
        labelFallback: "Insert link",
        glyph: "↗",
        run: (e, ctx) => promptForLink(e, ctx),
        isActive: (e) => activeSafe(e, "link"),
    },
    table: {
        id: "table",
        labelKey: "editor.table",
        labelFallback: "Table",
        glyph: "▦",
        run: (e) =>
            e
                .chain()
                .focus()
                .insertTable({rows: 3, cols: 3, withHeaderRow: true})
                .run(),
    },
    "horizontal-rule": {
        id: "horizontal-rule",
        labelKey: "editor.horizontal_rule",
        labelFallback: "Horizontal rule",
        glyph: "―",
        run: (e) => e.chain().focus().setHorizontalRule().run(),
    },
    "code-block": {
        id: "code-block",
        labelKey: "editor.code_block",
        labelFallback: "Code block",
        glyph: <code>{`{ }`}</code>,
        run: (e) => e.chain().focus().toggleCodeBlock().run(),
        isActive: (e) => activeSafe(e, "codeBlock"),
    },
    blockquote: {
        id: "blockquote",
        labelKey: "editor.blockquote",
        labelFallback: "Quote",
        glyph: "❝",
        run: (e) => e.chain().focus().toggleBlockquote().run(),
        isActive: (e) => activeSafe(e, "blockquote"),
    },
    undo: {
        id: "undo",
        labelKey: "editor.undo",
        labelFallback: "Undo (Ctrl+Z)",
        glyph: "↶",
        run: (e) => e.chain().focus().undo().run(),
        canRun: (e) => {
            try {
                return e.can().undo();
            } catch {
                return false;
            }
        },
    },
    redo: {
        id: "redo",
        labelKey: "editor.redo",
        labelFallback: "Redo (Ctrl+Shift+Z)",
        glyph: "↷",
        run: (e) => e.chain().focus().redo().run(),
        canRun: (e) => {
            try {
                return e.can().redo();
            } catch {
                return false;
            }
        },
    },
    "select-all": {
        id: "select-all",
        labelKey: "editor.select_all",
        labelFallback: "Select all",
        glyph: "⌗",
        run: (e) => e.chain().focus().selectAll().run(),
    },
    cut: {
        id: "cut",
        labelKey: "editor.cut",
        labelFallback: "Cut",
        glyph: "✂",
        run: (e) => {
            copySelection(e);
            e.chain().focus().deleteSelection().run();
        },
    },
    copy: {
        id: "copy",
        labelKey: "editor.copy",
        labelFallback: "Copy",
        glyph: "⎘",
        run: (e) => copySelection(e),
    },
    paste: {
        id: "paste",
        labelKey: "editor.paste",
        labelFallback: "Paste",
        glyph: "⤓",
        run: (e) => pasteFromClipboard(e),
    },
};

/** Toolbar layout — preserves the original groups + order (#672 DRY). */
export const TOOLBAR_GROUPS: {key: string; ids: EditorCommandId[]}[] = [
    {key: "textstyle", ids: ["bold", "italic", "underline", "strike", "highlight"]},
    {key: "headings", ids: ["h1", "h2", "h3"]},
    {key: "lists", ids: ["bullet-list", "ordered-list", "task-list"]},
    {key: "align", ids: ["align-left", "align-center", "align-right"]},
    {key: "insert", ids: ["link", "inline-code", "code-block", "blockquote"]},
    {key: "history", ids: ["undo", "redo"]},
];

/** Context-menu sections. ``submenu`` rows expand to reveal their items;
 *  flat rows render inline. Group labels use the ``editor.ctx_*`` keys. */
export interface ContextMenuSection {
    key: string;
    labelKey: string;
    labelFallback: string;
    /** When true, render as an expandable disclosure submenu. */
    submenu: boolean;
    ids: EditorCommandId[];
}

export const CONTEXT_MENU_SECTIONS: ContextMenuSection[] = [
    {
        key: "history",
        labelKey: "editor.ctx_history",
        labelFallback: "History",
        submenu: false,
        ids: ["undo", "redo"],
    },
    {
        key: "clipboard",
        labelKey: "editor.ctx_clipboard",
        labelFallback: "Clipboard",
        submenu: false,
        ids: ["select-all", "cut", "copy", "paste"],
    },
    {
        key: "format",
        labelKey: "editor.ctx_format",
        labelFallback: "Formatting",
        submenu: true,
        ids: [
            "bold",
            "italic",
            "underline",
            "strike",
            "inline-code",
            "subscript",
            "superscript",
            "highlight",
        ],
    },
    {
        key: "insert",
        labelKey: "editor.ctx_insert",
        labelFallback: "Insert",
        submenu: true,
        ids: ["link", "table", "horizontal-rule", "code-block"],
    },
    {
        key: "heading",
        labelKey: "editor.ctx_heading",
        labelFallback: "Heading",
        submenu: true,
        ids: ["h1", "h2", "h3", "paragraph"],
    },
    {
        key: "align",
        labelKey: "editor.ctx_align",
        labelFallback: "Alignment",
        submenu: true,
        ids: ["align-left", "align-center", "align-right", "align-justify"],
    },
    {
        key: "list",
        labelKey: "editor.ctx_list",
        labelFallback: "List",
        submenu: true,
        ids: ["bullet-list", "ordered-list", "task-list"],
    },
    {
        key: "quote",
        labelKey: "editor.ctx_quote",
        labelFallback: "Quote",
        submenu: false,
        ids: ["blockquote"],
    },
];

/**
 * RichTextEditor — TipTap wrapper for Adaptive Learner
 * (Phase 27A).
 *
 * Wraps TipTap with the Phase-27 MVP extension set: StarterKit
 * (paragraphs / headings / lists / bold / italic / strike /
 * code / blockquote / horizontalRule / hardBreak / history),
 * plus Underline, TextAlign, Link, Placeholder, CharacterCount,
 * TaskList + TaskItem, Highlight, Typography, Focus, Image,
 * Subscript / Superscript, TextStyle + Color, Tables (table /
 * row / cell / header). Code-block syntax highlighting via
 * CodeBlockLowlight lands in Phase 27D.
 *
 * The editor owns NO persistence / debounce. Parents pass
 * ``content`` as a TipTap JSON doc (parsed from the stored
 * TEXT column via ``parseEditorContent``) and listen to
 * ``onChange`` with the latest doc; debounce + persistence
 * (auto-save on blur, 2 s debounce, etc.) are caller concerns.
 *
 * Parents also receive the live ``Editor`` instance via
 * ``onEditorReady`` so a separate ``EditorToolbar`` component
 * can wire to the same instance (the toolbar lives outside
 * this component; callers decide placement).
 *
 * The bundled CSS in ``global.css`` styles
 * ``.rich-text-editor`` / ``.ProseMirror`` for both light and
 * dark themes (matches the rest of the AL UI via CSS
 * variables).
 */

import {useEditor, EditorContent, type Editor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Typography from "@tiptap/extension-typography";
import Focus from "@tiptap/extension-focus";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import type {JSONContent} from "@tiptap/core";
import {useEffect, useRef, type CSSProperties} from "react";

interface Props {
    /** Current TipTap doc. ``null`` mounts an empty editor. */
    content: JSONContent | null;
    /** Fires on every content change. Parent owns debounce + persistence. */
    onChange?: (next: JSONContent) => void;
    /** Read-only when false. Defaults to true. */
    editable?: boolean;
    /** Hands the live ``Editor`` instance to the parent. Used
     *  by ``EditorToolbar`` and by character-count read-outs. */
    onEditorReady?: (editor: Editor) => void;
    /** Placeholder text shown in the empty paragraph. */
    placeholder?: string;
    /** Testid namespace. Root: ``${ns}-root``; content: ``${ns}-content``. */
    testidNamespace?: string;
    /** Optional className for the root container. */
    className?: string;
    /** Optional min-height in px (CSS variable override). */
    minHeight?: number;
    /** Optional aria-label for the editor region. */
    ariaLabel?: string;
}

export default function RichTextEditor({
    content,
    onChange,
    editable = true,
    onEditorReady,
    placeholder,
    testidNamespace = "rich-text-editor",
    className,
    minHeight,
    ariaLabel,
}: Props) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            TextStyle,
            Color,
            Highlight.configure({multicolor: false}),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    rel: "noopener noreferrer nofollow",
                    target: "_blank",
                },
            }),
            Placeholder.configure({
                placeholder: placeholder ?? "",
            }),
            CharacterCount,
            TaskList,
            TaskItem.configure({nested: true}),
            Subscript,
            Superscript,
            Typography,
            Focus.configure({className: "has-focus", mode: "shallowest"}),
            Image,
            Table.configure({resizable: false}),
            TableRow,
            TableCell,
            TableHeader,
        ],
        content: content ?? "",
        editable,
        onUpdate: ({editor: e}) => {
            if (onChange) onChange(e.getJSON());
        },
        editorProps: {
            attributes: {
                class: "rich-text-prosemirror",
                ...(ariaLabel ? {"aria-label": ariaLabel} : {}),
                "data-testid": `${testidNamespace}-content`,
            },
        },
    });

    // Hand the instance up once it exists.
    useEffect(() => {
        if (editor && onEditorReady) onEditorReady(editor);
    }, [editor, onEditorReady]);

    // External content swap: sync the editor doc without
    // emitting an update (otherwise onChange would echo the
    // change back into the prop and loop). Skip the first
    // render — useEditor already initialised with the prop.
    const hadFirstSync = useRef(false);
    useEffect(() => {
        if (!editor) return;
        if (!hadFirstSync.current) {
            hadFirstSync.current = true;
            return;
        }
        const current = editor.getJSON();
        const next = content ?? "";
        if (JSON.stringify(current) !== JSON.stringify(next)) {
            editor.commands.setContent(next, false);
        }
    }, [editor, content]);

    // Toggle read-only when the prop changes.
    useEffect(() => {
        if (editor) editor.setEditable(editable);
    }, [editor, editable]);

    if (!editor) return null;

    const rootStyle = minHeight
        ? ({"--rich-text-min-height": `${minHeight}px`} as CSSProperties)
        : undefined;

    const rootClass = `rich-text-editor${className ? ` ${className}` : ""}`;

    return (
        <div
            data-testid={`${testidNamespace}-root`}
            className={rootClass}
            style={rootStyle}
        >
            <EditorContent editor={editor} />
        </div>
    );
}

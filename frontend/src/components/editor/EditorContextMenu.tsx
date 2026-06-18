/**
 * EditorContextMenu — right-click context menu for ``RichTextEditor``
 * (#672). Mirrors the toolbar's capabilities, grouped into sections with
 * expandable submenus, driven by the SAME ``editor-commands`` registry as
 * the toolbar (DRY — no duplicated command logic).
 *
 * A custom (non-portal) menu rather than Radix ContextMenu: per
 * lessons-learned, Radix portal menus are brittle under happy-dom/vitest,
 * and a plain fixed-position element keeps the click/active-state path
 * fully testable.
 *
 * Opens on ``contextmenu`` over the editor content; closes on outside
 * click, Escape, scroll, or after running a command. Active formats show
 * a checkmark + accent tint; rows are 44px tall for touch.
 */

import type {Editor} from "@tiptap/react";
import {useCallback, useEffect, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {
    CONTEXT_MENU_SECTIONS,
    EDITOR_COMMANDS,
    type ContextMenuSection,
    type EditorCommandId,
} from "./editor-commands";

interface Props {
    editor: Editor | null;
    testidNamespace?: string;
}

interface MenuPosition {
    x: number;
    y: number;
}

export default function EditorContextMenu({
    editor,
    testidNamespace = "editor-context-menu",
}: Props) {
    const {t} = useI18n();
    const [position, setPosition] = useState<MenuPosition | null>(null);
    const [openSection, setOpenSection] = useState<string | null>(null);

    const close = useCallback(() => {
        setPosition(null);
        setOpenSection(null);
    }, []);

    // Open on right-click over the editor content element.
    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom as HTMLElement;
        const onContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            setOpenSection(null);
            setPosition({x: event.clientX, y: event.clientY});
        };
        dom.addEventListener("contextmenu", onContextMenu);
        return () => dom.removeEventListener("contextmenu", onContextMenu);
    }, [editor]);

    // Dismiss on outside interaction.
    useEffect(() => {
        if (!position) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(`[data-testid="${testidNamespace}-root"]`)) {
                return;
            }
            close();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("mousedown", onPointerDown);
        window.addEventListener("scroll", close, true);
        window.addEventListener("blur", close);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("mousedown", onPointerDown);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("blur", close);
        };
    }, [position, close, testidNamespace]);

    if (!editor || !position) return null;

    const editingDisabled = !editor.isEditable;

    const renderCommandRow = (id: EditorCommandId, nested: boolean) => {
        const command = EDITOR_COMMANDS[id];
        const active = command.isActive ? command.isActive(editor) : false;
        const disabled =
            editingDisabled ||
            (command.canRun ? !command.canRun(editor) : false);
        return (
            <button
                key={id}
                type="button"
                role={command.isActive ? "menuitemcheckbox" : "menuitem"}
                {...(command.isActive ? {"aria-checked": active} : {})}
                data-testid={`${testidNamespace}-${id}`}
                data-active={active ? "true" : "false"}
                disabled={disabled}
                onClick={() => {
                    command.run(editor, {t});
                    close();
                }}
                className={[
                    "flex w-full items-center gap-2 rounded-sm text-left text-sm",
                    "min-h-11 px-3 py-1",
                    nested ? "pl-7" : "",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    active
                        ? "bg-accent/15 text-accent"
                        : "text-fg-primary hover:bg-[var(--bg-surface)]",
                ].join(" ")}
            >
                <span className="inline-flex w-5 justify-center" aria-hidden="true">
                    {command.glyph}
                </span>
                <span className="flex-1">
                    {t(command.labelKey, command.labelFallback)}
                </span>
                <span className="w-4 text-center" aria-hidden="true">
                    {active ? "✓" : ""}
                </span>
            </button>
        );
    };

    const renderSection = (section: ContextMenuSection, index: number) => {
        const divider =
            index > 0 ? (
                <div
                    className="my-1 border-t border-[var(--border)]"
                    aria-hidden="true"
                />
            ) : null;

        if (!section.submenu) {
            return (
                <div key={section.key} role="group">
                    {divider}
                    {section.ids.map((id) => renderCommandRow(id, false))}
                </div>
            );
        }

        const expanded = openSection === section.key;
        return (
            <div key={section.key} role="group">
                {divider}
                <button
                    type="button"
                    aria-expanded={expanded}
                    data-testid={`${testidNamespace}-section-${section.key}`}
                    onClick={() =>
                        setOpenSection(expanded ? null : section.key)
                    }
                    className="flex min-h-11 w-full items-center gap-2 rounded-sm px-3 py-1 text-left text-sm text-fg-primary hover:bg-[var(--bg-surface)]"
                >
                    <span className="inline-flex w-5 justify-center" aria-hidden="true">
                        {expanded ? "▾" : "▸"}
                    </span>
                    <span className="flex-1 font-medium">
                        {t(section.labelKey, section.labelFallback)}
                    </span>
                </button>
                {expanded ? (
                    <div role="group">
                        {section.ids.map((id) => renderCommandRow(id, true))}
                    </div>
                ) : null}
            </div>
        );
    };

    return (
        <div
            data-testid={`${testidNamespace}-root`}
            role="menu"
            aria-label={t("editor.context_menu_label", "Editor actions")}
            className="fixed z-[9999] min-w-52 max-w-[min(20rem,90vw)] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-1 shadow-[var(--shadow-elevated)]"
            style={{
                left: position.x,
                top: position.y,
                maxHeight: "min(80vh, 32rem)",
            }}
        >
            {CONTEXT_MENU_SECTIONS.map((section, index) =>
                renderSection(section, index),
            )}
        </div>
    );
}

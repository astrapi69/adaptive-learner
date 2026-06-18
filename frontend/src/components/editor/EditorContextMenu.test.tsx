/**
 * Tests for EditorContextMenu (#672).
 *
 * Mounts RichTextEditor (which renders the context menu via the
 * ``rte-context-menu`` namespace) and drives the menu by firing a
 * ``contextmenu`` event on the editor content element — the same path a
 * real right-click takes. Covers: all groups render, apply formatting
 * (happy path), insert options without a selection, active-state
 * reflection with a selection, and dismissal.
 */

import {useState} from "react";
import {describe, it, expect, beforeEach, afterEach, vi} from "vitest";
import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import type {Editor} from "@tiptap/react";
import type {JSONContent} from "@tiptap/core";

import RichTextEditor from "./RichTextEditor";

function makeDoc(text: string, bold = false): JSONContent {
    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: text
                    ? [
                          {
                              type: "text",
                              text,
                              ...(bold ? {marks: [{type: "bold"}]} : {}),
                          },
                      ]
                    : undefined,
            },
        ],
    };
}

function renderEditor(doc: JSONContent): {editorRef: () => Editor | null} {
    let editor: Editor | null = null;
    function H() {
        const [e, setE] = useState<Editor | null>(null);
        editor = e;
        return (
            <RichTextEditor
                content={doc}
                onEditorReady={setE}
                testidNamespace="rte"
            />
        );
    }
    render(<H />);
    return {editorRef: () => editor};
}

async function openMenu(): Promise<void> {
    const content = await screen.findByTestId("rte-content");
    fireEvent.contextMenu(content);
    await screen.findByTestId("rte-context-menu-root");
}

beforeEach(() => {
    if (typeof window.prompt !== "function") {
        (window as unknown as {prompt: () => null}).prompt = () => null;
    }
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("EditorContextMenu", () => {
    it("renders all groups on right-click", async () => {
        const {editorRef} = renderEditor(makeDoc("Hello"));
        await waitFor(() => expect(editorRef()).not.toBeNull());
        await openMenu();

        // Direct (non-submenu) items.
        expect(screen.getByTestId("rte-context-menu-undo")).toBeTruthy();
        expect(screen.getByTestId("rte-context-menu-select-all")).toBeTruthy();
        expect(screen.getByTestId("rte-context-menu-blockquote")).toBeTruthy();
        // Submenu section toggles.
        for (const key of ["format", "insert", "heading", "align", "list"]) {
            expect(
                screen.getByTestId(`rte-context-menu-section-${key}`),
            ).toBeTruthy();
        }
    });

    it("applies formatting via the menu (happy path)", async () => {
        const {editorRef} = renderEditor(makeDoc("Body"));
        await waitFor(() => expect(editorRef()).not.toBeNull());
        act(() => {
            editorRef()!.commands.selectAll();
        });
        await openMenu();
        fireEvent.click(screen.getByTestId("rte-context-menu-section-format"));
        fireEvent.click(screen.getByTestId("rte-context-menu-bold"));
        await waitFor(() => expect(editorRef()!.isActive("bold")).toBe(true));
    });

    it("exposes insert options without a selection", async () => {
        const {editorRef} = renderEditor(makeDoc("X"));
        await waitFor(() => expect(editorRef()).not.toBeNull());
        await openMenu();
        fireEvent.click(screen.getByTestId("rte-context-menu-section-insert"));
        expect(screen.getByTestId("rte-context-menu-link")).toBeTruthy();
        expect(screen.getByTestId("rte-context-menu-table")).toBeTruthy();
        expect(
            screen.getByTestId("rte-context-menu-horizontal-rule"),
        ).toBeTruthy();
        fireEvent.click(screen.getByTestId("rte-context-menu-table"));
        await waitFor(() => expect(editorRef()!.isActive("table")).toBe(true));
    });

    it("reflects the active format with a selection", async () => {
        const {editorRef} = renderEditor(makeDoc("Bolded", true));
        await waitFor(() => expect(editorRef()).not.toBeNull());
        act(() => {
            editorRef()!.commands.selectAll();
        });
        await waitFor(() => expect(editorRef()!.isActive("bold")).toBe(true));
        await openMenu();
        fireEvent.click(screen.getByTestId("rte-context-menu-section-format"));
        const boldRow = screen.getByTestId("rte-context-menu-bold");
        expect(boldRow.getAttribute("data-active")).toBe("true");
        expect(boldRow.getAttribute("aria-checked")).toBe("true");
    });

    it("closes on Escape", async () => {
        const {editorRef} = renderEditor(makeDoc("Hello"));
        await waitFor(() => expect(editorRef()).not.toBeNull());
        await openMenu();
        fireEvent.keyDown(window, {key: "Escape"});
        await waitFor(() =>
            expect(screen.queryByTestId("rte-context-menu-root")).toBeNull(),
        );
    });
});

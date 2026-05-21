/**
 * Tests for EditorToolbar (Phase 27A).
 *
 * The toolbar is a thin command-API wrapper around a TipTap
 * Editor instance. Tests mount RichTextEditor + EditorToolbar
 * together (a typical caller shape) and assert that buttons
 * resolve and that their click handlers fire the right
 * commands.
 */

import {useState} from "react";
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import type {Editor} from "@tiptap/react";
import type {JSONContent} from "@tiptap/core";

import RichTextEditor from "./RichTextEditor";
import EditorToolbar from "./EditorToolbar";

function makeDoc(text: string): JSONContent {
    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: text ? [{type: "text", text}] : undefined,
            },
        ],
    };
}

function Harness({initialText = "Hello"}: {initialText?: string}) {
    const [editor, setEditor] = useState<Editor | null>(null);
    return (
        <>
            <EditorToolbar editor={editor} testidNamespace="tb" />
            <RichTextEditor
                content={makeDoc(initialText)}
                onEditorReady={setEditor}
                testidNamespace="rte"
            />
        </>
    );
}

describe("EditorToolbar", () => {
    it("renders nothing when editor is null", () => {
        render(<EditorToolbar editor={null} />);
        expect(screen.queryByTestId("editor-toolbar-root")).toBeNull();
    });

    it("renders the full button set once the editor is live", async () => {
        render(<Harness />);
        await waitFor(() =>
            expect(screen.getByTestId("tb-root")).toBeTruthy(),
        );
        expect(screen.getByTestId("tb-bold")).toBeTruthy();
        expect(screen.getByTestId("tb-italic")).toBeTruthy();
        expect(screen.getByTestId("tb-underline")).toBeTruthy();
        expect(screen.getByTestId("tb-strike")).toBeTruthy();
        expect(screen.getByTestId("tb-highlight")).toBeTruthy();
        expect(screen.getByTestId("tb-h1")).toBeTruthy();
        expect(screen.getByTestId("tb-h2")).toBeTruthy();
        expect(screen.getByTestId("tb-h3")).toBeTruthy();
        expect(screen.getByTestId("tb-bullet-list")).toBeTruthy();
        expect(screen.getByTestId("tb-ordered-list")).toBeTruthy();
        expect(screen.getByTestId("tb-task-list")).toBeTruthy();
        expect(screen.getByTestId("tb-align-left")).toBeTruthy();
        expect(screen.getByTestId("tb-align-center")).toBeTruthy();
        expect(screen.getByTestId("tb-align-right")).toBeTruthy();
        expect(screen.getByTestId("tb-link")).toBeTruthy();
        expect(screen.getByTestId("tb-inline-code")).toBeTruthy();
        expect(screen.getByTestId("tb-code-block")).toBeTruthy();
        expect(screen.getByTestId("tb-blockquote")).toBeTruthy();
        expect(screen.getByTestId("tb-undo")).toBeTruthy();
        expect(screen.getByTestId("tb-redo")).toBeTruthy();
    });

    it("bold button toggles the bold mark and reflects active state", async () => {
        let editorRef: Editor | null = null;

        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            editorRef = editor;
            return (
                <>
                    <EditorToolbar editor={editor} testidNamespace="tb" />
                    <RichTextEditor
                        content={makeDoc("Body")}
                        onEditorReady={setEditor}
                        testidNamespace="rte"
                    />
                </>
            );
        }

        render(<H />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        act(() => {
            editorRef!.commands.selectAll();
        });
        fireEvent.click(screen.getByTestId("tb-bold"));
        await waitFor(() => expect(editorRef!.isActive("bold")).toBe(true));
        const boldBtn = screen.getByTestId("tb-bold");
        expect(boldBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("heading-1 button promotes the paragraph to a heading", async () => {
        let editorRef: Editor | null = null;
        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            editorRef = editor;
            return (
                <>
                    <EditorToolbar editor={editor} testidNamespace="tb" />
                    <RichTextEditor
                        content={makeDoc("Title here")}
                        onEditorReady={setEditor}
                        testidNamespace="rte"
                    />
                </>
            );
        }

        render(<H />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        fireEvent.click(screen.getByTestId("tb-h1"));
        await waitFor(() =>
            expect(editorRef!.isActive("heading", {level: 1})).toBe(true),
        );
    });

    it("bullet-list button toggles a list", async () => {
        let editorRef: Editor | null = null;
        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            editorRef = editor;
            return (
                <>
                    <EditorToolbar editor={editor} testidNamespace="tb" />
                    <RichTextEditor
                        content={makeDoc("Item")}
                        onEditorReady={setEditor}
                        testidNamespace="rte"
                    />
                </>
            );
        }

        render(<H />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        fireEvent.click(screen.getByTestId("tb-bullet-list"));
        await waitFor(() =>
            expect(editorRef!.isActive("bulletList")).toBe(true),
        );
    });

    it("showHeadings=false hides the heading group", async () => {
        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            return (
                <>
                    <EditorToolbar
                        editor={editor}
                        testidNamespace="tb"
                        showHeadings={false}
                    />
                    <RichTextEditor
                        content={makeDoc("x")}
                        onEditorReady={setEditor}
                        testidNamespace="rte"
                    />
                </>
            );
        }
        render(<H />);
        await waitFor(() =>
            expect(screen.getByTestId("tb-root")).toBeTruthy(),
        );
        expect(screen.queryByTestId("tb-h1")).toBeNull();
        expect(screen.queryByTestId("tb-h2")).toBeNull();
        expect(screen.queryByTestId("tb-h3")).toBeNull();
    });

    it("showHistory=false hides undo / redo", async () => {
        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            return (
                <>
                    <EditorToolbar
                        editor={editor}
                        testidNamespace="tb"
                        showHistory={false}
                    />
                    <RichTextEditor
                        content={makeDoc("x")}
                        onEditorReady={setEditor}
                        testidNamespace="rte"
                    />
                </>
            );
        }
        render(<H />);
        await waitFor(() =>
            expect(screen.getByTestId("tb-root")).toBeTruthy(),
        );
        expect(screen.queryByTestId("tb-undo")).toBeNull();
        expect(screen.queryByTestId("tb-redo")).toBeNull();
    });

    it("link button prompts and sets the link mark", async () => {
        const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("https://example.com");
        let editorRef: Editor | null = null;
        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            editorRef = editor;
            return (
                <>
                    <EditorToolbar editor={editor} testidNamespace="tb" />
                    <RichTextEditor
                        content={makeDoc("Click")}
                        onEditorReady={setEditor}
                        testidNamespace="rte"
                    />
                </>
            );
        }
        render(<H />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        act(() => {
            editorRef!.commands.selectAll();
        });
        fireEvent.click(screen.getByTestId("tb-link"));
        await waitFor(() => expect(promptSpy).toHaveBeenCalled());
        await waitFor(() => expect(editorRef!.isActive("link")).toBe(true));
        promptSpy.mockRestore();
    });

    it("link button with empty string removes the link", async () => {
        const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("");
        let editorRef: Editor | null = null;
        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            editorRef = editor;
            return (
                <>
                    <EditorToolbar editor={editor} testidNamespace="tb" />
                    <RichTextEditor
                        content={{
                            type: "doc",
                            content: [
                                {
                                    type: "paragraph",
                                    content: [
                                        {
                                            type: "text",
                                            marks: [
                                                {
                                                    type: "link",
                                                    attrs: {
                                                        href: "https://old.example.com",
                                                    },
                                                },
                                            ],
                                            text: "linked",
                                        },
                                    ],
                                },
                            ],
                        }}
                        onEditorReady={setEditor}
                        testidNamespace="rte"
                    />
                </>
            );
        }
        render(<H />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        act(() => {
            editorRef!.commands.selectAll();
        });
        await waitFor(() => expect(editorRef!.isActive("link")).toBe(true));
        fireEvent.click(screen.getByTestId("tb-link"));
        await waitFor(() => expect(promptSpy).toHaveBeenCalled());
        await waitFor(() => expect(editorRef!.isActive("link")).toBe(false));
        promptSpy.mockRestore();
    });

    it("link button does nothing when prompt is cancelled (null)", async () => {
        const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);
        let editorRef: Editor | null = null;
        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            editorRef = editor;
            return (
                <>
                    <EditorToolbar editor={editor} testidNamespace="tb" />
                    <RichTextEditor
                        content={makeDoc("Body")}
                        onEditorReady={setEditor}
                        testidNamespace="rte"
                    />
                </>
            );
        }
        render(<H />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        act(() => {
            editorRef!.commands.selectAll();
        });
        fireEvent.click(screen.getByTestId("tb-link"));
        await waitFor(() => expect(promptSpy).toHaveBeenCalled());
        expect(editorRef!.isActive("link")).toBe(false);
        promptSpy.mockRestore();
    });
});

beforeEach(() => {
    // happy-dom does not provide window.prompt by default;
    // the implementation falls through to undefined, which
    // crashes the link button. Ensure a default no-op.
    if (typeof window.prompt !== "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).prompt = () => null;
    }
});

afterEach(() => {
    vi.restoreAllMocks();
});

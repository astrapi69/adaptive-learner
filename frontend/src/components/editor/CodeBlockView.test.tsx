/**
 * Tests for the CodeBlockLowlight extension + CodeBlockView
 * NodeView (Phase 27D).
 *
 * Verifies that:
 *   - Toggling a code block from the toolbar inserts the
 *     lowlight-backed node (NOT StarterKit's plain codeBlock).
 *   - The custom NodeView toolbar renders the language picker
 *     + copy button.
 *   - Changing the language picker updates the node attrs.
 *   - The copy button writes the code text to the clipboard.
 *   - The supported language constants are wired correctly.
 */

import {useState} from "react";
import type {Editor} from "@tiptap/react";
import type {JSONContent} from "@tiptap/core";
import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {describe, expect, it, vi, afterEach} from "vitest";

import RichTextEditor from "./RichTextEditor";
import {SUPPORTED_LANGUAGES} from "./code-block-config";

function pythonDoc(): JSONContent {
    return {
        type: "doc",
        content: [
            {
                type: "codeBlock",
                attrs: {language: "python"},
                content: [{type: "text", text: "print('hi')"}],
            },
        ],
    };
}

describe("CodeBlockLowlight + CodeBlockView", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("exports an MVP language set including python + js + ts + bash", () => {
        expect(SUPPORTED_LANGUAGES).toContain("python");
        expect(SUPPORTED_LANGUAGES).toContain("javascript");
        expect(SUPPORTED_LANGUAGES).toContain("typescript");
        expect(SUPPORTED_LANGUAGES).toContain("bash");
    });

    it("mounts the CodeBlockView when a code block is in the doc", async () => {
        render(
            <RichTextEditor content={pythonDoc()} testidNamespace="rte" />,
        );
        await waitFor(() =>
            expect(screen.getByTestId("code-block-view")).toBeTruthy(),
        );
        expect(screen.getByTestId("code-block-toolbar")).toBeTruthy();
        expect(screen.getByTestId("code-block-language")).toBeTruthy();
        expect(screen.getByTestId("code-block-copy")).toBeTruthy();
    });

    it("language picker pre-selects the node's current language", async () => {
        render(
            <RichTextEditor content={pythonDoc()} testidNamespace="rte" />,
        );
        await waitFor(() =>
            expect(screen.getByTestId("code-block-language")).toBeTruthy(),
        );
        const select = screen.getByTestId(
            "code-block-language",
        ) as HTMLSelectElement;
        expect(select.value).toBe("python");
    });

    it("changing the language updates the node's language attribute", async () => {
        let editorRef: Editor | null = null;
        render(
            <RichTextEditor
                content={pythonDoc()}
                onEditorReady={(e) => {
                    editorRef = e;
                }}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(editorRef).not.toBeNull());
        const select = screen.getByTestId(
            "code-block-language",
        ) as HTMLSelectElement;
        fireEvent.change(select, {target: {value: "javascript"}});
        await waitFor(() => {
            const doc = editorRef!.getJSON();
            const codeBlock = (doc.content ?? [])[0];
            expect(codeBlock?.attrs?.language).toBe("javascript");
        });
    });

    it("selecting 'Plain text' (empty value) clears the language attribute", async () => {
        let editorRef: Editor | null = null;
        render(
            <RichTextEditor
                content={pythonDoc()}
                onEditorReady={(e) => {
                    editorRef = e;
                }}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(editorRef).not.toBeNull());
        const select = screen.getByTestId(
            "code-block-language",
        ) as HTMLSelectElement;
        fireEvent.change(select, {target: {value: ""}});
        await waitFor(() => {
            const doc = editorRef!.getJSON();
            const codeBlock = (doc.content ?? [])[0];
            expect(codeBlock?.attrs?.language).toBeNull();
        });
    });

    it("copy button writes the code block's text to the clipboard", async () => {
        // happy-dom doesn't provide navigator.clipboard by default;
        // stub it for this test.
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {writeText},
        });

        render(
            <RichTextEditor content={pythonDoc()} testidNamespace="rte" />,
        );
        await waitFor(() =>
            expect(screen.getByTestId("code-block-copy")).toBeTruthy(),
        );
        await act(async () => {
            fireEvent.click(screen.getByTestId("code-block-copy"));
        });
        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith("print('hi')"),
        );
    });

    it("copy button shows 'Copied' feedback after a successful copy", async () => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {writeText: vi.fn().mockResolvedValue(undefined)},
        });
        render(
            <RichTextEditor content={pythonDoc()} testidNamespace="rte" />,
        );
        await waitFor(() =>
            expect(screen.getByTestId("code-block-copy")).toBeTruthy(),
        );
        await act(async () => {
            fireEvent.click(screen.getByTestId("code-block-copy"));
        });
        await waitFor(() => {
            const btn = screen.getByTestId("code-block-copy");
            expect(btn.textContent?.toLowerCase()).toContain("copied");
        });
    });

    it("toolbar's code-block button creates a lowlight code block (NOT StarterKit's)", async () => {
        let editorRef: Editor | null = null;
        // Mount an empty editor and ask the toolbar to insert a
        // code block via the editor's command API. The resulting
        // doc's first child must carry the lowlight node spec
        // (which renders via CodeBlockView, so the testid surfaces).
        function H() {
            const [editor, setEditor] = useState<Editor | null>(null);
            editorRef = editor;
            return (
                <RichTextEditor
                    content={null}
                    onEditorReady={setEditor}
                    testidNamespace="rte"
                />
            );
        }
        render(<H />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        act(() => {
            editorRef!.chain().focus().setCodeBlock({language: "python"}).run();
        });
        await waitFor(() =>
            expect(screen.getByTestId("code-block-view")).toBeTruthy(),
        );
    });
});

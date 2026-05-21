/**
 * Tests for the Phase-27 RichTextEditor.
 *
 * The contract:
 *   - mounts TipTap with the MVP extension set + renders content
 *   - content prop is the initial document
 *   - onChange fires with the latest JSON when content edits
 *   - onEditorReady hands the Editor instance up
 *   - editable=false renders read-only
 *   - external content prop change resets the editor doc
 *   - programmatic content swap does NOT echo through onChange
 *   - extension wire-up smoke (heading / underline / link / etc.)
 *
 * useEditor returns null on the first render and the Editor on
 * a subsequent re-render. Tests use waitFor for the initial
 * mount.
 */

import {useState} from "react";
import {describe, it, expect, vi} from "vitest";
import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import type {JSONContent} from "@tiptap/core";
import type {Editor} from "@tiptap/react";

import RichTextEditor from "./RichTextEditor";

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

describe("RichTextEditor", () => {
    it("renders the root with the testid namespace", async () => {
        render(
            <RichTextEditor
                content={makeDoc("Hello")}
                testidNamespace="rte"
            />,
        );
        await waitFor(() =>
            expect(screen.getByTestId("rte-root")).toBeTruthy(),
        );
        expect(screen.getByTestId("rte-content")).toBeTruthy();
    });

    it("renders the initial content", async () => {
        render(
            <RichTextEditor
                content={makeDoc("Initial body")}
                testidNamespace="rte"
            />,
        );
        await waitFor(() =>
            expect(screen.getByTestId("rte-content").textContent).toContain(
                "Initial body",
            ),
        );
    });

    it("renders empty when content is null", async () => {
        render(<RichTextEditor content={null} testidNamespace="rte" />);
        await waitFor(() =>
            expect(screen.getByTestId("rte-root")).toBeTruthy(),
        );
        expect(
            screen.getByTestId("rte-content").textContent?.trim() ?? "",
        ).toBe("");
    });

    it("fires onChange when content is edited", async () => {
        const onChange = vi.fn();
        let editorRef: Editor | null = null;
        render(
            <RichTextEditor
                content={makeDoc("")}
                onChange={onChange}
                onEditorReady={(e) => {
                    editorRef = e;
                }}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(editorRef).not.toBeNull());
        act(() => {
            editorRef!.commands.insertContent("Typed text");
        });
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as JSONContent;
        expect(JSON.stringify(last)).toContain("Typed text");
    });

    it("hands the Editor instance up via onEditorReady", async () => {
        const onEditorReady = vi.fn();
        render(
            <RichTextEditor
                content={null}
                onEditorReady={onEditorReady}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(onEditorReady).toHaveBeenCalledTimes(1));
        const editor = onEditorReady.mock.calls[0][0] as Editor;
        expect(editor).toBeTruthy();
        expect(typeof editor.commands.insertContent).toBe("function");
    });

    it("editable=false makes the editor read-only", async () => {
        let editorRef: Editor | null = null;
        render(
            <RichTextEditor
                content={makeDoc("Locked")}
                editable={false}
                onEditorReady={(e) => {
                    editorRef = e;
                }}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(editorRef).not.toBeNull());
        expect(editorRef!.isEditable).toBe(false);
    });

    it("editable prop change toggles the editable state", async () => {
        let editorRef: Editor | null = null;

        function Controlled() {
            const [editable, setEditable] = useState(true);
            return (
                <>
                    <RichTextEditor
                        content={makeDoc("Body")}
                        editable={editable}
                        onEditorReady={(e) => {
                            editorRef = e;
                        }}
                        testidNamespace="rte"
                    />
                    <button
                        data-testid="toggle"
                        onClick={() => setEditable((v) => !v)}
                    />
                </>
            );
        }

        render(<Controlled />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        expect(editorRef!.isEditable).toBe(true);
        fireEvent.click(screen.getByTestId("toggle"));
        await waitFor(() => expect(editorRef!.isEditable).toBe(false));
        fireEvent.click(screen.getByTestId("toggle"));
        await waitFor(() => expect(editorRef!.isEditable).toBe(true));
    });

    it("external content prop change resets the editor doc", async () => {
        let editorRef: Editor | null = null;

        function Controlled() {
            const [content, setContent] = useState<JSONContent | null>(
                makeDoc("First"),
            );
            return (
                <>
                    <RichTextEditor
                        content={content}
                        onEditorReady={(e) => {
                            editorRef = e;
                        }}
                        testidNamespace="rte"
                    />
                    <button
                        data-testid="swap"
                        onClick={() => setContent(makeDoc("Second"))}
                    />
                </>
            );
        }

        render(<Controlled />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        await waitFor(() => expect(editorRef!.getText()).toContain("First"));
        fireEvent.click(screen.getByTestId("swap"));
        await waitFor(() =>
            expect(editorRef!.getText()).toContain("Second"),
        );
    });

    it("programmatic content swap does NOT echo through onChange", async () => {
        const onChange = vi.fn();
        let editorRef: Editor | null = null;

        function Controlled() {
            const [content, setContent] = useState<JSONContent | null>(
                makeDoc("Original"),
            );
            return (
                <>
                    <RichTextEditor
                        content={content}
                        onChange={onChange}
                        onEditorReady={(e) => {
                            editorRef = e;
                        }}
                        testidNamespace="rte"
                    />
                    <button
                        data-testid="swap"
                        onClick={() => setContent(makeDoc("Swapped"))}
                    />
                </>
            );
        }

        render(<Controlled />);
        await waitFor(() => expect(editorRef).not.toBeNull());
        const baseline = onChange.mock.calls.length;
        fireEvent.click(screen.getByTestId("swap"));
        await waitFor(() =>
            expect(editorRef!.getText()).toContain("Swapped"),
        );
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(onChange.mock.calls.length).toBe(baseline);
    });

    it("applies the className prop", async () => {
        render(
            <RichTextEditor
                content={null}
                className="custom"
                testidNamespace="rte"
            />,
        );
        await waitFor(() => {
            const root = screen.getByTestId("rte-root");
            expect(root.className).toContain("custom");
        });
    });

    it("Phase 27 extension wire-up: bold / italic / underline / strike", async () => {
        let editorRef: Editor | null = null;
        render(
            <RichTextEditor
                content={makeDoc("text")}
                onEditorReady={(e) => {
                    editorRef = e;
                }}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(editorRef).not.toBeNull());
        expect(typeof editorRef!.commands.toggleBold).toBe("function");
        expect(typeof editorRef!.commands.toggleItalic).toBe("function");
        expect(typeof editorRef!.commands.toggleUnderline).toBe("function");
        expect(typeof editorRef!.commands.toggleStrike).toBe("function");
    });

    it("Phase 27 extension wire-up: heading + lists + task list", async () => {
        let editorRef: Editor | null = null;
        render(
            <RichTextEditor
                content={makeDoc("text")}
                onEditorReady={(e) => {
                    editorRef = e;
                }}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(editorRef).not.toBeNull());
        expect(typeof editorRef!.commands.toggleHeading).toBe("function");
        expect(typeof editorRef!.commands.toggleBulletList).toBe("function");
        expect(typeof editorRef!.commands.toggleOrderedList).toBe("function");
        expect(typeof editorRef!.commands.toggleTaskList).toBe("function");
    });

    it("Phase 27 extension wire-up: link / highlight / textAlign / color", async () => {
        let editorRef: Editor | null = null;
        render(
            <RichTextEditor
                content={makeDoc("text")}
                onEditorReady={(e) => {
                    editorRef = e;
                }}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(editorRef).not.toBeNull());
        expect(typeof editorRef!.commands.setLink).toBe("function");
        expect(typeof editorRef!.commands.unsetLink).toBe("function");
        expect(typeof editorRef!.commands.toggleHighlight).toBe("function");
        expect(typeof editorRef!.commands.setTextAlign).toBe("function");
        expect(typeof editorRef!.commands.setColor).toBe("function");
    });

    it("character count is available via the storage API", async () => {
        let editorRef: Editor | null = null;
        render(
            <RichTextEditor
                content={makeDoc("Hello world")}
                onEditorReady={(e) => {
                    editorRef = e;
                }}
                testidNamespace="rte"
            />,
        );
        await waitFor(() => expect(editorRef).not.toBeNull());
        const counter = editorRef!.storage.characterCount as {
            characters: () => number;
            words: () => number;
        };
        expect(counter.characters()).toBeGreaterThan(0);
        expect(counter.words()).toBeGreaterThan(0);
    });
});

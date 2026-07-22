/**
 * #1927 — tests for the BookFileUpload picker component.
 *
 * The parser is injected (the component's test seam); file-change events
 * carry a real ``File`` so the wiring stays honest.
 */
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import BookFileUpload from "./BookFileUpload";
import {SOFT_SECTION_CHARS, MAX_SECTION_CHARS} from "../../../lib/content/book-upload";
import type {ParseBookResult} from "../../../lib/content/book-upload";

const t = (_key: string, fallback?: string) => fallback ?? _key;

function okParse(sections: Array<{title: string; text: string}>): () => Promise<ParseBookResult> {
    return async () => ({
        ok: true,
        book: {
            format: "epub",
            sections: sections.map((section, index) => ({
                id: `section-${index + 1}`,
                title: section.title,
                text: section.text,
                charCount: section.text.length,
            })),
        },
    });
}

function pickFile() {
    const input = screen.getByTestId("book-upload-input");
    fireEvent.change(input, {
        target: {files: [new File(["x"], "buch.epub")]},
    });
}

describe("BookFileUpload", () => {
    it("shows the picker with section titles after a successful parse", async () => {
        render(
            <BookFileUpload
                currentText=""
                onApply={vi.fn()}
                t={t}
                parse={okParse([
                    {title: "Kapitel Eins", text: "Text eins."},
                    {title: "Kapitel Zwei", text: "Text zwei."},
                ])}
            />,
        );
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        const select = screen.getByTestId(
            "book-upload-section-select",
        ) as HTMLSelectElement;
        expect(select.options.length).toBe(2);
        expect(select.options[0].textContent).toContain("Kapitel Eins");
        expect(screen.getByTestId("book-upload-preview").textContent).toContain(
            "Text eins.",
        );
    });

    it("applies the selected section into an empty field without confirmation", async () => {
        const onApply = vi.fn();
        render(
            <BookFileUpload
                currentText="   "
                onApply={onApply}
                t={t}
                parse={okParse([
                    {title: "A", text: "Alpha."},
                    {title: "B", text: "Beta."},
                ])}
            />,
        );
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        fireEvent.change(screen.getByTestId("book-upload-section-select"), {
            target: {value: "section-2"},
        });
        fireEvent.click(screen.getByTestId("book-upload-apply"));
        expect(onApply).toHaveBeenCalledWith("Beta.");
    });

    it("asks for confirmation before replacing a non-empty field", async () => {
        const onApply = vi.fn();
        render(
            <BookFileUpload
                currentText="Schon Text da."
                onApply={onApply}
                t={t}
                parse={okParse([{title: "A", text: "Alpha."}])}
            />,
        );
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId("book-upload-apply"));
        expect(onApply).not.toHaveBeenCalled();
        const confirm = await screen.findByTestId(
            "book-upload-replace-confirm-confirm",
        );
        fireEvent.click(confirm);
        expect(onApply).toHaveBeenCalledWith("Alpha.");
    });

    it("shows a translated error and no picker on parse failure", async () => {
        render(
            <BookFileUpload
                currentText=""
                onApply={vi.fn()}
                t={t}
                parse={async () => ({ok: false, error: "invalid_epub"})}
            />,
        );
        pickFile();
        const error = await screen.findByTestId("book-upload-error");
        expect(error.textContent).toContain("could not be read as an EPUB");
        expect(screen.queryByTestId("book-upload-picker")).toBeNull();
    });

    it("blocks applying an over-long section with a specific error", async () => {
        const onApply = vi.fn();
        render(
            <BookFileUpload
                currentText=""
                onApply={onApply}
                t={t}
                parse={okParse([
                    {title: "Riesig", text: "x".repeat(MAX_SECTION_CHARS + 1)},
                ])}
            />,
        );
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId("book-upload-apply"));
        expect(onApply).not.toHaveBeenCalled();
        expect(
            screen.getByTestId("book-upload-error").textContent,
        ).toContain("Section too long");
    });

    it("shows the soft hint above the soft threshold", async () => {
        render(
            <BookFileUpload
                currentText=""
                onApply={vi.fn()}
                t={t}
                parse={okParse([
                    {title: "Lang", text: "y".repeat(SOFT_SECTION_CHARS + 1)},
                ])}
            />,
        );
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-soft-hint")).toBeTruthy(),
        );
    });
});

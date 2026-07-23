/**
 * #1927 / #1949 — tests for the BookFileUpload multi-select picker.
 *
 * The parser is injected (the component's test seam); file-change events
 * carry a real ``File`` so the wiring stays honest.
 */
import {fireEvent, render, screen, waitFor, cleanup} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import BookFileUpload from "./BookFileUpload";
import {SOFT_SECTION_CHARS, MAX_SECTION_CHARS} from "../../../lib/content/book-upload";
import type {ParseBookResult} from "../../../lib/content/book-upload";

const t = (_key: string, fallback?: string) => fallback ?? _key;

function okParse(
    sections: Array<{title: string; text: string}>,
): () => Promise<ParseBookResult> {
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
    fireEvent.change(input, {target: {files: [new File(["x"], "buch.epub")]}});
}

function setup(
    props: Partial<React.ComponentProps<typeof BookFileUpload>> = {},
) {
    const onApply = vi.fn();
    const onGenerateSections = vi.fn();
    render(
        <BookFileUpload
            currentText=""
            onApply={onApply}
            onGenerateSections={onGenerateSections}
            t={t}
            parse={okParse([{title: "A", text: "Alpha."}])}
            {...props}
        />,
    );
    return {onApply, onGenerateSections};
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("BookFileUpload multi-select", () => {
    it("renders a checkbox per detected section, all content selected by default", async () => {
        setup({
            parse: okParse([
                {title: "Kapitel Eins", text: "Text eins."},
                {title: "Kapitel Zwei", text: "Text zwei."},
            ]),
        });
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        const cb1 = screen.getByTestId(
            "book-upload-section-checkbox-section-1",
        ) as HTMLInputElement;
        const cb2 = screen.getByTestId(
            "book-upload-section-checkbox-section-2",
        ) as HTMLInputElement;
        expect(cb1.checked).toBe(true);
        expect(cb2.checked).toBe(true);
        expect(
            screen.getByTestId("book-upload-selected-count").textContent,
        ).toContain("2");
    });

    it("deselects heuristic front/back-matter but keeps it visible + checkable", async () => {
        setup({
            parse: okParse([
                {title: "Vorwort", text: "Danke."},
                {title: "Kapitel 1", text: "Inhalt eins."},
                {title: "Kapitel 2", text: "Inhalt zwei."},
                {title: "Glossar", text: "Begriffe."},
            ]),
        });
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        const vorwort = screen.getByTestId(
            "book-upload-section-checkbox-section-1",
        ) as HTMLInputElement;
        const kap1 = screen.getByTestId(
            "book-upload-section-checkbox-section-2",
        ) as HTMLInputElement;
        const glossar = screen.getByTestId(
            "book-upload-section-checkbox-section-4",
        ) as HTMLInputElement;
        expect(vorwort.checked).toBe(false);
        expect(kap1.checked).toBe(true);
        expect(glossar.checked).toBe(false);
        // The excluded section is still visible and can be checked manually.
        expect(screen.getByTestId("book-upload-exclude-hint")).toBeTruthy();
        fireEvent.click(vorwort);
        expect(vorwort.checked).toBe(true);
    });

    it("batch-generates the selected sections in DOCUMENT order", async () => {
        const {onGenerateSections} = setup({
            parse: okParse([
                {title: "Kapitel 1", text: "eins"},
                {title: "Kapitel 2", text: "zwei"},
                {title: "Kapitel 3", text: "drei"},
            ]),
        });
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        // Toggle section-2 off, then back on — selection order differs from
        // document order, but the emitted list must be in document order.
        fireEvent.click(
            screen.getByTestId("book-upload-section-checkbox-section-2"),
        );
        fireEvent.click(
            screen.getByTestId("book-upload-section-checkbox-section-2"),
        );
        expect(screen.getByTestId("book-upload-apply").textContent).toContain(
            "Generate 3",
        );
        fireEvent.click(screen.getByTestId("book-upload-apply"));
        expect(onGenerateSections).toHaveBeenCalledTimes(1);
        expect(onGenerateSections.mock.calls[0][0].map((s: {title: string}) => s.title)).toEqual([
            "Kapitel 1",
            "Kapitel 2",
            "Kapitel 3",
        ]);
    });

    it("keeps the single-section path (insert into the text field)", async () => {
        const {onApply, onGenerateSections} = setup({
            parse: okParse([{title: "A", text: "Alpha."}]),
        });
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        const button = screen.getByTestId("book-upload-apply");
        expect(button.textContent).toContain("Insert into text field");
        fireEvent.click(button);
        expect(onApply).toHaveBeenCalledWith("Alpha.");
        expect(onGenerateSections).not.toHaveBeenCalled();
    });

    it("shows the single-section preview only when exactly one is selected", async () => {
        setup({
            parse: okParse([
                {title: "Kapitel 1", text: "Text eins."},
                {title: "Kapitel 2", text: "Text zwei."},
            ]),
        });
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-picker")).toBeTruthy(),
        );
        // Two selected -> no preview.
        expect(screen.queryByTestId("book-upload-preview")).toBeNull();
        // Uncheck one -> preview appears for the single remaining section.
        fireEvent.click(
            screen.getByTestId("book-upload-section-checkbox-section-2"),
        );
        expect(screen.getByTestId("book-upload-preview").textContent).toContain(
            "Text eins.",
        );
    });

    it("asks for confirmation before replacing a non-empty field (single path)", async () => {
        const {onApply} = setup({
            currentText: "Schon Text da.",
            parse: okParse([{title: "A", text: "Alpha."}]),
        });
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
        setup({parse: async () => ({ok: false, error: "invalid_epub"})});
        pickFile();
        const error = await screen.findByTestId("book-upload-error");
        expect(error.textContent).toContain("could not be read as an EPUB");
        expect(screen.queryByTestId("book-upload-picker")).toBeNull();
    });

    it("blocks applying an over-long single section with a specific error", async () => {
        const {onApply} = setup({
            parse: okParse([
                {title: "Riesig", text: "x".repeat(MAX_SECTION_CHARS + 1)},
            ]),
        });
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

    it("shows the soft hint above the soft threshold (single selected)", async () => {
        setup({
            parse: okParse([
                {title: "Lang", text: "y".repeat(SOFT_SECTION_CHARS + 1)},
            ]),
        });
        pickFile();
        await waitFor(() =>
            expect(screen.getByTestId("book-upload-soft-hint")).toBeTruthy(),
        );
    });
});

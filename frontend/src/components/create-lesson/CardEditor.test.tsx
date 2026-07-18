/**
 * Tests for the Lesson Creator card editor (Phase 65B).
 * Drag reorder is exercised via the parent integration (and is
 * brittle to simulate in happy-dom), so here we pin the add / delete
 * / CSV-import / minimum-hint behaviour through the callbacks.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import CardEditor from "./CardEditor";
import type {LessonCardDraft} from "../../lib/content/lesson/lesson-draft";

function card(id: string, front = "Bonjour", back = "Hallo"): LessonCardDraft {
    return {id, front, back, notes: "", image: ""};
}

function setup(cards: LessonCardDraft[] = []) {
    const handlers = {
        onAdd: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
        onReorder: vi.fn(),
        onClearAll: vi.fn(),
        onImport: vi.fn(),
    };
    render(<CardEditor cards={cards} {...handlers} />);
    return handlers;
}

describe("CardEditor — layout regression (#1732)", () => {
    it("gives the card list token-scale spacing and rows real card chrome", () => {
        setup([card("c1"), card("c2")]);
        const list = screen.getByTestId("card-list");
        // Not an unstyled default <ul> — flex column with a token gap.
        expect(list.className).toContain("flex");
        expect(list.className).toMatch(/gap-/);
        expect(list.className).toContain("list-none");
        const row = screen.getByTestId("card-row-c1");
        // Real card chrome (the #1715/#1732 defect was a bare, unstyled row).
        expect(row.className).toContain("border");
        expect(row.className).toMatch(/\bp-/);
    });
});

describe("CardEditor", () => {
    it("shows the minimum-cards hint when under 4", () => {
        setup([card("c1")]);
        expect(screen.getByTestId("card-min-hint")).toBeInTheDocument();
        expect(screen.getByTestId("card-count").textContent).toContain("1");
    });

    it("adds a card with trimmed values", () => {
        const h = setup();
        fireEvent.change(screen.getByTestId("card-front-input"), {
            target: {value: "  Merci  "},
        });
        fireEvent.change(screen.getByTestId("card-back-input"), {
            target: {value: "Danke"},
        });
        fireEvent.click(screen.getByTestId("card-add-button"));
        expect(h.onAdd).toHaveBeenCalledWith({
            front: "Merci",
            back: "Danke",
            notes: "",
            image: "",
            altAnswers: [],
        });
    });

    // #1797 — a card can carry additional accepted answers for its
    // free-text exercise, entered via the shared StringListEditor.
    it("adds a card with additional accepted answers", () => {
        const h = setup();
        fireEvent.change(screen.getByTestId("card-front-input"), {
            target: {value: "single"},
        });
        fireEvent.change(screen.getByTestId("card-back-input"), {
            target: {value: "Single"},
        });
        fireEvent.change(screen.getByTestId("card-alt-answers-input"), {
            target: {value: "noch Single"},
        });
        fireEvent.click(screen.getByTestId("card-alt-answers-add"));
        fireEvent.click(screen.getByTestId("card-add-button"));
        expect(h.onAdd).toHaveBeenCalledWith({
            front: "single",
            back: "Single",
            notes: "",
            image: "",
            altAnswers: ["noch Single"],
        });
    });

    it("shows an alt-answer count badge on a card row", () => {
        setup([
            {
                id: "c1",
                front: "single",
                back: "Single",
                notes: "",
                image: "",
                altAnswers: ["noch Single", "alleinstehend"],
            },
        ]);
        expect(screen.getByTestId("card-alt-count-c1").textContent).toContain("2");
    });

    it("disables Add until front and back are filled", () => {
        setup();
        expect(screen.getByTestId("card-add-button")).toBeDisabled();
        fireEvent.change(screen.getByTestId("card-front-input"), {
            target: {value: "Oui"},
        });
        expect(screen.getByTestId("card-add-button")).toBeDisabled();
        fireEvent.change(screen.getByTestId("card-back-input"), {
            target: {value: "Ja"},
        });
        expect(screen.getByTestId("card-add-button")).not.toBeDisabled();
    });

    it("deletes a card", () => {
        const h = setup([card("c1")]);
        fireEvent.click(screen.getByTestId("card-delete-c1"));
        expect(h.onDelete).toHaveBeenCalledWith("c1");
    });

    // #1722 — the inline edit was the one unguarded path to an empty card
    // side, which then failed the Step-4 structure check (ajv minLength: 1)
    // with no visible reason. Save must be gated exactly like Add.
    it("disables the inline-edit Save when a card side is emptied (#1722)", () => {
        const h = setup([card("c1")]);
        fireEvent.click(screen.getByTestId("card-edit-c1"));
        fireEvent.change(screen.getByTestId("card-edit-back-c1"), {
            target: {value: "   "},
        });
        expect(screen.getByTestId("card-edit-save-c1")).toBeDisabled();
        fireEvent.click(screen.getByTestId("card-edit-save-c1"));
        expect(h.onUpdate).not.toHaveBeenCalled();
        fireEvent.change(screen.getByTestId("card-edit-back-c1"), {
            target: {value: "Hallo"},
        });
        expect(screen.getByTestId("card-edit-save-c1")).not.toBeDisabled();
    });

    it("caps card sides at the schema's 500 chars (#1722)", () => {
        setup([card("c1")]);
        expect(screen.getByTestId("card-front-input")).toHaveAttribute(
            "maxlength",
            "500",
        );
        expect(screen.getByTestId("card-back-input")).toHaveAttribute(
            "maxlength",
            "500",
        );
        fireEvent.click(screen.getByTestId("card-edit-c1"));
        expect(screen.getByTestId("card-edit-front-c1")).toHaveAttribute(
            "maxlength",
            "500",
        );
        expect(screen.getByTestId("card-edit-back-c1")).toHaveAttribute(
            "maxlength",
            "500",
        );
    });

    it("imports valid CSV rows", () => {
        const h = setup();
        fireEvent.click(screen.getByTestId("card-csv-toggle"));
        fireEvent.change(screen.getByTestId("card-csv-textarea"), {
            target: {value: "Bonjour,Hallo\nMerci,Danke\nBad"},
        });
        // Preview: 2 valid of 3.
        expect(screen.getByTestId("card-csv-preview").textContent).toContain(
            "2",
        );
        fireEvent.click(screen.getByTestId("card-csv-import"));
        expect(h.onImport).toHaveBeenCalledWith([
            {front: "Bonjour", back: "Hallo", notes: ""},
            {front: "Merci", back: "Danke", notes: ""},
        ]);
    });
});

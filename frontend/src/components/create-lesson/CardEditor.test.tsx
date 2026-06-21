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
        });
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

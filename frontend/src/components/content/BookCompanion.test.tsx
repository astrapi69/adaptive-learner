import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import type {BookMetadata} from "../../lib/content/book-companion";
import BookCompanion from "./BookCompanion";

function book(over: Partial<BookMetadata> = {}): BookMetadata {
    return {
        title: "KI für Einsteiger",
        author: "Asterios Raptis",
        url: "https://example.com/book",
        edition: "2. Auflage",
        ...over,
    };
}

describe("BookCompanion", () => {
    it("renders the title, author, edition and a noopener 'To the book' link", () => {
        render(<BookCompanion book={book()} source="astrapi69/ki-book" />);
        expect(screen.getByTestId("book-companion-title")).toHaveTextContent(
            "KI für Einsteiger",
        );
        expect(
            screen.getByTestId("book-companion-astrapi69/ki-book"),
        ).toHaveTextContent("by Asterios Raptis · 2. Auflage");
        const link = screen.getByTestId("book-companion-link");
        expect(link).toHaveAttribute("href", "https://example.com/book");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(link).toHaveAttribute("target", "_blank");
    });

    it("shows the cover image when a coverUrl is present", () => {
        render(
            <BookCompanion
                book={book({coverUrl: "https://raw.githubusercontent.com/x/y/main/c.png"})}
                source="x/y"
            />,
        );
        const img = document.querySelector("img");
        expect(img).toHaveAttribute(
            "src",
            "https://raw.githubusercontent.com/x/y/main/c.png",
        );
    });

    it("falls back to the placeholder icon without a cover", () => {
        render(<BookCompanion book={book({coverUrl: null})} source="x/y" />);
        expect(document.querySelector("img")).toBeNull();
    });
});

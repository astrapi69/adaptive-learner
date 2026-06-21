/**
 * Tests for the book-companion projector (EXP-025 / AUTH-02, #142).
 */

import {describe, expect, it} from "vitest";

import {isFetchableSource, projectBook} from "./book-companion";

describe("isFetchableSource", () => {
    it("skips bundled sources, accepts GitHub repos", () => {
        expect(isFetchableSource("bundled:adaptive-learner-content")).toBe(false);
        expect(isFetchableSource("astrapi69/ki-book")).toBe(true);
    });
});

describe("projectBook", () => {
    const SRC = "astrapi69/ki-book";

    it("projects a valid book block and resolves the cover URL", () => {
        const book = projectBook(
            {
                book: {
                    title: "KI für Einsteiger",
                    author: "Asterios Raptis",
                    url: "https://example.com/book",
                    edition: "2. Auflage",
                    pages: 320,
                    cover: "cover.png",
                },
            },
            SRC,
            "main",
        );
        expect(book).toMatchObject({
            title: "KI für Einsteiger",
            author: "Asterios Raptis",
            url: "https://example.com/book",
            edition: "2. Auflage",
            pages: 320,
            coverUrl: "https://raw.githubusercontent.com/astrapi69/ki-book/main/cover.png",
        });
    });

    it("returns null when there is no book block", () => {
        expect(projectBook({sets: []}, SRC, "main")).toBeNull();
        expect(projectBook(null, SRC, "main")).toBeNull();
    });

    it("returns null on a missing required field", () => {
        expect(
            projectBook({book: {title: "T", url: "https://x.de/b"}}, SRC, "main"),
        ).toBeNull();
    });

    it("returns null on a non-http url", () => {
        expect(
            projectBook(
                {book: {title: "T", author: "A", url: "ftp://x.de/b"}},
                SRC,
                "main",
            ),
        ).toBeNull();
    });

    it("leaves coverUrl null when no cover is declared", () => {
        const book = projectBook(
            {book: {title: "T", author: "A", url: "https://x.de/b"}},
            SRC,
            "main",
        );
        expect(book?.coverUrl).toBeNull();
    });

    it("drops a non-integer pages value", () => {
        const book = projectBook(
            {book: {title: "T", author: "A", url: "https://x.de/b", pages: "lots"}},
            SRC,
            "main",
        );
        expect(book?.pages).toBeNull();
    });
});

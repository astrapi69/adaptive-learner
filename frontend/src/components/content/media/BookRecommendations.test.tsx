import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Book } from "../../../lib/content/media/book-recommendations";
import BookRecommendations from "./BookRecommendations";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

const BOOKS: Book[] = [
  {
    title: "KI für Einsteiger",
    author: "Asterios Raptis",
    url: "https://www.amazon.de/dp/B0F43H6T2M/",
    description: "Prompt Engineering ohne Programmierkenntnisse.",
  },
];

describe("BookRecommendations", () => {
  it("renders nothing when the domain has no books", () => {
    const { container } = render(
      <BookRecommendations domain="psychology" books={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a card per book with a new-tab Amazon link", () => {
    render(<BookRecommendations domain="ai" books={BOOKS} />);
    expect(screen.getByTestId("book-recommendations-ai")).toBeInTheDocument();
    expect(screen.getByText("KI für Einsteiger")).toBeInTheDocument();
    expect(screen.getByText("Asterios Raptis")).toBeInTheDocument();
    const link = screen.getByTestId("book-amazon-link");
    expect(link).toHaveAttribute(
      "href",
      "https://www.amazon.de/dp/B0F43H6T2M/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the toggle with the outline variant so it stays visible in dark themes (#177)", () => {
    render(<BookRecommendations domain="ai" books={BOOKS} />);
    // outline gives a bordered surface (the surface-less ghost variant
    // read as nearly invisible in dark themes); text stays AA.
    const toggle = screen.getByTestId("book-recommendations-toggle");
    expect(toggle.className).toContain("border");
    expect(toggle.className).toContain("text-foreground");
  });
});

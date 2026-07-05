/**
 * PageContainer tests (#1380) — the shared centered page wrapper.
 *
 * Pins the container contract every consumer relies on: the ``<main
 * id="main">`` landmark, the ``data-slot`` marker, the canonical
 * width/centering/padding utilities (incl. ``w-full`` so mobile keeps
 * filling the viewport), and that a caller className is appended
 * without displacing the canonical set.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PageContainer, { PAGE_CONTAINER_CLASSES } from "./PageContainer";

describe("PageContainer (#1380)", () => {
  it("renders a <main id='main'> landmark with the data-slot marker", () => {
    render(<PageContainer testId="pc">content</PageContainer>);
    const main = screen.getByTestId("pc");
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("data-slot", "page-container");
    expect(main).toHaveTextContent("content");
  });

  it("applies exactly the canonical container classes by default", () => {
    render(<PageContainer testId="pc">x</PageContainer>);
    expect(screen.getByTestId("pc")).toHaveClass(PAGE_CONTAINER_CLASSES, {
      exact: true,
    });
  });

  it("bounds, centers, and pads the page (the Meine-Inhalte pattern)", () => {
    render(<PageContainer testId="pc">x</PageContainer>);
    const main = screen.getByTestId("pc");
    expect(main).toHaveClass("max-w-5xl");
    expect(main).toHaveClass("mx-auto");
    expect(main).toHaveClass("p-4");
  });

  it("fills the width on narrow viewports (w-full — mobile unchanged)", () => {
    render(<PageContainer testId="pc">x</PageContainer>);
    expect(screen.getByTestId("pc")).toHaveClass("w-full");
  });

  it("appends a caller className without dropping the canonical set", () => {
    render(
      <PageContainer testId="pc" className="extra-hook">
        x
      </PageContainer>,
    );
    const main = screen.getByTestId("pc");
    expect(main).toHaveClass("extra-hook");
    expect(main).toHaveClass("max-w-5xl");
    expect(main).toHaveClass("mx-auto");
    expect(main).toHaveClass("w-full");
    expect(main).toHaveClass("p-4");
  });
});

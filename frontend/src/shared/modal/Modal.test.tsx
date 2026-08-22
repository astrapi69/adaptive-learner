import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ModalOverlay, ModalCard, ModalTitle } from "./Modal";

describe("Modal parts", () => {
  it("renders overlay > card > title with attribute passthrough", () => {
    render(
      <ModalOverlay data-testid="my-dialog">
        <ModalCard role="dialog" aria-modal="true" aria-labelledby="my-title">
          <ModalTitle id="my-title">Confirm</ModalTitle>
          <p>body</p>
        </ModalCard>
      </ModalOverlay>,
    );

    expect(screen.getByTestId("my-dialog")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "my-title");
    expect(
      screen.getByRole("heading", { level: 2, name: "Confirm" }),
    ).toHaveAttribute("id", "my-title");
  });

  it("merges consumer utilities over the card defaults (tailwind-merge)", () => {
    render(
      <ModalCard data-testid="card" className="max-w-[540px]">
        body
      </ModalCard>,
    );

    const cls = screen.getByTestId("card").className;
    expect(cls).toContain("max-w-[540px]");
    expect(cls).not.toContain("max-w-[32rem]");
  });

  it("supports h3 titles and forwards the card ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ModalCard ref={ref}>
        <ModalTitle as="h3">Danger</ModalTitle>
      </ModalCard>,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Danger" }),
    ).toBeInTheDocument();
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

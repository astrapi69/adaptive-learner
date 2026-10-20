/**
 * TheoryBody renders a theory step's Markdown. A third-party content
 * repository can put an image from any host into it; the browser must not
 * fetch that on render (#3803).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TheoryBody from "./TheoryBody";

describe("TheoryBody images (#3803)", () => {
  it("reproduction: offers an image from another host as a link, never loads it", () => {
    render(
      <TheoryBody
        testId="lesson-theory-body"
        body={"Text.\n\n![Probebild](https://probe-image.example/p.png?from=theory)"}
      />,
    );
    const body = screen.getByTestId("lesson-theory-body");
    expect(body.querySelector("img")).toBeNull();
    const link = screen.getByTestId("markdown-remote-image");
    expect(link).toHaveTextContent("Probebild");
    expect(link).toHaveAttribute(
      "href",
      "https://probe-image.example/p.png?from=theory",
    );
  });

  it("renders a same-origin image as an image, as before", () => {
    render(<TheoryBody testId="lesson-theory-body" body="![Skizze](/skizze.png)" />);
    const img = screen.getByTestId("lesson-theory-body").querySelector("img");
    expect(img).toHaveAttribute("src", "/skizze.png");
    expect(img).toHaveAttribute("alt", "Skizze");
  });
});

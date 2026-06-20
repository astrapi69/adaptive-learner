/**
 * Tests for NavGroup (EXP-037 / #850): renders a labelled, reusable group of
 * navigation links. The label is decorative (aria-hidden); the links carry the
 * accessible names.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NavGroup from "./NavGroup";

describe("NavGroup", () => {
  it("renders the section label and its children", () => {
    render(
      <NavGroup label="LEARN" testId="group-learn">
        <a href="#a" data-testid="link-a">
          A
        </a>
        <a href="#b" data-testid="link-b">
          B
        </a>
      </NavGroup>,
    );
    expect(screen.getByTestId("group-learn")).toBeInTheDocument();
    expect(screen.getByText("LEARN")).toBeInTheDocument();
    expect(screen.getByTestId("link-a")).toBeInTheDocument();
    expect(screen.getByTestId("link-b")).toBeInTheDocument();
  });

  it("marks the label aria-hidden (decorative grouping)", () => {
    render(<NavGroup label="CONTENT">{<span>x</span>}</NavGroup>);
    expect(screen.getByText("CONTENT").getAttribute("aria-hidden")).toBe("true");
  });
});

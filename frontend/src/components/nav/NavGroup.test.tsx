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

  it("shows the label by default (visible section header, e.g. the mobile sheet)", () => {
    render(<NavGroup label="LEARN">{<span>x</span>}</NavGroup>);
    const label = screen.getByText("LEARN");
    expect(label.className).toContain("block");
    expect(label.className).not.toContain("hidden");
  });

  it("hides the label via the hideLabel prop (top bar) without a CSS context override", () => {
    render(
      <NavGroup label="LEARN" hideLabel>
        <span>x</span>
      </NavGroup>,
    );
    const label = screen.getByText("LEARN");
    // The label stays in the DOM (decorative) but is display:none via the
    // `hidden` utility - visibility is driven by the prop, not by
    // `.app-nav .nav-group-label { display: none }` (#1592 / #1571).
    expect(label.className).toContain("hidden");
    expect(label.className).not.toContain("block");
    expect(label.getAttribute("aria-hidden")).toBe("true");
  });
});

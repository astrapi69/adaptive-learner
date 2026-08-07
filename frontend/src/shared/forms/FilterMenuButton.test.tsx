/**
 * FilterMenuButton tests (#1386) — the single-select filter menu button
 * (the SetActionsMenu pattern; deliberately NOT a native select, #1342).
 * Pins the label-shows-selection contract, the ARIA menu-button pattern
 * (aria-expanded, menuitemradio + aria-checked), selection closing the
 * menu, Escape dismiss with focus restore, and arrow-key roving focus.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FilterMenuButton from "./FilterMenuButton";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

function renderButton(value = "active", onChange = vi.fn()) {
  render(
    <FilterMenuButton
      label="Status"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      testId="status-menu"
    />,
  );
  return onChange;
}

describe("FilterMenuButton (#1386)", () => {
  it("shows the filter name and the ACTIVE choice in the trigger label", () => {
    renderButton("completed");
    const trigger = screen.getByTestId("status-menu");
    expect(trigger).toHaveTextContent("Status:");
    expect(screen.getByTestId("status-menu-label")).toHaveTextContent(
      "Completed",
    );
  });

  it("is a WAI-ARIA menu button — never a native select", () => {
    renderButton();
    const trigger = screen.getByTestId("status-menu");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector("select")).toBeNull();
  });

  it("opens the menu with menuitemradio options and the selected one checked", () => {
    renderButton("active");
    fireEvent.click(screen.getByTestId("status-menu"));
    expect(screen.getByTestId("status-menu")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    const active = screen.getByTestId("status-menu-active");
    expect(active).toHaveAttribute("role", "menuitemradio");
    expect(active).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("status-menu-all")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("resets the browser list marker on the menu (no bullets, #2498)", () => {
    // Tailwind's preflight reset is intentionally NOT imported in this
    // project, so an un-reset portalled <ul> would render native disc
    // bullets + a ~40px indent. The list-none/m-0 utilities must be present.
    renderButton();
    fireEvent.click(screen.getByTestId("status-menu"));
    const menu = screen.getByRole("menu");
    expect(menu.tagName).toBe("UL");
    expect(menu.className).toContain("list-none");
    expect(menu.className).toContain("m-0");
  });

  it("marks the selected option beyond the check icon (#2498)", () => {
    renderButton("active");
    fireEvent.click(screen.getByTestId("status-menu"));
    const active = screen.getByTestId("status-menu-active");
    const inactive = screen.getByTestId("status-menu-all");
    // The selected row carries a persistent elevated-surface highlight +
    // medium weight; an inactive row only lights up on hover/focus.
    expect(active.className).toContain("font-medium");
    expect(active.className).toContain("bg-[var(--bg-elevated)]");
    expect(inactive.className).not.toContain("font-medium");
    expect(inactive.className).toContain("hover:bg-[var(--bg-elevated)]");
  });

  it("selecting an option fires onChange and closes the menu", () => {
    const onChange = renderButton("active");
    fireEvent.click(screen.getByTestId("status-menu"));
    fireEvent.click(screen.getByTestId("status-menu-completed"));
    expect(onChange).toHaveBeenCalledWith("completed");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("status-menu")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("Escape closes the menu and restores focus to the trigger", () => {
    renderButton();
    const trigger = screen.getByTestId("status-menu");
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("ArrowDown/ArrowUp move focus across the options (roving focus)", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("status-menu"));
    const first = screen.getByTestId("status-menu-all");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByTestId("status-menu-active"));
    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "ArrowUp",
    });
    expect(document.activeElement).toBe(first);
  });
});

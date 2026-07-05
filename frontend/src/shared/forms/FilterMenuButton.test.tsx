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

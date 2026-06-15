import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsMobileMenu from "./SettingsMobileMenu";
import type { SidebarGroup } from "../../lib/settings/sidebar-model";

const groups: SidebarGroup[] = [
  {
    key: "general",
    label: "General",
    items: [{ value: "general", label: "General", testId: "settings-tab-general" }],
  },
  {
    key: "learning",
    label: "Learning",
    items: [{ value: "learning", label: "Learning", testId: "settings-tab-learning" }],
  },
];

function renderMenu(active = "general") {
  const onChange = vi.fn();
  render(<SettingsMobileMenu groups={groups} activeTab={active} onChange={onChange} />);
  return { onChange };
}

describe("SettingsMobileMenu", () => {
  it("shows the active tab label on the trigger", () => {
    renderMenu("learning");
    expect(screen.getByTestId("settings-mobile-trigger")).toHaveTextContent("Learning");
  });

  it("opens the popover on trigger click", () => {
    renderMenu();
    expect(screen.queryByTestId("settings-mobile-menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    expect(screen.getByTestId("settings-mobile-menu")).toBeInTheDocument();
  });

  it("selects a tab and auto-closes", () => {
    const { onChange } = renderMenu();
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    fireEvent.click(screen.getByTestId("settings-mobile-tab-learning"));
    expect(onChange).toHaveBeenCalledWith("learning");
    expect(screen.queryByTestId("settings-mobile-menu")).not.toBeInTheDocument();
  });

  it("marks the active item with aria-current", () => {
    renderMenu("learning");
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    expect(screen.getByTestId("settings-mobile-tab-learning")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes on Escape", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    expect(screen.getByTestId("settings-mobile-menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("settings-mobile-menu")).not.toBeInTheDocument();
  });

  it("closes on an outside click", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("settings-mobile-menu")).not.toBeInTheDocument();
  });
});

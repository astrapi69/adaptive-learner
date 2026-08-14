import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsSidebar from "./SettingsSidebar";
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
    items: [
      { value: "learning", label: "Learning", testId: "settings-tab-learning" },
      { value: "ai", label: "AI", testId: "settings-tab-ai" },
    ],
  },
  {
    key: "danger",
    variant: "danger",
    items: [{ value: "danger", label: "Danger", testId: "settings-tab-danger" }],
  },
];

describe("SettingsSidebar", () => {
  it("renders every group and item", () => {
    render(<SettingsSidebar groups={groups} activeTab="general" onChange={vi.fn()} />);
    expect(screen.getByTestId("settings-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("settings-group-general")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-ai")).toHaveTextContent("AI");
  });

  it("marks the active item with aria-current=page", () => {
    render(<SettingsSidebar groups={groups} activeTab="ai" onChange={vi.fn()} />);
    expect(screen.getByTestId("settings-tab-ai")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("settings-tab-general")).not.toHaveAttribute("aria-current");
  });

  it("calls onChange with the tab value on click", () => {
    const onChange = vi.fn();
    render(<SettingsSidebar groups={groups} activeTab="general" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("settings-tab-learning"));
    expect(onChange).toHaveBeenCalledWith("learning");
  });

  it("renders a danger group without a header", () => {
    render(<SettingsSidebar groups={groups} activeTab="general" onChange={vi.fn()} />);
    const dangerGroup = screen.getByTestId("settings-group-danger");
    expect(dangerGroup).toBeInTheDocument();
    // danger variant: no <h2> header, but the item is present
    expect(dangerGroup.querySelector("h2")).toBeNull();
    expect(screen.getByTestId("settings-tab-danger")).toBeInTheDocument();
  });

  // #2545 — Tailwind preflight is OFF in this project (styles/tailwind.css),
  // so a raw <ul> and raw <button> both fall back to UA default chrome
  // unless explicitly reset: a native disc bullet + ~40px indent on the
  // list, and a bordered/boxed look on every button regardless of state
  // (legacy/01-base.css's #185/#271 base rule resets button color/background
  // globally, but deliberately NOT border — the established convention,
  // e.g. word-tiles-editor.tsx, is an explicit per-component border-0).
  // Same defect class #2498 fixed for FilterMenuButton/SetActionsMenu.
  it("resets the native list marker on the group <ul> (#2498 sibling)", () => {
    render(<SettingsSidebar groups={groups} activeTab="general" onChange={vi.fn()} />);
    const list = screen.getByTestId("settings-tab-general").closest("ul");
    expect(list?.className).toContain("list-none");
  });

  it("resets the native UA button border on every item (#2498 sibling)", () => {
    render(<SettingsSidebar groups={groups} activeTab="general" onChange={vi.fn()} />);
    expect(screen.getByTestId("settings-tab-general").className).toContain("border-0");
    expect(screen.getByTestId("settings-tab-danger").className).toContain("border-0");
  });
});

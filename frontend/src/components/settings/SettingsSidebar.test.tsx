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
});

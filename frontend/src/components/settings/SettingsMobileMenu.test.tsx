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

  it("closes on an outside pointer-down", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("settings-mobile-menu")).not.toBeInTheDocument();
  });

  // Regression pin for #593: opening + closing the Settings menu must
  // never leave the header navigation unreachable. The popover must
  // unmount (no leftover blocking element) and a sibling header link
  // must still fire its handler.
  describe("header navigation stays reachable (#593)", () => {
    function renderWithHeader(active = "general") {
      const onChange = vi.fn();
      const onHeaderNav = vi.fn();
      render(
        <div>
          <a
            href="#dashboard"
            data-testid="header-link"
            onClick={(e) => {
              e.preventDefault();
              onHeaderNav();
            }}
          >
            Dashboard
          </a>
          <SettingsMobileMenu
            groups={groups}
            activeTab={active}
            onChange={onChange}
          />
        </div>,
      );
      return { onChange, onHeaderNav };
    }

    it("header link still navigates after selecting a tab", () => {
      const { onHeaderNav } = renderWithHeader();
      fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
      fireEvent.click(screen.getByTestId("settings-mobile-tab-learning"));
      // Menu closed (no leftover overlay) …
      expect(
        screen.queryByTestId("settings-mobile-menu"),
      ).not.toBeInTheDocument();
      // … and the header is interactive.
      fireEvent.click(screen.getByTestId("header-link"));
      expect(onHeaderNav).toHaveBeenCalledTimes(1);
    });

    it("tapping the header while open closes the menu and navigates", () => {
      const { onHeaderNav } = renderWithHeader();
      fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
      expect(screen.getByTestId("settings-mobile-menu")).toBeInTheDocument();
      // iOS touch: pointerdown on the header closes the menu …
      fireEvent.pointerDown(screen.getByTestId("header-link"));
      expect(
        screen.queryByTestId("settings-mobile-menu"),
      ).not.toBeInTheDocument();
      // … and the same tap's click still navigates.
      fireEvent.click(screen.getByTestId("header-link"));
      expect(onHeaderNav).toHaveBeenCalledTimes(1);
    });

    it("returns focus to the trigger on close (no trap)", () => {
      renderWithHeader();
      const trigger = screen.getByTestId("settings-mobile-trigger");
      trigger.focus();
      fireEvent.click(trigger);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByTestId("settings-mobile-menu")).not.toBeInTheDocument();
      expect(document.activeElement).toBe(trigger);
    });
  });
});

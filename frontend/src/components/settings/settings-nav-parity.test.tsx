/**
 * #2344 — Settings navigation parity (desktop sidebar <-> mobile menu).
 *
 * ``lib/settings/sidebar-model.ts`` feeds TWO genuinely separate renderers —
 * {@link ./SettingsSidebar} (desktop) and {@link ./SettingsMobileMenu}
 * (mobile). Nothing cross-checked them: their per-component fixtures even
 * disagreed (the desktop fixture carried a ``variant:"danger"`` group, the
 * mobile one did not), so the danger branch was exercised on one surface
 * only, and an empty or divergent model read green on both.
 *
 * This suite renders BOTH from ONE shared fixture (including a danger group)
 * and asserts each surface exposes the SAME item ``value`` set, with a
 * non-vacuity guard. The two surfaces do NOT share a testid scheme — desktop
 * uses ``SidebarItem.testId``, the mobile menu derives
 * ``settings-mobile-tab-${value}`` from ``value`` and ignores ``testId`` — so
 * the parity is keyed on ``value``, the field both renderers actually consume.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsMobileMenu from "./SettingsMobileMenu";
import SettingsSidebar from "./SettingsSidebar";
import type { SidebarGroup } from "../../lib/settings/sidebar-model";

/**
 * ONE fixture for BOTH renderers, mirroring the production model shape
 * (``Settings.tsx``) plus a ``variant:"danger"`` group so the danger branch is
 * covered on BOTH surfaces. ``testId`` follows the production convention
 * (``settings-tab-${value}``) so the desktop scheme is pinned too.
 */
const SHARED_GROUPS: SidebarGroup[] = [
  {
    key: "general",
    label: "General",
    items: [{ value: "general", label: "General", testId: "settings-tab-general" }],
  },
  {
    key: "learning",
    label: "Learning & AI",
    items: [
      { value: "learning", label: "Learning", testId: "settings-tab-learning" },
      { value: "ai", label: "AI", testId: "settings-tab-ai" },
      { value: "plugins", label: "Plugins", testId: "settings-tab-plugins" },
    ],
  },
  {
    key: "danger",
    variant: "danger",
    items: [{ value: "danger", label: "Danger zone", testId: "settings-tab-danger" }],
  },
];

/** Values the model exposes, in declaration order (a LITERAL, not re-derived). */
const EXPECTED_VALUES = ["general", "learning", "ai", "plugins", "danger"];
const EXPECTED_ITEMS = SHARED_GROUPS.flatMap((group) => group.items);

/** Item values a rendered surface exposes, read from the live DOM by prefix. */
function valuesFrom(scope: HTMLElement, prefix: string): string[] {
  return [...scope.querySelectorAll(`button[data-testid^='${prefix}']`)]
    .map((button) => button.getAttribute("data-testid")!.slice(prefix.length))
    .sort();
}

function renderDesktop() {
  render(<SettingsSidebar groups={SHARED_GROUPS} activeTab="general" onChange={vi.fn()} />);
  return screen.getByTestId("settings-tabs");
}

function renderMobileOpen() {
  render(<SettingsMobileMenu groups={SHARED_GROUPS} activeTab="general" onChange={vi.fn()} />);
  fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
  return screen.getByTestId("settings-mobile-menu");
}

describe("#2344 Settings nav parity", () => {
  it("the shared model is non-empty and matches the literal value list", () => {
    // Non-vacuity: an empty model must never read as a valid nav.
    expect(EXPECTED_ITEMS.length).toBeGreaterThan(0);
    expect(EXPECTED_ITEMS.map((item) => item.value)).toEqual(EXPECTED_VALUES);
  });

  it("desktop exposes exactly the model's item values, no more, no fewer", () => {
    const nav = renderDesktop();
    for (const item of EXPECTED_ITEMS) {
      expect(within(nav).getByTestId(item.testId)).toBeInTheDocument();
    }
    // Every rendered item button carries an item testid — no extras.
    expect(nav.querySelectorAll("button[data-testid]").length).toBe(EXPECTED_ITEMS.length);
  });

  it("mobile exposes exactly the model's item values, no more, no fewer", () => {
    const menu = renderMobileOpen();
    for (const item of EXPECTED_ITEMS) {
      expect(within(menu).getByTestId(`settings-mobile-tab-${item.value}`)).toBeInTheDocument();
    }
    expect(
      menu.querySelectorAll("button[data-testid^='settings-mobile-tab-']").length,
    ).toBe(EXPECTED_ITEMS.length);
  });

  it("both surfaces expose the SAME value set (keyed on value, not testId)", () => {
    const desktop = render(
      <SettingsSidebar groups={SHARED_GROUPS} activeTab="general" onChange={vi.fn()} />,
    );
    const desktopValues = valuesFrom(screen.getByTestId("settings-tabs"), "settings-tab-");
    desktop.unmount();

    render(<SettingsMobileMenu groups={SHARED_GROUPS} activeTab="general" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    const mobileValues = valuesFrom(
      screen.getByTestId("settings-mobile-menu"),
      "settings-mobile-tab-",
    );

    const expected = [...EXPECTED_VALUES].sort();
    expect(desktopValues).toEqual(expected);
    expect(mobileValues).toEqual(expected);
    expect(desktopValues).toEqual(mobileValues);
  });

  it("renders the variant:'danger' group on BOTH surfaces", () => {
    // Desktop: danger group container present, no <h2> header, item present.
    const desktop = render(
      <SettingsSidebar groups={SHARED_GROUPS} activeTab="general" onChange={vi.fn()} />,
    );
    const dangerGroup = within(screen.getByTestId("settings-tabs")).getByTestId(
      "settings-group-danger",
    );
    expect(dangerGroup.querySelector("h2")).toBeNull();
    expect(within(dangerGroup).getByTestId("settings-tab-danger")).toBeInTheDocument();
    desktop.unmount();

    // Mobile: danger item present after opening (mobile has no per-group testid).
    render(<SettingsMobileMenu groups={SHARED_GROUPS} activeTab="general" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("settings-mobile-trigger"));
    expect(screen.getByTestId("settings-mobile-tab-danger")).toBeInTheDocument();
  });
});

/**
 * TabBar (#3012) — the one tab-bar behaviour the three hubs share.
 *
 * Before this component the Content, Dashboard and Progress bars each had
 * their own overflow behaviour (wrap / squeeze / squeeze-without-padding),
 * and only the Content one was ever decided on purpose (#989). The bar is
 * compact on phones so three tabs fit on one line at every phone width and
 * four fit from 390px up; from ``sm`` it returns to the roomy sizing.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TabBar from "./TabBar";

const TABS = [
  { id: "a", label: "Entdecken" },
  { id: "b", label: "Meine Inhalte" },
  { id: "c", label: "Importieren" },
];

function renderBar(over: Partial<React.ComponentProps<typeof TabBar>> = {}) {
  const onSelect = vi.fn();
  render(
    <TabBar
      tabs={TABS}
      active="a"
      onSelect={onSelect}
      ariaLabel="Inhalte"
      testId="content-hub-tabs"
      tabTestIdPrefix="content-tab-"
      {...over}
    />,
  );
  return onSelect;
}

describe("TabBar (#3012)", () => {
  it("renders a tablist with one tab per entry, in order", () => {
    renderBar();
    const bar = screen.getByTestId("content-hub-tabs");
    expect(bar).toHaveAttribute("role", "tablist");
    expect(bar).toHaveAttribute("aria-label", "Inhalte");
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("data-testid"))).toEqual([
      "content-tab-a",
      "content-tab-b",
      "content-tab-c",
    ]);
  });

  it("marks exactly the active tab as selected", () => {
    renderBar({ active: "b" });
    expect(screen.getByTestId("content-tab-b")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getAllByRole("tab").filter((t) => t.getAttribute("aria-selected") === "true"),
    ).toHaveLength(1);
  });

  it("reports the clicked tab to the host", () => {
    const onSelect = renderBar();
    fireEvent.click(screen.getByTestId("content-tab-c"));
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  it("keeps a 44px tap target on every tab", () => {
    renderBar();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toContain("min-h-[44px]");
    }
  });

  // The measured core of #3012: compact on phones, roomy from sm up.
  it("is compact on phones and roomy from sm up", () => {
    renderBar();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toContain("px-2");
      expect(tab.className).toContain("text-xs");
      expect(tab.className).toContain("sm:px-4");
      expect(tab.className).toContain("sm:text-sm");
    }
  });

  // #989 stays the defined way out when even the compact bar runs out of
  // room (four tabs at 320px) — for all three bars now, not just Content.
  // Four tabs at 375px land within 0,1px of the available width at gap-1 —
  // too tight to survive a different font or rounding. The narrow gap buys
  // ~6px of headroom exactly where it is needed.
  it("uses a narrow gap on phones and the roomy one from sm up", () => {
    renderBar();
    const bar = screen.getByTestId("content-hub-tabs");
    expect(bar.className).toContain("gap-0.5");
    expect(bar.className).toContain("sm:gap-1");
  });

  it("wraps rather than overflowing or scrolling", () => {
    renderBar();
    const bar = screen.getByTestId("content-hub-tabs");
    expect(bar.className).toContain("flex-wrap");
    expect(bar.className).not.toContain("overflow-x");
  });

  it("lets the host add outer spacing without losing the bar's own classes", () => {
    renderBar({ className: "mb-4" });
    const bar = screen.getByTestId("content-hub-tabs");
    expect(bar.className).toContain("mb-4");
    expect(bar.className).toContain("flex-wrap");
  });
});

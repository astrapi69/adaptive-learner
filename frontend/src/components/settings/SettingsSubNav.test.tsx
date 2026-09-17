import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SettingsSubNav from "./SettingsSubNav";
import type { SettingsSubNavItem } from "./SettingsSubNav";

const items: SettingsSubNavItem[] = [
  { id: "basics", label: "Basics" },
  { id: "lessons", label: "In the lesson" },
  { id: "review", label: "After the lesson" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsSubNav (#2961)", () => {
  it("renders a labelled nav with one chip per item", () => {
    render(
      <SettingsSubNav items={items} activeId={null} onSelect={vi.fn()} ariaLabel="Learning sections" />,
    );
    const nav = screen.getByTestId("settings-subnav");
    expect(nav.tagName).toBe("NAV");
    expect(nav).toHaveAttribute("aria-label", "Learning sections");
    expect(screen.getByTestId("settings-subnav-basics")).toHaveTextContent("Basics");
    expect(screen.getByTestId("settings-subnav-review")).toHaveTextContent("After the lesson");
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("marks the active chip with aria-current=location and nothing else", () => {
    render(
      <SettingsSubNav items={items} activeId="lessons" onSelect={vi.fn()} ariaLabel="Learning sections" />,
    );
    expect(screen.getByTestId("settings-subnav-lessons")).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(screen.getByTestId("settings-subnav-basics")).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("settings-subnav-review")).not.toHaveAttribute("aria-current");
  });

  it("renders no active chip when activeId is null or unknown", () => {
    const { rerender } = render(
      <SettingsSubNav items={items} activeId={null} onSelect={vi.fn()} ariaLabel="Learning sections" />,
    );
    expect(document.querySelector("[aria-current]")).toBeNull();
    rerender(
      <SettingsSubNav items={items} activeId="bogus" onSelect={vi.fn()} ariaLabel="Learning sections" />,
    );
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("reports the clicked item id through onSelect", () => {
    const onSelect = vi.fn();
    render(
      <SettingsSubNav items={items} activeId="basics" onSelect={onSelect} ariaLabel="Learning sections" />,
    );
    fireEvent.click(screen.getByTestId("settings-subnav-review"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("review");
  });

  it("is sticky on md+ only and scrolls horizontally instead of wrapping", () => {
    render(
      <SettingsSubNav
        items={items}
        activeId={null}
        onSelect={vi.fn()}
        ariaLabel="Learning sections"
        stickyTop={69}
      />,
    );
    const nav = screen.getByTestId("settings-subnav");
    expect(nav).toHaveClass("md:sticky");
    expect(nav).not.toHaveClass("sticky");
    expect(nav.style.top).toBe("69px");
    const list = nav.querySelector("ul");
    expect(list).not.toBeNull();
    expect(list).toHaveClass("overflow-x-auto", "flex-nowrap");
    expect(list).not.toHaveClass("flex-wrap");
  });

  it("keeps the active chip visible inside the scrolling row", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollTo,
    });
    const { rerender } = render(
      <SettingsSubNav items={items} activeId={null} onSelect={vi.fn()} ariaLabel="Learning sections" />,
    );
    expect(scrollTo).not.toHaveBeenCalled();
    rerender(
      <SettingsSubNav items={items} activeId="review" onSelect={vi.fn()} ariaLabel="Learning sections" />,
    );
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

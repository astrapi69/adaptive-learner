/**
 * SetActionsMenu (#1300) — the per-set overflow menu.
 *
 * Pins: menu closed by default; opens on trigger click with the correct
 * ARIA; offers only SENSIBLE transitions per current status (never the
 * set's own status as a no-op); status + delete actions fire their
 * callbacks and close the menu; Escape closes.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContentSetEntry, SetStatus } from "../../../storage/types";
import SetActionsMenu from "./SetActionsMenu";

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "src",
    branch: "main",
    id: "psych",
    title: "Psychologie",
    language: "de",
    target_language: "de",
    source_language: "de",
    level: "A1",
    domain: "psychology",
    version: "1.0.0",
    lesson_count: 5,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    ...over,
  };
}

function renderMenu(status: SetStatus, onSetStatus = vi.fn(), onDelete = vi.fn()) {
  render(
    <SetActionsMenu
      entry={entry()}
      status={status}
      onSetStatus={onSetStatus}
      onDelete={onDelete}
    />,
  );
  return { onSetStatus, onDelete };
}

describe("SetActionsMenu", () => {
  it("renders the trigger and keeps the menu closed by default", () => {
    renderMenu("active");
    const trigger = screen.getByTestId("set-actions-psych");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("set-actions-menu-psych")).toBeNull();
  });

  it("opens the menu on click with aria-expanded true", () => {
    renderMenu("active");
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    expect(screen.getByTestId("set-actions-psych")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("set-actions-menu-psych")).toBeInTheDocument();
  });

  it("offers only sensible transitions for an active set (no 'activate')", () => {
    renderMenu("active");
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    expect(screen.getByTestId("set-action-psych-deferred")).toBeInTheDocument();
    expect(screen.getByTestId("set-action-psych-completed")).toBeInTheDocument();
    expect(screen.getByTestId("set-action-psych-delete")).toBeInTheDocument();
    // active is the current status — never offered as a no-op action.
    expect(screen.queryByTestId("set-action-psych-active")).toBeNull();
  });

  it("offers reactivate for a deferred set", () => {
    renderMenu("deferred");
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    expect(screen.getByTestId("set-action-psych-active")).toBeInTheDocument();
    expect(screen.getByTestId("set-action-psych-completed")).toBeInTheDocument();
    expect(screen.queryByTestId("set-action-psych-deferred")).toBeNull();
  });

  it("offers reactivate + defer for a completed set", () => {
    renderMenu("completed");
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    expect(screen.getByTestId("set-action-psych-active")).toBeInTheDocument();
    expect(screen.getByTestId("set-action-psych-deferred")).toBeInTheDocument();
    expect(screen.queryByTestId("set-action-psych-completed")).toBeNull();
  });

  it("fires onSetStatus with the chosen transition and closes", () => {
    const { onSetStatus } = renderMenu("active");
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    fireEvent.click(screen.getByTestId("set-action-psych-deferred"));
    expect(onSetStatus).toHaveBeenCalledWith("deferred");
    expect(screen.queryByTestId("set-actions-menu-psych")).toBeNull();
  });

  it("fires onDelete and closes", () => {
    const { onDelete } = renderMenu("active");
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    fireEvent.click(screen.getByTestId("set-action-psych-delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("set-actions-menu-psych")).toBeNull();
  });

  it("closes on Escape", () => {
    renderMenu("active");
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    expect(screen.getByTestId("set-actions-menu-psych")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("set-actions-menu-psych")).toBeNull();
  });

  // #1349 — the open menu must escape the row's DOM subtree (portal to
  // document.body), so ``#root``'s clipping/overflow context can't hide it on
  // iOS. RED against the old inline ``<ul>`` (rendered inside the trigger's
  // container); GREEN once portalled.
  it("renders the open menu in a portal outside the row container", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-testid", "row-wrapper");
    document.body.appendChild(wrapper);
    render(
      <SetActionsMenu entry={entry()} status="active" onSetStatus={vi.fn()} onDelete={vi.fn()} />,
      { container: wrapper },
    );
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    const menu = screen.getByTestId("set-actions-menu-psych");
    // Present + fixed-positioned on the top layer…
    expect(menu).toBeInTheDocument();
    expect(menu.style.position).toBe("fixed");
    // …but NOT a descendant of the row wrapper (it lives under document.body).
    expect(wrapper.contains(menu)).toBe(false);
    document.body.removeChild(wrapper);
  });

  it("keeps the menu open when a menu item is pointed at (portal is inside-dismiss)", () => {
    const { onDelete } = renderMenu("active");
    fireEvent.click(screen.getByTestId("set-actions-psych"));
    // A mousedown on the portalled item must NOT be treated as an outside click.
    fireEvent.mouseDown(screen.getByTestId("set-action-psych-delete"));
    expect(screen.getByTestId("set-actions-menu-psych")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("set-action-psych-delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

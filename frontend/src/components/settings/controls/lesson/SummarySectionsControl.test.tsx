/**
 * SummarySectionsControl (#1426, generalises #1411) — a numbered reorder list
 * with an in-row visibility checkbox per section. Pins: all sections listed +
 * checked by default in the default order, Up/Down reorders and persists, a
 * disabled section keeps its position + its arrows usable, and the migrated
 * #1376 correction choice is reflected instead of reset.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SummarySectionsControl from "./SummarySectionsControl";
import {
  DEFAULT_SUMMARY_SECTION_ORDER,
  SUMMARY_SECTION_KEYS,
  readSummarySections,
} from "../../../../lib/learning/summarySectionsPref";

afterEach(() => {
  localStorage.clear();
});

/** The rendered top-to-bottom order of section rows (by id). */
function renderedOrder(): string[] {
  return Array.from(
    document.querySelectorAll("[data-testid^='summary-sections-order-item-']"),
  ).map((el) =>
    el.getAttribute("data-testid")!.replace("summary-sections-order-item-", ""),
  );
}

describe("SummarySectionsControl", () => {
  it("lists one row per section, all checked, in the default order", () => {
    render(<SummarySectionsControl />);
    expect(renderedOrder()).toEqual([...DEFAULT_SUMMARY_SECTION_ORDER]);
    for (const key of SUMMARY_SECTION_KEYS) {
      expect(
        screen.getByTestId(`settings-summary-section-${key}`),
        key,
      ).toBeChecked();
    }
  });

  it("Move-up reorders the list and persists the new order", () => {
    render(<SummarySectionsControl />);
    // result is second by default → move it up to first.
    fireEvent.click(screen.getByTestId("summary-sections-up-result"));
    expect(renderedOrder().slice(0, 2)).toEqual(["result", "favorite"]);
    expect(readSummarySections().map((s) => s.id).slice(0, 2)).toEqual([
      "result",
      "favorite",
    ]);
  });

  it("the first row's Up and the last row's Down are disabled", () => {
    render(<SummarySectionsControl />);
    expect(screen.getByTestId("summary-sections-up-favorite")).toBeDisabled();
    expect(
      screen.getByTestId("summary-sections-down-correction"),
    ).toBeDisabled();
  });

  it("unchecking a section persists it without changing the order", () => {
    render(<SummarySectionsControl />);
    fireEvent.click(screen.getByTestId("settings-summary-section-xp"));
    expect(screen.getByTestId("settings-summary-section-xp")).not.toBeChecked();
    const stored = readSummarySections();
    expect(stored.find((s) => s.id === "xp")!.enabled).toBe(false);
    expect(stored.map((s) => s.id)).toEqual([...DEFAULT_SUMMARY_SECTION_ORDER]);
  });

  it("a disabled section keeps its row + its arrows stay usable", () => {
    render(<SummarySectionsControl />);
    fireEvent.click(screen.getByTestId("settings-summary-section-share"));
    // Row still present, arrow enabled, and moving it keeps it OFF.
    const upShare = screen.getByTestId("summary-sections-up-share");
    expect(upShare).toBeEnabled();
    fireEvent.click(upShare);
    const stored = readSummarySections();
    const share = stored.find((s) => s.id === "share")!;
    expect(share.enabled).toBe(false);
    // share moved above answers (its default follower) proving position moved.
    expect(stored.map((s) => s.id).indexOf("share")).toBeLessThan(
      [...DEFAULT_SUMMARY_SECTION_ORDER].indexOf("share"),
    );
  });

  it("reflects a stored reordered + disabled config on mount", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.summary_sections_order",
      JSON.stringify([
        { id: "correction", enabled: false },
        { id: "result", enabled: true },
      ]),
    );
    render(<SummarySectionsControl />);
    expect(renderedOrder().slice(0, 2)).toEqual(["correction", "result"]);
    expect(
      screen.getByTestId("settings-summary-section-correction"),
    ).not.toBeChecked();
    expect(screen.getByTestId("settings-summary-section-result")).toBeChecked();
  });

  it("shows the migrated #1376 correction-round OFF choice (no reset)", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.correction_round_enabled",
      "false",
    );
    render(<SummarySectionsControl />);
    expect(
      screen.getByTestId("settings-summary-section-correction"),
    ).not.toBeChecked();
    // Order untouched by the visibility-only migration.
    expect(renderedOrder()).toEqual([...DEFAULT_SUMMARY_SECTION_ORDER]);
  });
});

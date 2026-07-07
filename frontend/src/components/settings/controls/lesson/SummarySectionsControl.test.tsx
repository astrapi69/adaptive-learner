/**
 * SummarySectionsControl (#1411) — one toggle per lesson-summary section,
 * defaults all ON, persistence through the shared settings object, and the
 * migrated #1376 correction-round choice reflected instead of reset.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SummarySectionsControl from "./SummarySectionsControl";
import {
  SUMMARY_SECTION_KEYS,
  readSummarySections,
} from "../../../../lib/learning/summarySectionsPref";

afterEach(() => {
  localStorage.clear();
});

describe("SummarySectionsControl", () => {
  it("renders one toggle per section, all checked by default", () => {
    render(<SummarySectionsControl />);
    for (const key of SUMMARY_SECTION_KEYS) {
      expect(
        screen.getByTestId(`settings-summary-section-${key}`),
        key,
      ).toBeChecked();
    }
  });

  it("unchecking a section persists it in the shared settings object", () => {
    render(<SummarySectionsControl />);
    fireEvent.click(screen.getByTestId("settings-summary-section-xp"));
    expect(screen.getByTestId("settings-summary-section-xp")).not.toBeChecked();
    const stored = readSummarySections();
    expect(stored.xp).toBe(false);
    expect(stored.result).toBe(true);
  });

  it("reflects a stored disable on mount", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.summary_sections",
      JSON.stringify({ share: false }),
    );
    render(<SummarySectionsControl />);
    expect(
      screen.getByTestId("settings-summary-section-share"),
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
  });
});

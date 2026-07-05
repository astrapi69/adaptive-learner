/**
 * CorrectionRoundControl (#1376) — Settings → Learning toggle for the
 * lesson-summary correction round.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
  }),
}));

import CorrectionRoundControl from "./CorrectionRoundControl";
import { readCorrectionRoundEnabled } from "../../../../lib/learning/correctionRoundPref";

afterEach(() => {
  localStorage.clear();
});

describe("CorrectionRoundControl", () => {
  it("renders checked by default (correction round on)", () => {
    render(<CorrectionRoundControl />);
    expect(
      screen.getByTestId("settings-correction-round-toggle"),
    ).toBeChecked();
  });

  it("persists a disable to the pref", () => {
    render(<CorrectionRoundControl />);
    const toggle = screen.getByTestId("settings-correction-round-toggle");
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(readCorrectionRoundEnabled()).toBe(false);
  });

  it("reflects a stored disable on mount", () => {
    localStorage.setItem(
      "adaptive-learner.lesson.correction_round_enabled",
      "false",
    );
    render(<CorrectionRoundControl />);
    expect(
      screen.getByTestId("settings-correction-round-toggle"),
    ).not.toBeChecked();
  });
});

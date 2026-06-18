/**
 * #718 — the "Questions per review" control in Settings > Learning.
 */

import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ReviewSettingsControl from "./ReviewSettingsControl";
import { readReviewLimit } from "../lib/learning/reviewLimitPref";

afterEach(() => localStorage.clear());

describe("ReviewSettingsControl — review length (#718)", () => {
  it("shows the configured length (default 10) and the 5/10/15/20 options", () => {
    render(<ReviewSettingsControl />);
    const select = screen.getByTestId("settings-review-limit") as HTMLSelectElement;
    expect(select.value).toBe("10");
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["5", "10", "15", "20"]);
  });

  it("persists a new selection", () => {
    render(<ReviewSettingsControl />);
    const select = screen.getByTestId("settings-review-limit");
    fireEvent.change(select, { target: { value: "20" } });
    expect(readReviewLimit()).toBe(20);
  });
});

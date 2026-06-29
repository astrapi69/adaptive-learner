/**
 * ContentViewControl (#1257) — the Settings control for the global
 * content-view preference.
 *
 * Pins: the control reflects the default (list), switching it writes the
 * shared ``viewModePref`` source, and it stays in lockstep with the
 * in-tab quick-toggle (both read/write the same pref via
 * ``useContentViewMode`` — a change at one surface is reflected at the
 * other through the pref-change event).
 */

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ContentViewControl from "./ContentViewControl";
import { useContentViewMode } from "../../../hooks/content/useContentViewMode";
import {
  readContentViewMode,
  writeContentViewMode,
} from "../../../lib/content/browse/viewModePref";

afterEach(() => {
  localStorage.clear();
});

/** A stand-in for the in-tab quick-toggle: same shared source. */
function InTabProbe() {
  const [mode, setMode] = useContentViewMode();
  return (
    <div>
      <span data-testid="probe-mode">{mode}</span>
      <button type="button" data-testid="probe-to-grid" onClick={() => setMode("grid")}>
        grid
      </button>
    </div>
  );
}

describe("ContentViewControl", () => {
  it("reflects the default (list) when nothing is stored (#1257)", () => {
    render(<ContentViewControl />);
    expect(screen.getByTestId("settings-content-view-list")).toBeChecked();
    expect(screen.getByTestId("settings-content-view-grid")).not.toBeChecked();
  });

  it("writes the shared pref when switched to grid", () => {
    render(<ContentViewControl />);
    act(() => {
      fireEvent.click(screen.getByTestId("settings-content-view-grid"));
    });
    expect(readContentViewMode()).toBe("grid");
    expect(screen.getByTestId("settings-content-view-grid")).toBeChecked();
  });

  it("reflects an existing stored preference (grid)", () => {
    writeContentViewMode("grid");
    render(<ContentViewControl />);
    expect(screen.getByTestId("settings-content-view-grid")).toBeChecked();
    expect(screen.getByTestId("settings-content-view-list")).not.toBeChecked();
  });

  it("stays in lockstep with the in-tab quick-toggle (same source)", () => {
    render(
      <>
        <ContentViewControl />
        <InTabProbe />
      </>,
    );
    // Both start at the default list.
    expect(screen.getByTestId("settings-content-view-list")).toBeChecked();
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("list");

    // Flipping the in-tab toggle updates the Settings control live.
    act(() => {
      fireEvent.click(screen.getByTestId("probe-to-grid"));
    });
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("grid");
    expect(screen.getByTestId("settings-content-view-grid")).toBeChecked();

    // ...and switching the Settings control updates the in-tab toggle.
    act(() => {
      fireEvent.click(screen.getByTestId("settings-content-view-list"));
    });
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("list");
  });
});

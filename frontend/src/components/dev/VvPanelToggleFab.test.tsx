/** Tests for the sticky measurement-bar toggle button (#2799). */

import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  setViewportDiagnosticEnabled,
  setVvFabEnabled,
  setVvFabPosition,
  setVvPanelVisible,
} from "../../hooks/settings/useViewportDiagnostic";
import VvPanelToggleFab from "./VvPanelToggleFab";

describe("VvPanelToggleFab", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("renders nothing while the probe is off, even with the fab pref on", () => {
    setVvFabEnabled(true);
    render(<VvPanelToggleFab />);
    expect(screen.queryByTestId("vv-panel-fab")).toBeNull();
  });

  it("renders nothing while the fab pref is off, even with the probe on", () => {
    setViewportDiagnosticEnabled(true);
    render(<VvPanelToggleFab />);
    expect(screen.queryByTestId("vv-panel-fab")).toBeNull();
  });

  it("toggles the measurement bar exactly like the Settings toggle", () => {
    setViewportDiagnosticEnabled(true);
    setVvFabEnabled(true);
    render(<VvPanelToggleFab />);
    const fab = screen.getByTestId("vv-panel-fab");
    // Bar visible by default (#2785) — the fab reflects that state.
    expect(fab).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(fab);
    expect(fab).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem("adaptive-learner.vv_diag_panel")).toBe("0");
    fireEvent.click(fab);
    expect(fab).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("adaptive-learner.vv_diag_panel")).toBeNull();
  });

  it("reflects a Settings-side toggle live (shared single source)", () => {
    setViewportDiagnosticEnabled(true);
    setVvFabEnabled(true);
    render(<VvPanelToggleFab />);
    fireEvent.click(screen.getByTestId("vv-panel-fab"));
    expect(localStorage.getItem("adaptive-learner.vv_diag_panel")).toBe("0");
    act(() => setVvPanelVisible(true));
    expect(screen.getByTestId("vv-panel-fab")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("sits at the configured corner (default bottom-left)", () => {
    setViewportDiagnosticEnabled(true);
    setVvFabEnabled(true);
    const {unmount} = render(<VvPanelToggleFab />);
    expect(screen.getByTestId("vv-panel-fab")).toHaveAttribute(
      "data-position",
      "bottom-left",
    );
    unmount();
    setVvFabPosition("top-right");
    render(<VvPanelToggleFab />);
    const fab = screen.getByTestId("vv-panel-fab");
    expect(fab).toHaveAttribute("data-position", "top-right");
    expect(fab.className).toContain("top-");
    expect(fab.className).toContain("right-");
  });
});

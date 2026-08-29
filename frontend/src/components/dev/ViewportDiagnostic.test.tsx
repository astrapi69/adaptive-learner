/** Tests for the opt-in iOS tap-offset probe (#1569). */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ViewportDiagnostic from "./ViewportDiagnostic";

describe("ViewportDiagnostic", () => {
  beforeEach(() => {
    localStorage.clear();
    // A clean URL (no ?vvdiag) between tests.
    window.history.replaceState({}, "", "/");
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("renders nothing when the flag is absent", () => {
    render(<ViewportDiagnostic />);
    expect(screen.queryByTestId("viewport-diagnostic")).toBeNull();
  });

  it("renders the readout + copy control when enabled via localStorage flag", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    expect(screen.getByTestId("viewport-diagnostic")).toBeInTheDocument();
    expect(screen.getByTestId("viewport-diagnostic-values")).toHaveTextContent(/winY=/);
    expect(screen.getByTestId("viewport-diagnostic-copy")).toHaveTextContent(/kopieren/i);
    // Before any tap, the tap line prompts.
    expect(screen.getByTestId("viewport-diagnostic-tap")).toHaveTextContent(/tippe irgendwo/i);
  });

  it("?vvdiag=1 enables it and persists the flag; ?vvdiag=0 clears it", () => {
    window.history.replaceState({}, "", "/?vvdiag=1");
    const { unmount } = render(<ViewportDiagnostic />);
    expect(screen.getByTestId("viewport-diagnostic")).toBeInTheDocument();
    expect(localStorage.getItem("adaptive-learner.vv_diag")).toBe("1");
    unmount();

    window.history.replaceState({}, "", "/?vvdiag=0");
    render(<ViewportDiagnostic />);
    expect(screen.queryByTestId("viewport-diagnostic")).toBeNull();
    expect(localStorage.getItem("adaptive-learner.vv_diag")).toBeNull();
  });

  it("captures the tapped element's tag + testid and the vertical desync", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(
      <>
        <ViewportDiagnostic />
        <button data-testid="target-btn">Tap me</button>
      </>,
    );
    fireEvent.pointerDown(screen.getByTestId("target-btn"), {
      clientX: 10,
      clientY: 300,
    });
    const line = screen.getByTestId("viewport-diagnostic-tap");
    expect(line).toHaveTextContent("button[target-btn]");
    // The readout reports the finger Y and a ΔY (rendered-top minus finger Y).
    expect(line).toHaveTextContent("y=300");
    expect(line).toHaveTextContent(/ΔY=/);
    // The report block carries the same tap for copy/paste (behind the toggle).
    fireEvent.click(screen.getByTestId("viewport-diagnostic-toggle"));
    const report = screen.getByTestId("viewport-diagnostic-report") as HTMLTextAreaElement;
    expect(report.value).toContain("button[target-btn]");
  });

  it("starts collapsed: no full-width report textarea over the page (#2779)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    expect(screen.queryByTestId("viewport-diagnostic-report")).toBeNull();
    expect(screen.getByTestId("viewport-diagnostic-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("the toggle expands the report block and collapses it again (#2779)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    const toggle = screen.getByTestId("viewport-diagnostic-toggle");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("viewport-diagnostic-report")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("viewport-diagnostic-report")).toBeNull();
  });

  it("a tap on the toggle is not recorded as a measurement (#2779)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    fireEvent.pointerDown(screen.getByTestId("viewport-diagnostic-toggle"), {
      clientX: 5,
      clientY: 5,
    });
    expect(screen.getByTestId("viewport-diagnostic-tap")).toHaveTextContent(
      /tippe irgendwo/i,
    );
  });

  it("a tap on the panel itself is not recorded (never pollutes the measurement)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    fireEvent.pointerDown(screen.getByTestId("viewport-diagnostic-copy"), {
      clientX: 5,
      clientY: 5,
    });
    expect(screen.getByTestId("viewport-diagnostic-tap")).toHaveTextContent(
      /tippe irgendwo/i,
    );
  });

  it("the Copy button shows feedback when pressed", async () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    fireEvent.click(screen.getByTestId("viewport-diagnostic-copy"));
    // The feedback flips after the clipboard promise settles (a microtask).
    await waitFor(() =>
      expect(screen.getByTestId("viewport-diagnostic-copy")).toHaveTextContent(
        /kopiert/i,
      ),
    );
  });
});

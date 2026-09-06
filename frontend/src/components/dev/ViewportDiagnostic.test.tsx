/** Tests for the opt-in iOS tap-offset probe (#1569). */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setViewportDiagnosticEnabled } from "../../hooks/settings/useViewportDiagnostic";
import { readVvLog } from "../../lib/diagnostics/vv-log";
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

  it("ignores taps on the sticky bar-toggle button (#2799)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(
      <>
        <ViewportDiagnostic />
        <button data-testid="vv-panel-fab">toggle</button>
      </>,
    );
    fireEvent.pointerDown(screen.getByTestId("vv-panel-fab"), {
      clientX: 5,
      clientY: 500,
    });
    expect(screen.getByTestId("viewport-diagnostic-tap")).toHaveTextContent(
      /tippe irgendwo/i,
    );
    expect(readVvLog().filter((e) => e.kind === "tap")).toHaveLength(0);
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

  it("records keyboard shrink, scale and the pre-tap focus PER TAP (#2853)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(
      <>
        <ViewportDiagnostic />
        <input data-testid="prev-input" />
        <button data-testid="target-btn">Tap me</button>
      </>,
    );
    // Focus a field first — at pointerdown the tap record must name it as
    // the element that HELD focus when the tap landed.
    screen.getByTestId("prev-input").focus();
    fireEvent.pointerDown(screen.getByTestId("target-btn"), {
      clientX: 10,
      clientY: 300,
    });
    const line = screen.getByTestId("viewport-diagnostic-tap");
    expect(line).toHaveTextContent(/@kbd=/);
    expect(line).toHaveTextContent(/@scale=/);
    expect(line).toHaveTextContent("focus=input[prev-input]");
    // The persistent protocol carries the same per-tap fields.
    const logged = readVvLog().filter((entry) => entry.kind === "tap");
    expect(logged).toHaveLength(1);
    expect(logged[0].focus).toBe("input[prev-input]");
    expect(typeof logged[0].atKbd).toBe("number");
    expect(typeof logged[0].atScale).toBe("number");
  });

  it("the report head carries the width channel: vvW, innerW, docW (#2853)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    fireEvent.click(screen.getByTestId("viewport-diagnostic-toggle"));
    const report = screen.getByTestId(
      "viewport-diagnostic-report",
    ) as HTMLTextAreaElement;
    expect(report.value).toMatch(/vvW=\d+/);
    expect(report.value).toMatch(/innerW=\d+/);
    expect(report.value).toMatch(/docW=\d+/);
  });

  it("records the raw heights and the #root scroll position PER TAP (#2870)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    try {
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
      expect(line).toHaveTextContent(/@vvH=\d+/);
      expect(line).toHaveTextContent(/@innerH=\d+/);
      expect(line).toHaveTextContent(/@rootY=\d+/);
      // The persistent protocol carries the same raw values.
      const logged = readVvLog().filter((entry) => entry.kind === "tap");
      expect(logged).toHaveLength(1);
      expect(typeof logged[0].atVvHeight).toBe("number");
      expect(typeof logged[0].atInnerHeight).toBe("number");
      expect(typeof logged[0].atRootScrollY).toBe("number");
    } finally {
      root.remove();
    }
  });

  it("the report head carries rootY and docH (#2870)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    fireEvent.click(screen.getByTestId("viewport-diagnostic-toggle"));
    const report = screen.getByTestId(
      "viewport-diagnostic-report",
    ) as HTMLTextAreaElement;
    expect(report.value).toMatch(/rootY=\d+/);
    expect(report.value).toMatch(/docH=\d+/);
  });

  it("the report answers the environment questions itself (#2883)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    fireEvent.click(screen.getByTestId("viewport-diagnostic-toggle"));
    const report = screen.getByTestId(
      "viewport-diagnostic-report",
    ) as HTMLTextAreaElement;
    // Page-zoom arithmetic inputs + app context in the head.
    expect(report.value).toMatch(/screenW=\d+/);
    expect(report.value).toMatch(/screenH=\d+/);
    expect(report.value).toMatch(/dpr=[\d.]+/);
    expect(report.value).toMatch(/standalone=[01]/);
    // The user agent (iOS version -> interactive-widget support).
    expect(report.value).toContain("ua=");
    // The transition timeline section exists even before any event.
    expect(report.value).toContain("events (newest first):");
    expect(report.value).toContain("(no events yet)");
  });

  it("the report head names the build it came from (#2994)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    render(<ViewportDiagnostic />);
    fireEvent.click(screen.getByTestId("viewport-diagnostic-toggle"));
    const report = screen.getByTestId(
      "viewport-diagnostic-report",
    ) as HTMLTextAreaElement;
    // Version + commit + branch from the #1873/#1172 defines — a pasted
    // report must answer "does this device even run the fix?" itself.
    expect(report.value).toMatch(/v=\S+/);
    expect(report.value).toMatch(/build=\S+/);
    expect(report.value).toMatch(/branch=\S+/);
  });

  it("tap lines carry the relative timestamp t= (#2883)", () => {
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
    expect(screen.getByTestId("viewport-diagnostic-tap")).toHaveTextContent(
      /t=[\d.]+ y=300/,
    );
    const logged = readVvLog().filter((entry) => entry.kind === "tap");
    expect(logged).toHaveLength(1);
    expect(typeof logged[0].t).toBe("number");
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

  it("the Settings toggle mounts and unmounts the overlay live, no reload (#2782)", () => {
    render(<ViewportDiagnostic />);
    expect(screen.queryByTestId("viewport-diagnostic")).toBeNull();
    act(() => setViewportDiagnosticEnabled(true));
    expect(screen.getByTestId("viewport-diagnostic")).toBeInTheDocument();
    act(() => setViewportDiagnosticEnabled(false));
    expect(screen.queryByTestId("viewport-diagnostic")).toBeNull();
  });

  it("a tap lands in the persistent protocol, not only the in-memory history (#2782)", () => {
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
    const logged = readVvLog();
    expect(logged).toHaveLength(1);
    expect(logged[0].kind).toBe("tap");
    expect(logged[0].testid).toBe("target-btn");
    expect(logged[0].fix).toBe("off");
  });

  it("panel hidden: renders nothing but KEEPS recording to the protocol (#2785)", () => {
    localStorage.setItem("adaptive-learner.vv_diag", "1");
    localStorage.setItem("adaptive-learner.vv_diag_panel", "0");
    render(
      <>
        <ViewportDiagnostic />
        <button data-testid="target-btn">Tap me</button>
      </>,
    );
    expect(screen.queryByTestId("viewport-diagnostic")).toBeNull();
    fireEvent.pointerDown(screen.getByTestId("target-btn"), {
      clientX: 10,
      clientY: 300,
    });
    expect(screen.queryByTestId("viewport-diagnostic")).toBeNull();
    const logged = readVvLog();
    expect(logged).toHaveLength(1);
    expect(logged[0].kind).toBe("tap");
    expect(logged[0].testid).toBe("target-btn");
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

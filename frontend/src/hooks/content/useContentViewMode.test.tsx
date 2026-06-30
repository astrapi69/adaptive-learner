/**
 * useContentViewMode (#1240) — persistence across re-mount.
 *
 * The selected view must survive navigation/reload: a value set via
 * the hook is read back by a freshly-mounted consumer (proving it
 * persists through the established localStorage pref, not component
 * state).
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useContentViewMode } from "./useContentViewMode";

afterEach(() => {
  localStorage.clear();
});

function Probe() {
  const [mode, setMode] = useContentViewMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button type="button" onClick={() => setMode("grid")} data-testid="to-grid">
        grid
      </button>
    </div>
  );
}

describe("useContentViewMode", () => {
  it("defaults to list (#1257)", () => {
    render(<Probe />);
    expect(screen.getByTestId("mode")).toHaveTextContent("list");
  });

  it("persists across a fresh mount", () => {
    const first = render(<Probe />);
    act(() => {
      screen.getByTestId("to-grid").click();
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("grid");
    first.unmount();

    render(<Probe />);
    expect(screen.getByTestId("mode")).toHaveTextContent("grid");
  });
});

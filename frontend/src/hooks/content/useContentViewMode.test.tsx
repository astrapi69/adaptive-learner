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
      <button type="button" onClick={() => setMode("list")} data-testid="to-list">
        list
      </button>
    </div>
  );
}

describe("useContentViewMode", () => {
  it("defaults to grid", () => {
    render(<Probe />);
    expect(screen.getByTestId("mode")).toHaveTextContent("grid");
  });

  it("persists across a fresh mount", () => {
    const first = render(<Probe />);
    act(() => {
      screen.getByTestId("to-list").click();
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("list");
    first.unmount();

    render(<Probe />);
    expect(screen.getByTestId("mode")).toHaveTextContent("list");
  });
});

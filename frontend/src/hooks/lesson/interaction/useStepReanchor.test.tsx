/**
 * Tests for useStepReanchor (#3126): after a step change the scroll offset
 * is hard-reset FIRST (so a shrunken scroll height can never leave a stale
 * offset behind, the iOS class of #1422) and only then, once the new layout
 * is committed, the step anchor is scrolled into view.
 */
import { act, render } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStepReanchor } from "./useStepReanchor";

let calls: string[];
let scrollSpy: ReturnType<typeof vi.fn<(arg?: ScrollIntoViewOptions) => void>>;
let setStep: (n: number) => void;
let setEnabled: (v: boolean) => void;
let root: HTMLDivElement;

function Harness({ initialEnabled = true }: { initialEnabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStepState] = useState(0);
  const [enabled, setEnabledState] = useState(initialEnabled);
  setStep = setStepState;
  setEnabled = setEnabledState;
  useStepReanchor(ref, step, enabled);
  return <div ref={ref} data-testid="anchor" />;
}

beforeEach(() => {
  calls = [];
  root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
  // Record the ORDER of the two moves: the reset must precede the anchor.
  Object.defineProperty(root, "scrollTop", {
    configurable: true,
    get: () => 0,
    set: (value: number) => {
      calls.push(`root.scrollTop=${value}`);
    },
  });
  vi.stubGlobal("scrollTo", vi.fn(() => calls.push("window.scrollTo")));
  vi.stubGlobal(
    "requestAnimationFrame",
    (cb: FrameRequestCallback): number => {
      cb(0);
      return 0;
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  );
  scrollSpy = vi.fn<(arg?: ScrollIntoViewOptions) => void>((opts) => {
    calls.push(`scrollIntoView:${opts?.behavior}`);
  });
  Element.prototype.scrollIntoView = scrollSpy;
});

afterEach(() => {
  root.remove();
  vi.unstubAllGlobals();
});

describe("useStepReanchor (#3126)", () => {
  it("resets the scroll container to the top BEFORE anchoring the step", () => {
    render(<Harness />);
    expect(calls).toEqual([
      "root.scrollTop=0",
      "window.scrollTo",
      "scrollIntoView:smooth",
    ]);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("re-anchors on every step change, reset first each time", () => {
    render(<Harness />);
    calls.length = 0;
    act(() => setStep(1));
    expect(calls).toEqual([
      "root.scrollTop=0",
      "window.scrollTo",
      "scrollIntoView:smooth",
    ]);
    act(() => setStep(2));
    expect(scrollSpy).toHaveBeenCalledTimes(3);
  });

  it("scrolls without animation under prefers-reduced-motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })),
    );
    render(<Harness />);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("does nothing while disabled and re-anchors once enabled", () => {
    render(<Harness initialEnabled={false} />);
    expect(calls).toEqual([]);
    act(() => setEnabled(true));
    expect(calls[0]).toBe("root.scrollTop=0");
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("survives a headless environment without scrollTo or scrollIntoView", () => {
    vi.stubGlobal("scrollTo", undefined);
    // @ts-expect-error - simulate an engine without scrollIntoView
    Element.prototype.scrollIntoView = undefined;
    expect(() => render(<Harness />)).not.toThrow();
  });
});

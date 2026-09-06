/**
 * Tests for useDeferredScroll (#2961) - the bounded rAF retry loop lifted
 * from the Settings key-vault scroll (#1773 / #1831). Frames are driven by
 * hand: ``requestAnimationFrame`` is stubbed to queue callbacks, and
 * ``flushFrames(n)`` runs n of them.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeferredScroll } from "./useDeferredScroll";

let frames: FrameRequestCallback[] = [];

function flushFrames(count: number): void {
  for (let i = 0; i < count; i += 1) {
    const next = frames.shift();
    if (!next) return;
    next(performance.now());
  }
}

function fakeTarget(inView: boolean): Element {
  const el = document.createElement("div");
  el.scrollIntoView = vi.fn();
  el.getBoundingClientRect = () =>
    (inView
      ? { height: 40, top: 10, bottom: 50 }
      : { height: 40, top: 2000, bottom: 2040 }) as DOMRect;
  return el;
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDeferredScroll (#2961)", () => {
  it("does nothing while inactive or without a target", () => {
    const findTarget = vi.fn();
    const onSettled = vi.fn();
    renderHook(() => useDeferredScroll({ active: false, target: "a", findTarget, onSettled }));
    renderHook(() => useDeferredScroll({ active: true, target: null, findTarget, onSettled }));
    flushFrames(5);
    expect(findTarget).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("scrolls the target and settles once it is in view", () => {
    const onSettled = vi.fn();
    const offscreen = fakeTarget(false);
    const onscreen = fakeTarget(true);
    const findTarget = vi.fn().mockReturnValueOnce(offscreen).mockReturnValue(onscreen);
    renderHook(() =>
      useDeferredScroll({ active: true, target: "a", findTarget, onSettled, behavior: "smooth" }),
    );
    flushFrames(1);
    expect(findTarget).toHaveBeenCalledWith("a");
    expect(offscreen.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
    expect(onSettled).not.toHaveBeenCalled();
    flushFrames(1);
    expect(onscreen.scrollIntoView).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(true);
    expect(frames).toHaveLength(0);
  });

  it("re-issues the scroll while the target has no layout yet, then settles", () => {
    const onSettled = vi.fn();
    const onscreen = fakeTarget(true);
    const findTarget = vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValue(onscreen);
    renderHook(() => useDeferredScroll({ active: true, target: "a", findTarget, onSettled }));
    flushFrames(3);
    expect(findTarget).toHaveBeenCalledTimes(3);
    expect(onSettled).toHaveBeenCalledWith(true);
  });

  it("gives up after maxFrames and reports the miss", () => {
    const onSettled = vi.fn();
    const offscreen = fakeTarget(false);
    renderHook(() =>
      useDeferredScroll({
        active: true,
        target: "a",
        findTarget: () => offscreen,
        onSettled,
        maxFrames: 3,
      }),
    );
    flushFrames(10);
    expect(offscreen.scrollIntoView).toHaveBeenCalledTimes(3);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(false);
  });

  it("restarts for a new target and cancels the frame on unmount", () => {
    const onSettled = vi.fn();
    const first = fakeTarget(false);
    const second = fakeTarget(true);
    const findTarget = vi.fn((id: string) => (id === "a" ? first : second));
    const { rerender, unmount } = renderHook(
      ({ target }: { target: string | null }) =>
        useDeferredScroll({ active: true, target, findTarget, onSettled }),
      { initialProps: { target: "a" } },
    );
    flushFrames(1);
    expect(first.scrollIntoView).toHaveBeenCalledTimes(1);
    rerender({ target: "b" });
    flushFrames(2);
    expect(onSettled).toHaveBeenCalledWith(true);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});

/**
 * Tests for useOrientationReanchor (#1422) — after a device rotation the
 * active lesson step is scrolled back into view so the task + sticky
 * footer land inside the freshly-sized viewport (iOS leaves stale scroll
 * offsets / sticky positions after an orientation change until the next
 * scroll interaction).
 */

import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubMatchMedia, type MatchMediaStub } from "../../../test-utils/match-media-stub";
import { useOrientationReanchor } from "./useOrientationReanchor";

function Harness({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useOrientationReanchor(ref, enabled);
  return <div ref={ref} data-testid="anchor" />;
}

let media: MatchMediaStub;
let scrollSpy: ReturnType<typeof vi.fn<(arg?: ScrollIntoViewOptions) => void>>;

beforeEach(() => {
  media = stubMatchMedia(true); // "portrait"
  scrollSpy = vi.fn<(arg?: ScrollIntoViewOptions) => void>();
  // The hook defers behind a double rAF so the post-rotation reflow
  // finishes first; run callbacks synchronously in the test.
  vi.stubGlobal(
    "requestAnimationFrame",
    (cb: FrameRequestCallback): number => {
      cb(0);
      return 0;
    },
  );
  Element.prototype.scrollIntoView = scrollSpy;
});

afterEach(() => {
  media.restore();
  vi.unstubAllGlobals();
});

describe("useOrientationReanchor (#1422)", () => {
  it("re-anchors the step on an orientation change", () => {
    render(<Harness />);
    expect(scrollSpy).not.toHaveBeenCalled();
    act(() => media.set(false)); // portrait -> landscape
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "start" });
  });

  it("re-anchors again when rotating back", () => {
    render(<Harness />);
    act(() => media.set(false));
    act(() => media.set(true));
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });

  it("does nothing while disabled (e.g. resume prompt open)", () => {
    render(<Harness enabled={false} />);
    act(() => media.set(false));
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount (no listener leak)", () => {
    const { unmount } = render(<Harness />);
    unmount();
    expect(media.listenerCount()).toBe(0);
    act(() => media.set(false));
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

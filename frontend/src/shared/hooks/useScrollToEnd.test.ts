import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useScrollToEnd } from "./useScrollToEnd";

describe("useScrollToEnd (#3400)", () => {
  it("scrolls the strip to its end on mount and when the key changes", () => {
    const el = { scrollLeft: 0, scrollWidth: 900 };
    const ref = { current: el };
    const { rerender } = renderHook(({ key }) => useScrollToEnd(ref, key), {
      initialProps: { key: "a" },
    });
    expect(el.scrollLeft).toBe(900);
    el.scrollLeft = 10;
    el.scrollWidth = 1200;
    rerender({ key: "b" });
    expect(el.scrollLeft).toBe(1200);
  });

  it("leaves the position alone when the key is unchanged", () => {
    const el = { scrollLeft: 0, scrollWidth: 900 };
    const ref = { current: el };
    const { rerender } = renderHook(({ key }) => useScrollToEnd(ref, key), {
      initialProps: { key: "a" },
    });
    el.scrollLeft = 300;
    rerender({ key: "a" });
    expect(el.scrollLeft).toBe(300);
  });

  it("does nothing without an element", () => {
    const ref = { current: null };
    expect(() => renderHook(() => useScrollToEnd(ref, 1))).not.toThrow();
  });
});

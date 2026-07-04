/** Tests for the multi-select state hook (#1351). */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSetSelection } from "./useSetSelection";

const A = "owner/repo#a";
const B = "owner/repo#b";
const C = "owner/repo#c";

describe("useSetSelection (#1351)", () => {
  it("toggles a single key on and off", () => {
    const { result } = renderHook(() => useSetSelection());
    expect(result.current.isSelected(A)).toBe(false);
    act(() => result.current.toggle(A));
    expect(result.current.isSelected(A)).toBe(true);
    expect(result.current.count).toBe(1);
    act(() => result.current.toggle(A));
    expect(result.current.isSelected(A)).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("selectAll selects exactly the given (filtered) keys, and toggles off when all chosen", () => {
    const { result } = renderHook(() => useSetSelection());
    // Select-all over a FILTERED subset [A, B] — never more (C stays out).
    act(() => result.current.selectAll([A, B]));
    expect(result.current.count).toBe(2);
    expect(result.current.isSelected(A)).toBe(true);
    expect(result.current.isSelected(B)).toBe(true);
    expect(result.current.isSelected(C)).toBe(false);
    // Calling again with the same fully-selected set clears it.
    act(() => result.current.selectAll([A, B]));
    expect(result.current.count).toBe(0);
  });

  it("masterState is tri-state over the visible keys", () => {
    const { result } = renderHook(() => useSetSelection());
    expect(result.current.masterState([A, B])).toBe(false);
    act(() => result.current.toggle(A));
    expect(result.current.masterState([A, B])).toBe("indeterminate");
    act(() => result.current.toggle(B));
    expect(result.current.masterState([A, B])).toBe(true);
  });

  it("clear empties the selection", () => {
    const { result } = renderHook(() => useSetSelection());
    act(() => result.current.selectAll([A, B, C]));
    expect(result.current.count).toBe(3);
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  it("a narrower filter's select-all does not pull in keys outside it", () => {
    const { result } = renderHook(() => useSetSelection());
    // Filter shows only [A]; select-all selects A only.
    act(() => result.current.selectAll([A]));
    expect(result.current.count).toBe(1);
    // Master over the (now wider) unfiltered [A,B,C] is indeterminate, not true.
    expect(result.current.masterState([A, B, C])).toBe("indeterminate");
  });
});

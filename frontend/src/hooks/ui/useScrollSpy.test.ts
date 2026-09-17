/**
 * Tests for useScrollSpy (#2966). happy-dom has no IntersectionObserver,
 * so the tests install a recording stub: every ``observe`` is captured and
 * ``fire(entries)`` invokes the observer callback by hand.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollSpy } from "./useScrollSpy";

interface StubObserver {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnect: () => void;
}

let observers: StubObserver[] = [];

function installStub(): void {
  observers = [];
  class FakeIntersectionObserver {
    private readonly record: StubObserver;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.record = { callback, options, observed: [], disconnect: vi.fn<() => void>() };
      observers.push(this.record);
    }
    observe(el: Element) {
      this.record.observed.push(el);
    }
    unobserve() {}
    disconnect() {
      this.record.disconnect();
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
}

function fire(observer: StubObserver, intersecting: Record<string, boolean>): void {
  const entries = Object.entries(intersecting).map(
    ([id, isIntersecting]) =>
      ({ target: elements[id], isIntersecting }) as unknown as IntersectionObserverEntry,
  );
  act(() => observer.callback(entries, observer as unknown as IntersectionObserver));
}

const IDS = ["basics", "lessons", "review"] as const;
let elements: Record<string, HTMLElement>;

beforeEach(() => {
  elements = Object.fromEntries(
    IDS.map((id) => {
      const el = document.createElement("section");
      el.id = `learning-${id}`;
      document.body.appendChild(el);
      return [id, el];
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const resolve = (id: string) => elements[id] ?? null;

describe("useScrollSpy (#2966)", () => {
  it("returns null and observes nothing without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useScrollSpy(IDS, { enabled: true, resolve }));
    expect(result.current).toBeNull();
  });

  it("observes every resolved element with the top offset folded into rootMargin", () => {
    installStub();
    renderHook(() => useScrollSpy(IDS, { enabled: true, resolve, topOffset: 120 }));
    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual(IDS.map((id) => elements[id]));
    expect(observers[0].options?.rootMargin).toBe("-120px 0px -50% 0px");
  });

  it("reports the first intersecting id in list order and keeps the last one when none intersects", () => {
    installStub();
    const { result } = renderHook(() => useScrollSpy(IDS, { enabled: true, resolve }));
    expect(result.current).toBeNull();
    fire(observers[0], { lessons: true, review: true });
    expect(result.current).toBe("lessons");
    fire(observers[0], { lessons: false });
    expect(result.current).toBe("review");
    fire(observers[0], { review: false });
    expect(result.current).toBe("review");
    fire(observers[0], { basics: true });
    expect(result.current).toBe("basics");
  });

  it("does nothing while disabled and disconnects on unmount", () => {
    installStub();
    const { result, rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useScrollSpy(IDS, { enabled, resolve }),
      { initialProps: { enabled: false } },
    );
    expect(observers).toHaveLength(0);
    expect(result.current).toBeNull();
    rerender({ enabled: true });
    expect(observers).toHaveLength(1);
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });
});

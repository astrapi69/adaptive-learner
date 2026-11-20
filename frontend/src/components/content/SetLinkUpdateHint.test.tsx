/**
 * Tests for the "this app is out of date" hint on the set link's not-found
 * state: an old app build does not know newer ways to resolve a set, so a
 * miss asks the update store before the learner is sent away.
 */

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UpdateState, UpdateStore } from "@astrapi69/pwa-update";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveStorageMode } = vi.hoisted(() => ({
  resolveStorageMode: vi.fn(() => "dexie"),
}));
vi.mock("../../storage", () => ({ resolveStorageMode }));
vi.mock("../../lib/pwa/update-store", () => ({ appUpdateStore: {} }));
vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

import SetLinkUpdateHint from "./SetLinkUpdateHint";

const IDLE: UpdateState = {
  phase: "idle",
  updateAvailable: false,
  latestVersion: null,
  latestHash: null,
  dismissed: false,
  lastCheckedAt: null,
  needsFullRestart: false,
};

/** A store whose explicit check resolves to ``afterCheck``. */
function makeStore(afterCheck: Partial<UpdateState> | Error) {
  let state = IDLE;
  const listeners = new Set<() => void>();
  const checkNow = vi.fn(async () => {
    if (afterCheck instanceof Error) throw afterCheck;
    state = { ...state, phase: "current", ...afterCheck };
    listeners.forEach((listener) => listener());
  });
  const apply = vi.fn();
  const store = {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    checkNow,
    apply,
  } as unknown as UpdateStore;
  return { store, checkNow, apply };
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

describe("SetLinkUpdateHint", () => {
  beforeEach(() => {
    resolveStorageMode.mockReturnValue("dexie");
    setOnline(true);
  });
  afterEach(() => setOnline(true));

  it("offers the update when the check finds a newer build, and applies it on click", async () => {
    const { store, checkNow, apply } = makeStore({ phase: "available", updateAvailable: true });
    render(<SetLinkUpdateHint store={store} />);

    const hint = await screen.findByTestId("set-link-update-hint");
    expect(checkNow).toHaveBeenCalledTimes(1);
    expect(hint).toHaveTextContent("A new version is available.");
    expect(screen.queryByTestId("set-link-update-restart")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("set-link-update-apply"));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("shows an update the store already knows, even when its banner was dismissed", async () => {
    const { store } = makeStore({ updateAvailable: true, dismissed: true });
    render(<SetLinkUpdateHint store={store} />);
    expect(await screen.findByTestId("set-link-update-apply")).toBeInTheDocument();
  });

  it("names the full restart where the runtime needs one", async () => {
    const { store } = makeStore({ updateAvailable: true, needsFullRestart: true });
    render(<SetLinkUpdateHint store={store} />);
    expect(await screen.findByTestId("set-link-update-restart")).toBeInTheDocument();
  });

  it.each([
    ["the build is current", { updateAvailable: false }],
    ["the check fails", { phase: "error" as const, updateAvailable: false }],
    ["the check throws", new Error("no network")],
  ])("renders nothing when %s", async (_name, afterCheck) => {
    const { store, checkNow } = makeStore(afterCheck);
    render(<SetLinkUpdateHint store={store} />);
    await waitFor(() => expect(checkNow).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByTestId("set-link-update-hint")).not.toBeInTheDocument();
  });

  it.each([
    ["in API mode (no service worker)", "api", true],
    ["offline", "dexie", false],
  ])("does not check %s", async (_name, mode, online) => {
    resolveStorageMode.mockReturnValue(mode);
    setOnline(online);
    const { store, checkNow } = makeStore({ updateAvailable: true });
    render(<SetLinkUpdateHint store={store} />);
    await act(async () => {});
    expect(checkNow).not.toHaveBeenCalled();
    expect(screen.queryByTestId("set-link-update-hint")).not.toBeInTheDocument();
  });
});

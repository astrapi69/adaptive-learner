/**
 * Tests for the active "check for updates" control in Settings → About
 * (#664), now backed by the shared update store (#1374).
 *
 * The reliable-check + activation primitives are stubbed (covered in
 * sw-update.test.ts); the store integration drives the component so the
 * one-click flow and the passive "already waiting" case are pinned end to end.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { checkForUpdateReliable, activateInBackground } = vi.hoisted(() => ({
  checkForUpdateReliable: vi.fn(),
  activateInBackground: vi.fn(),
}));
vi.mock("../../lib/pwa/sw-update", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/pwa/sw-update")>();
  return { ...actual, checkForUpdateReliable, activateInBackground };
});

vi.mock("../../hooks/system/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
  }),
}));

import UpdateCheckControl from "./UpdateCheckControl";
import { resetUpdateStore } from "../../lib/pwa/updateStore";

/** Passive init: fetch fails by default so no update is flagged on mount. */
function stubNoNetwork() {
  globalThis.fetch = vi.fn(async () => {
    throw new Error("no network");
  }) as unknown as typeof fetch;
}

afterEach(() => {
  resetUpdateStore();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("UpdateCheckControl", () => {
  it("renders the check button (idle) and 'never checked' (#664)", () => {
    stubNoNetwork();
    render(<UpdateCheckControl />);
    expect(screen.getByTestId("update-check-button")).toHaveTextContent(
      "Check for updates",
    );
    expect(screen.getByTestId("update-check-last")).toHaveTextContent(
      "Never checked",
    );
  });

  it("shows a spinner + 'Checking…' while the check is in flight", async () => {
    stubNoNetwork();
    let resolve!: (v: { status: string; latestVersion: string | null }) => void;
    checkForUpdateReliable.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<UpdateCheckControl />);
    fireEvent.click(screen.getByTestId("update-check-button"));
    await waitFor(() =>
      expect(screen.getByTestId("update-check-button")).toHaveTextContent(
        "Checking…",
      ),
    );
    expect(screen.getByTestId("update-check-button")).toBeDisabled();
    resolve({ status: "current", latestVersion: "1.85.0" });
  });

  it("blocks a double-click while checking (single reliable check, #1374)", async () => {
    stubNoNetwork();
    checkForUpdateReliable.mockReturnValue(new Promise(() => {}));
    render(<UpdateCheckControl />);
    const button = screen.getByTestId("update-check-button");
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    // A second click on the now-disabled button must not fire another check.
    fireEvent.click(button);
    expect(checkForUpdateReliable).toHaveBeenCalledTimes(1);
  });

  it("reports the latest version when current (one click, happy path)", async () => {
    stubNoNetwork();
    checkForUpdateReliable.mockResolvedValue({
      status: "current",
      latestVersion: "1.85.0",
    });
    render(<UpdateCheckControl />);
    fireEvent.click(screen.getByTestId("update-check-button"));
    await waitFor(() =>
      expect(screen.getByTestId("update-check-status")).toHaveAttribute(
        "data-status",
        "current",
      ),
    );
    expect(screen.getByTestId("update-check-status")).toHaveTextContent(
      "You're using the latest version.",
    );
    expect(screen.getByTestId("update-check-last")).toHaveTextContent(
      "Last checked:",
    );
    // One pass — no second click needed.
    expect(checkForUpdateReliable).toHaveBeenCalledTimes(1);
  });

  it("offers the named update when a newer version is available (one click)", async () => {
    stubNoNetwork();
    checkForUpdateReliable.mockResolvedValue({
      status: "available",
      latestVersion: "1.86.0",
    });
    render(<UpdateCheckControl />);
    fireEvent.click(screen.getByTestId("update-check-button"));
    await screen.findByTestId("update-check-apply");
    expect(screen.getByTestId("update-check-status")).toHaveTextContent(
      "Version 1.86.0 is available!",
    );
  });

  it("shows the Update action WITHOUT a click when one was already waiting (#1374)", async () => {
    // A passive detection (version.json newer) flags an update before the user
    // opens About — the control must offer "Update now" immediately.
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: "999.0.0", buildHash: "z" }),
    })) as unknown as typeof fetch;
    render(<UpdateCheckControl />);
    await screen.findByTestId("update-check-apply");
    expect(screen.getByTestId("update-check-status")).toHaveAttribute(
      "data-status",
      "available",
    );
  });

  it("applies the update and clears the control (skip-waiting + reload, #1374)", async () => {
    stubNoNetwork();
    checkForUpdateReliable.mockResolvedValue({
      status: "available",
      latestVersion: "1.86.0",
    });
    render(<UpdateCheckControl />);
    fireEvent.click(screen.getByTestId("update-check-button"));
    const apply = await screen.findByTestId("update-check-apply");
    fireEvent.click(apply);
    expect(activateInBackground).toHaveBeenCalledOnce();
    // The apply CTA is cleared (store reset updateAvailable → check button back).
    await waitFor(() =>
      expect(screen.getByTestId("update-check-button")).toBeInTheDocument(),
    );
  });

  it("shows the honest 'preparing' state — never 'up to date' — when the new build's SW is not ready yet (#1382)", async () => {
    stubNoNetwork();
    checkForUpdateReliable.mockResolvedValue({
      status: "preparing",
      latestVersion: "1.99.0",
      latestHash: "bbb2222",
    });
    render(<UpdateCheckControl />);
    fireEvent.click(screen.getByTestId("update-check-button"));
    await waitFor(() =>
      expect(screen.getByTestId("update-check-status")).toHaveAttribute(
        "data-status",
        "preparing",
      ),
    );
    // Honest wording, no dead apply CTA, and the check button stays one
    // click away ("gleich erneut pruefen").
    expect(screen.getByTestId("update-check-status")).toHaveTextContent(
      /being prepared/i,
    );
    expect(screen.queryByTestId("update-check-apply")).toBeNull();
    expect(screen.getByTestId("update-check-button")).toBeEnabled();
  });

  it("shows a friendly error when the check fails (offline/timeout)", async () => {
    stubNoNetwork();
    checkForUpdateReliable.mockResolvedValue({
      status: "error",
      latestVersion: null,
    });
    render(<UpdateCheckControl />);
    fireEvent.click(screen.getByTestId("update-check-button"));
    await waitFor(() =>
      expect(screen.getByTestId("update-check-status")).toHaveAttribute(
        "data-status",
        "error",
      ),
    );
    expect(screen.getByTestId("update-check-status")).toHaveTextContent(
      "Check failed. Are you online?",
    );
    // Recoverable: the check button is back so the user can retry.
    expect(screen.getByTestId("update-check-button")).toBeEnabled();
  });
});

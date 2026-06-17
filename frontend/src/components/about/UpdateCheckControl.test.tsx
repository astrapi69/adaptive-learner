/**
 * Tests for the active "check for updates" control in Settings → About
 * (#664). The SW/version primitives are mocked so the component's state
 * machine (idle → checking → available/current/error) is exercised in
 * isolation; the primitives themselves are covered in sw-update.test.ts.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import UpdateCheckControl from "./UpdateCheckControl";

const checkForUpdate = vi.fn();
const activateAndReload = vi.fn();

vi.mock("../../lib/pwa/sw-update", () => ({
  checkForUpdate: (...args: unknown[]) => checkForUpdate(...args),
  activateAndReload: (...args: unknown[]) => activateAndReload(...args),
}));

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("UpdateCheckControl", () => {
  it("renders the check button (idle) and 'never checked' (#664)", () => {
    render(<UpdateCheckControl />);
    expect(screen.getByTestId("update-check-button")).toHaveTextContent(
      "Check for updates",
    );
    expect(screen.getByTestId("update-check-last")).toHaveTextContent(
      "Never checked",
    );
  });

  it("shows a spinner + 'Checking…' while the check is in flight", async () => {
    let resolve!: (v: { status: string; latestVersion: string | null }) => void;
    checkForUpdate.mockReturnValue(
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

  it("reports the latest version when current (happy path)", async () => {
    checkForUpdate.mockResolvedValue({
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
    // The last-check timestamp moved off "never".
    expect(screen.getByTestId("update-check-last")).toHaveTextContent(
      "Last checked:",
    );
  });

  it("offers the named update when a newer version is available", async () => {
    checkForUpdate.mockResolvedValue({
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

  it("applies the update (skip-waiting + reload) on 'Update now'", async () => {
    checkForUpdate.mockResolvedValue({
      status: "available",
      latestVersion: "1.86.0",
    });
    render(<UpdateCheckControl />);
    fireEvent.click(screen.getByTestId("update-check-button"));
    const apply = await screen.findByTestId("update-check-apply");
    fireEvent.click(apply);
    expect(activateAndReload).toHaveBeenCalledOnce();
  });

  // Edge case: offline / failed fetch must show a friendly message, not crash.
  it("shows a friendly error when the check fails (offline)", async () => {
    checkForUpdate.mockResolvedValue({ status: "error", latestVersion: null });
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

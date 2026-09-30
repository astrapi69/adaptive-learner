/**
 * S4 (PWA hardening) tests for the offline cache management section.
 *
 * Mocks the cache-info lib so the component can be driven without a real
 * Cache Storage: asserts the size/count summary renders, the empty state
 * shows, and the two-step clear flow calls clearLessonCache + refreshes.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CacheManagementSection from "./CacheManagementSection";
import * as cacheInfo from "../../../lib/pwa/cache-info";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("react-toastify", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CacheManagementSection", () => {
  it("renders the size + lesson count summary", async () => {
    vi.spyOn(cacheInfo, "getCacheInfo").mockResolvedValue({
      bytes: 1.5 * 1024 * 1024,
      lessonCount: 7,
    });
    render(<CacheManagementSection />);
    await waitFor(() =>
      expect(screen.getByTestId("cache-summary")).toHaveTextContent(
        "1.5 MB · 7 lessons cached",
      ),
    );
  });

  it("shows the empty state and disables clear when nothing is cached", async () => {
    vi.spyOn(cacheInfo, "getCacheInfo").mockResolvedValue({
      bytes: 0,
      lessonCount: 0,
    });
    render(<CacheManagementSection />);
    await waitFor(() =>
      expect(screen.getByTestId("cache-summary")).toHaveTextContent(
        "No offline content cached yet.",
      ),
    );
    expect(screen.getByTestId("cache-clear-button")).toBeDisabled();
  });

  it("clears the cache through the two-step confirm", async () => {
    vi.spyOn(cacheInfo, "getCacheInfo").mockResolvedValue({
      bytes: 2 * 1024 * 1024,
      lessonCount: 3,
    });
    const clearSpy = vi
      .spyOn(cacheInfo, "clearLessonCache")
      .mockResolvedValue();

    render(<CacheManagementSection />);
    await waitFor(() =>
      expect(screen.getByTestId("cache-clear-button")).toBeEnabled(),
    );

    act(() => {
      screen.getByTestId("cache-clear-button").click();
    });
    // Confirm pane shown.
    expect(screen.getByTestId("cache-clear-confirm")).toBeInTheDocument();

    await act(async () => {
      screen.getByTestId("cache-clear-confirm-button").click();
    });

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("tells the user when clearing fails, and claims no success (#3384)", async () => {
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.spyOn(cacheInfo, "getCacheInfo").mockResolvedValue({
      bytes: 2 * 1024 * 1024,
      lessonCount: 3,
    });
    vi.spyOn(cacheInfo, "clearLessonCache").mockRejectedValue(new Error("SecurityError"));
    render(<CacheManagementSection />);
    await waitFor(() => expect(screen.getByTestId("cache-clear-button")).toBeEnabled());
    act(() => {
      screen.getByTestId("cache-clear-button").click();
    });
    await act(async () => {
      screen.getByTestId("cache-clear-confirm-button").click();
    });
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(String(toastError.mock.calls[0][0])).toContain("SecurityError");
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

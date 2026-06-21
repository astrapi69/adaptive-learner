/**
 * Tests for the API-mode desktop auto-update host/banner (#840).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { I18nProvider } from "../../hooks/ui/useI18n";
import { resolveStorageMode } from "../../storage";
import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";
import * as updateChecker from "../../lib/utils/updateChecker";

vi.mock("../../storage", async (importActual) => ({
  ...(await importActual<typeof import("../../storage")>()),
  resolveStorageMode: vi.fn(),
}));
vi.mock("../../hooks/system/useOnlineStatus", () => ({ useOnlineStatus: vi.fn() }));

const mockMode = vi.mocked(resolveStorageMode);
const mockOnline = vi.mocked(useOnlineStatus);

async function renderHost() {
  const { default: DesktopUpdateHost } = await import("./DesktopUpdateHost");
  render(
    <I18nProvider>
      <DesktopUpdateHost />
    </I18nProvider>,
  );
}

const AVAILABLE: updateChecker.UpdateCheckResult = {
  status: "update-available",
  currentVersion: "1.89.0",
  latestVersion: "1.90.0",
  releaseUrl: "https://github.com/astrapi69/adaptive-learner/releases/tag/v1.90.0",
  releaseNotes: "## New\n- stuff",
};

beforeEach(() => {
  localStorage.clear();
  mockOnline.mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe("DesktopUpdateHost", () => {
  it("shows the banner in API mode when an update is available", async () => {
    mockMode.mockReturnValue("api");
    vi.spyOn(updateChecker, "checkForUpdate").mockResolvedValue(AVAILABLE);
    await renderHost();
    await waitFor(() =>
      expect(screen.getByTestId("desktop-update-banner")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("desktop-update-banner-release")).toHaveAttribute(
      "href",
      AVAILABLE.releaseUrl,
    );
  });

  it("does NOT check or show in Dexie mode", async () => {
    mockMode.mockReturnValue("dexie");
    const spy = vi.spyOn(updateChecker, "checkForUpdate");
    await renderHost();
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("desktop-update-banner")).not.toBeInTheDocument();
  });

  it("does not show a banner for a version the user dismissed", async () => {
    mockMode.mockReturnValue("api");
    localStorage.setItem(
      "adaptive-learner.updates",
      JSON.stringify({ dismissed_version: "1.90.0" }),
    );
    vi.spyOn(updateChecker, "checkForUpdate").mockResolvedValue(AVAILABLE);
    await renderHost();
    await waitFor(() =>
      expect(localStorage.getItem("adaptive-learner.updates")).toContain("last_check_at"),
    );
    expect(screen.queryByTestId("desktop-update-banner")).not.toBeInTheDocument();
  });

  it("re-notifies for a newer version than the dismissed one", async () => {
    mockMode.mockReturnValue("api");
    localStorage.setItem(
      "adaptive-learner.updates",
      JSON.stringify({ dismissed_version: "1.89.5" }),
    );
    vi.spyOn(updateChecker, "checkForUpdate").mockResolvedValue(AVAILABLE);
    await renderHost();
    await waitFor(() =>
      expect(screen.getByTestId("desktop-update-banner")).toBeInTheDocument(),
    );
  });

  it("opens the What's new modal", async () => {
    mockMode.mockReturnValue("api");
    vi.spyOn(updateChecker, "checkForUpdate").mockResolvedValue(AVAILABLE);
    await renderHost();
    const whatsNew = await screen.findByTestId("desktop-update-banner-whatsnew");
    whatsNew.click();
    await waitFor(() =>
      expect(screen.getByTestId("desktop-update-modal")).toBeInTheDocument(),
    );
  });
});

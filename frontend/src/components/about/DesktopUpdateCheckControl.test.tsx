/**
 * Tests for the API-mode desktop update-check control (#840).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import DesktopUpdateCheckControl from "./DesktopUpdateCheckControl";
import { I18nProvider } from "../../hooks/ui/useI18n";
import * as updateChecker from "../../lib/utils/updateChecker";

function renderControl() {
  render(
    <I18nProvider>
      <DesktopUpdateCheckControl />
    </I18nProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("DesktopUpdateCheckControl", () => {
  it("shows up-to-date after a check", async () => {
    vi.spyOn(updateChecker, "checkForUpdate").mockResolvedValue({
      status: "up-to-date",
      currentVersion: "1.89.0",
      latestVersion: "1.89.0",
    });
    renderControl();
    fireEvent.click(screen.getByTestId("desktop-update-button"));
    await waitFor(() =>
      expect(screen.getByTestId("desktop-update-status")).toHaveAttribute(
        "data-status",
        "up-to-date",
      ),
    );
  });

  it("shows an available update with a release link", async () => {
    vi.spyOn(updateChecker, "checkForUpdate").mockResolvedValue({
      status: "update-available",
      currentVersion: "1.89.0",
      latestVersion: "1.90.0",
      releaseUrl: "https://github.com/astrapi69/adaptive-learner/releases/tag/v1.90.0",
      releaseNotes: "## What's new\n- AI exercises",
    });
    renderControl();
    fireEvent.click(screen.getByTestId("desktop-update-button"));
    await waitFor(() =>
      expect(screen.getByTestId("desktop-update-status")).toHaveAttribute(
        "data-status",
        "update-available",
      ),
    );
    const link = screen.getByTestId("desktop-update-open").querySelector("a") ??
      screen.getByTestId("desktop-update-open");
    expect((link as HTMLAnchorElement).getAttribute("href")).toContain("/releases/tag/v1.90.0");
    expect(screen.getByTestId("release-notes")).toBeInTheDocument();
  });

  it("records last_check_at after a check", async () => {
    vi.spyOn(updateChecker, "checkForUpdate").mockResolvedValue({
      status: "up-to-date",
      currentVersion: "1.89.0",
    });
    renderControl();
    fireEvent.click(screen.getByTestId("desktop-update-button"));
    await waitFor(() =>
      expect(localStorage.getItem("adaptive-learner.updates")).toContain("last_check_at"),
    );
  });

  it("shows an error message when the check fails", async () => {
    vi.spyOn(updateChecker, "checkForUpdate").mockResolvedValue({
      status: "error",
      currentVersion: "1.89.0",
    });
    renderControl();
    fireEvent.click(screen.getByTestId("desktop-update-button"));
    await waitFor(() =>
      expect(screen.getByTestId("desktop-update-status")).toHaveAttribute(
        "data-status",
        "error",
      ),
    );
  });
});

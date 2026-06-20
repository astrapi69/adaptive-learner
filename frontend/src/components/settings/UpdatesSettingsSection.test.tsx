/**
 * Tests for the API-mode Updates settings section (#840).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import UpdatesSettingsSection from "./UpdatesSettingsSection";
import { I18nProvider } from "../../hooks/ui/useI18n";
import { readUpdatePrefs } from "../../lib/utils/updatePrefs";

function renderSection() {
  render(
    <I18nProvider>
      <UpdatesSettingsSection />
    </I18nProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("UpdatesSettingsSection", () => {
  it("renders the section with the current version", () => {
    renderSection();
    expect(screen.getByTestId("settings-section-updates")).toBeInTheDocument();
    expect(screen.getByTestId("update-current-version")).toBeInTheDocument();
  });

  it("persists the auto-check toggle and disables the interval when off", () => {
    renderSection();
    const toggle = screen.getByTestId("update-auto-check-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(readUpdatePrefs().auto_check).toBe(false);
    expect(screen.getByTestId("update-interval-select")).toBeDisabled();
  });

  it("persists the interval choice", () => {
    renderSection();
    fireEvent.change(screen.getByTestId("update-interval-select"), {
      target: { value: "weekly" },
    });
    expect(readUpdatePrefs().check_interval).toBe("weekly");
  });

  it("shows 'never checked' before any check", () => {
    renderSection();
    expect(screen.getByTestId("update-last-check")).toHaveTextContent(/never/i);
  });
});

/**
 * InstallAppSection — card container pin (#1017-follow-up).
 *
 * The install entry was moved into the General tab (#1455) but rendered on
 * a ``settings-subsection`` class that carries no card styling, so it
 * floated on the page background between its carded neighbours (storage
 * mode / updates above, mode indicator below). Pin that it renders inside
 * the same ``settings-section`` card as those neighbours, with the shared
 * ``settings-section-title`` heading, and that the behavioural testids are
 * preserved.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../../../hooks/ui/useI18n";

import InstallAppSection from "./InstallAppSection";

function renderSection() {
  return render(
    <I18nProvider>
      <InstallAppSection />
    </I18nProvider>,
  );
}

describe("InstallAppSection — card container", () => {
  it("renders inside a settings-section card", () => {
    renderSection();
    const section = screen.getByTestId("settings-install-section");
    expect(section.classList.contains("settings-section")).toBe(true);
  });

  it("uses the shared settings-section-title heading", () => {
    renderSection();
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.classList.contains("settings-section-title")).toBe(true);
  });

  it("preserves the section and install-button testids", () => {
    renderSection();
    expect(screen.getByTestId("settings-install-section")).toBeInTheDocument();
    expect(screen.getByTestId("settings-install-button")).toBeInTheDocument();
  });
});

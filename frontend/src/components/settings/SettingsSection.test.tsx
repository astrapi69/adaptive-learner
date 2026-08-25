import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SettingsSection } from "./SettingsSection";

describe("SettingsSection", () => {
  it("renders the card shell with title, testid, and children", () => {
    render(
      <SettingsSection title="Profile" testid="settings-section-profile">
        <p>body</p>
      </SettingsSection>,
    );

    const section = screen.getByTestId("settings-section-profile");
    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveClass("settings-section");
    expect(screen.getByRole("heading", { level: 2, name: "Profile" })).toHaveClass(
      "settings-section-title",
    );
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("omits the heading entirely when no title is given", () => {
    render(
      <SettingsSection testid="settings-section-no-title">
        <p>body</p>
      </SettingsSection>,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("merges extra className/style onto the section and title", () => {
    render(
      <SettingsSection
        title="Danger Zone"
        testid="settings-danger-zone"
        className="mt-8"
        style={{ borderColor: "var(--danger)" }}
        titleClassName="text-[var(--danger)]"
        titleStyle={{ color: "var(--danger)" }}
      >
        <p>body</p>
      </SettingsSection>,
    );

    const section = screen.getByTestId("settings-danger-zone");
    expect(section).toHaveClass("settings-section", "mt-8");
    expect(section.style.borderColor).toBe("var(--danger)");
    const heading = screen.getByRole("heading", { level: 2, name: "Danger Zone" });
    expect(heading).toHaveClass("settings-section-title", "text-[var(--danger)]");
    expect(heading.style.color).toBe("var(--danger)");
  });

  it("passes arbitrary section attributes through (aria-busy)", () => {
    render(
      <SettingsSection
        title="Content repositories"
        testid="content-repo-section"
        aria-busy="true"
      />,
    );

    expect(screen.getByTestId("content-repo-section")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("respects the hidden prop", () => {
    render(
      <SettingsSection title="Storage mode" testid="settings-storage-mode" hidden>
        <p>body</p>
      </SettingsSection>,
    );

    expect(screen.getByTestId("settings-storage-mode")).not.toBeVisible();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SettingsSection } from "./SettingsSection";
import { SettingsCluster } from "./SettingsCluster";

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
    // #2961 - clears the Learning tab's sticky section bar on scrollIntoView.
    expect(section).toHaveClass("scroll-mt-[var(--settings-anchor-offset,0px)]");
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

  // #2966 - cards inside a cluster sit under the cluster's <h2>, so their
  // own title steps down to <h3>: explicitly via the prop, or implicitly
  // through the cluster's heading-level context. The class contract is
  // unchanged whatever the level.
  it("renders an h3 title when headingLevel is 3", () => {
    render(
      <SettingsSection title="Hints" testid="settings-section-hints" headingLevel={3}>
        <p>body</p>
      </SettingsSection>,
    );
    const heading = screen.getByRole("heading", { level: 3, name: "Hints" });
    expect(heading).toHaveClass("settings-section-title");
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("steps down to h3 inside a SettingsCluster, h2 outside (#2966)", () => {
    render(
      <>
        <SettingsSection title="Outside" testid="settings-section-outside" />
        <SettingsCluster id="lessons" testid="settings-cluster-lessons" title="In the lesson">
          <SettingsSection title="Inside" testid="settings-section-inside" />
          <SettingsSection title="Forced" testid="settings-section-forced" headingLevel={2} />
        </SettingsCluster>
      </>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Outside" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "In the lesson" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Inside" })).toHaveClass(
      "settings-section-title",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Forced" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Outside" })).not.toBeInTheDocument();
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

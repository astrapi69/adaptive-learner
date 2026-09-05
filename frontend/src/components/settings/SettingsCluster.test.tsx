import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { SettingsCluster } from "./SettingsCluster";

describe("SettingsCluster (#2956)", () => {
  it("renders a section landmark with the group heading, testid and anchor id", () => {
    render(
      <SettingsCluster id="review" testid="settings-cluster-review" title="After the lesson">
        <p>card</p>
      </SettingsCluster>,
    );

    const cluster = screen.getByTestId("settings-cluster-review");
    expect(cluster.tagName).toBe("SECTION");
    expect(cluster).toHaveAttribute("id", "learning-review");
    const heading = screen.getByRole("heading", { level: 2, name: "After the lesson" });
    expect(heading).toHaveClass("uppercase", "tracking-wide", "text-fg-secondary");
  });

  it("labels the section by its heading (aria-labelledby wiring)", () => {
    render(
      <SettingsCluster id="basics" testid="settings-cluster-basics" title="Basics">
        <p>card</p>
      </SettingsCluster>,
    );

    const cluster = screen.getByTestId("settings-cluster-basics");
    const heading = within(cluster).getByRole("heading", { level: 2 });
    expect(heading.id).not.toBe("");
    expect(cluster).toHaveAttribute("aria-labelledby", heading.id);
    expect(cluster).toHaveAccessibleName("Basics");
  });

  it("renders the description when given", () => {
    render(
      <SettingsCluster
        id="voice"
        testid="settings-cluster-voice"
        title="Reading aloud and dictation"
        description="Voices, speed, microphone and pronunciation practice."
      >
        <p>card</p>
      </SettingsCluster>,
    );

    expect(
      screen.getByText("Voices, speed, microphone and pronunciation practice."),
    ).toHaveClass("text-fg-muted");
  });

  it("omits the description paragraph when none is given", () => {
    render(
      <SettingsCluster id="voice" testid="settings-cluster-voice" title="Reading aloud and dictation">
        <p>card</p>
      </SettingsCluster>,
    );

    const cluster = screen.getByTestId("settings-cluster-voice");
    expect(cluster.querySelector("p.text-fg-muted")).toBeNull();
  });

  it("renders its children inside the section, after the heading, in order", () => {
    render(
      <SettingsCluster id="lessons" testid="settings-cluster-lessons" title="In the lesson">
        <div data-testid="card-a">A</div>
        <div data-testid="card-b">B</div>
      </SettingsCluster>,
    );

    const cluster = screen.getByTestId("settings-cluster-lessons");
    const cardA = within(cluster).getByTestId("card-a");
    const cardB = within(cluster).getByTestId("card-b");
    const heading = within(cluster).getByRole("heading", { level: 2 });
    expect(
      heading.compareDocumentPosition(cardA) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      cardA.compareDocumentPosition(cardB) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("gives two clusters on one page distinct heading ids", () => {
    render(
      <>
        <SettingsCluster id="basics" testid="settings-cluster-basics" title="Basics">
          <p>card</p>
        </SettingsCluster>
        <SettingsCluster id="lessons" testid="settings-cluster-lessons" title="In the lesson">
          <p>card</p>
        </SettingsCluster>
      </>,
    );

    const ids = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.id);
    expect(new Set(ids).size).toBe(2);
  });
});

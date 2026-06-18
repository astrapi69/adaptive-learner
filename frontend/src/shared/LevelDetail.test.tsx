import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LevelDetail from "./LevelDetail";

describe("LevelDetail", () => {
  it("renders the level and the to-next label", () => {
    render(
      <LevelDetail
        level={4}
        xpIntoLevel={200}
        xpToNext={300}
        levelLabel="Level"
        toNextLabel="300 XP to next level"
      />,
    );
    expect(screen.getByTestId("level-detail")).toHaveTextContent("Level 4");
    expect(screen.getByTestId("level-detail-tonext")).toHaveTextContent(
      "300 XP to next level",
    );
  });

  it("computes the progress percentage from xpIntoLevel / span", () => {
    render(
      <LevelDetail
        level={4}
        xpIntoLevel={200}
        xpToNext={300}
        levelLabel="Level"
        toNextLabel="300 XP to next level"
      />,
    );
    expect(screen.getByTestId("level-detail-bar")).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
  });

  it("shows 100% at max level (xpToNext = 0)", () => {
    render(
      <LevelDetail
        level={25}
        xpIntoLevel={0}
        xpToNext={0}
        levelLabel="Level"
        toNextLabel="Max level reached"
      />,
    );
    expect(screen.getByTestId("level-detail-bar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });
});

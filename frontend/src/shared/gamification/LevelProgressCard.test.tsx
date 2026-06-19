/**
 * #727 — LevelProgressCard: composes the #730 LevelDetail block with the
 * 7-day activity chart + milestone ladder.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LevelProgressCard, {
  type LevelProgressLabels,
} from "./LevelProgressCard";

const LABELS: LevelProgressLabels = {
  activityTitle: "Activity (last 7 days)",
  activityUnit: "sessions",
  activityEmpty: "No activity in the last 7 days.",
  milestonesTitle: "Milestones",
  milestoneLevel: "Level {level}",
  milestoneXp: "{xp} XP",
  reached: "reached",
  locked: "locked",
  howItWorks: "Levels rise…",
};

const MILESTONES = [
  { level: 1, xp: 0, reached: true },
  { level: 2, xp: 100, reached: true },
  { level: 3, xp: 300, reached: true },
  { level: 4, xp: 600, reached: false },
];

function renderCard(history: { date: string; count: number }[] = []) {
  return render(
    <LevelProgressCard
      level={3}
      xpIntoLevel={275}
      xpToNext={25}
      levelLabel="Level"
      toNextLabel="25 XP to next level"
      history={history}
      milestones={MILESTONES}
      labels={LABELS}
    />,
  );
}

describe("LevelProgressCard (#727)", () => {
  it("reuses the LevelDetail progress block", () => {
    renderCard();
    // round(275 / (275+25) * 100) = 92.
    expect(screen.getByTestId("level-detail-bar")).toHaveAttribute(
      "aria-valuenow",
      "92",
    );
    expect(screen.getByTestId("level-detail-tonext").textContent).toContain(
      "25",
    );
  });

  it("renders the milestone ladder with the current level marked", () => {
    renderCard();
    const current = screen.getByTestId("level-detail-milestone-3");
    expect(current).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByTestId("level-detail-milestone-2").textContent,
    ).toContain("100 XP");
    expect(screen.getByTestId("level-detail-how")).toBeInTheDocument();
  });

  it("shows the empty state when there was no activity", () => {
    renderCard([
      { date: "2026-06-10", count: 0 },
      { date: "2026-06-11", count: 0 },
    ]);
    expect(
      screen.getByTestId("level-detail-history-empty"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("level-detail-history")).not.toBeInTheDocument();
  });

  it("renders a bar per day when there is activity", () => {
    renderCard([
      { date: "2026-06-10", count: 2 },
      { date: "2026-06-11", count: 1 },
      { date: "2026-06-12", count: 0 },
    ]);
    expect(screen.getAllByTestId("level-detail-history-bar")).toHaveLength(3);
  });
});

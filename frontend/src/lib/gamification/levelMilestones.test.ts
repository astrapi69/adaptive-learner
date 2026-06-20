/**
 * #727 — level-milestone ladder.
 */

import { describe, it, expect } from "vitest";

import { buildLevelMilestones } from "./levelMilestones";
import { levelThreshold } from "../../storage/gamification/gamification";

describe("buildLevelMilestones", () => {
  it("matches the documented thresholds (0/100/300/600/1000)", () => {
    expect(levelThreshold(1)).toBe(0);
    expect(levelThreshold(2)).toBe(100);
    expect(levelThreshold(3)).toBe(300);
    expect(levelThreshold(5)).toBe(1000);
  });

  it("lists levels 1..level+lookahead with reached state", () => {
    const ms = buildLevelMilestones(3, 575);
    expect(ms.map((m) => m.level)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ms.find((m) => m.level === 3)?.reached).toBe(true); // 300 <= 575
    expect(ms.find((m) => m.level === 4)?.reached).toBe(false); // 600 > 575
    expect(ms.find((m) => m.level === 2)?.xp).toBe(100);
  });

  it("does not break at high levels / XP (Level 99, 99999 XP)", () => {
    const ms = buildLevelMilestones(99, 99999);
    expect(ms[ms.length - 1].level).toBe(102);
    expect(ms.every((m) => (m.xp <= 99999 ? m.reached : true))).toBe(true);
  });
});

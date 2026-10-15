/**
 * The summary's time is the run just finished (#3747), not the lifetime
 * total across restarts: a restarted lesson reported 35 or 134 minutes
 * for a run of a few.
 */

import { describe, expect, it } from "vitest";

import type { LessonProgress } from "../../../storage/types";
import { deriveSummaryStats } from "./summary-view";

function progress(extra: Partial<LessonProgress>): LessonProgress {
  return {
    id: "p",
    user_id: "u",
    source: "s",
    set_id: "set",
    lesson_filename: "01.json",
    status: "completed",
    step_results: {},
    score_correct: 10,
    score_total: 10,
    time_spent_seconds: 0,
    started_at: "2026-10-15T00:00:00Z",
    updated_at: "2026-10-15T00:00:00Z",
    completed_at: null,
    paused_at: null,
    abandoned_at: null,
    ...extra,
  } as LessonProgress;
}

describe("deriveSummaryStats minutes (#3747)", () => {
  it.each([
    ["restarted run: the run, not the lifetime", 2100 + 180, 180, 3],
    ["first run: both agree", 300, 300, 5],
    ["under a minute floors at one", 8040, 20, 1],
    ["no run time yet floors at one", 600, 0, 1],
  ])("%s", (_name, lifetime, run, minutes) => {
    const stats = deriveSummaryStats(
      progress({ time_spent_seconds: lifetime, run_time_seconds: run }),
    );
    expect(stats.minutes).toBe(minutes);
  });

  it("no progress row floors at one", () => {
    expect(deriveSummaryStats(null).minutes).toBe(1);
  });
});

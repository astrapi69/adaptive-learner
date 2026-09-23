/**
 * LessonRunner placeholder (EXP-052 slice 0, refs #3169).
 *
 * Slice 0 ships the shell's frame only: the ``<main>`` every runner
 * will render through, with the policy's testid prefix and the #959
 * scroll anchor id. Nothing is composed yet (no status view, no
 * footer, no summary); slices 1 to 4 fill the frame one page at a
 * time. These pins hold the frame contract until then.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonRunner from "./LessonRunner";
import { RUNNER_POLICIES } from "./policies";
import type { RunnerSource } from "./types";

const SOURCE: RunnerSource = {
  status: "ready",
  error: null,
  title: "Test",
  step: null,
  cards: [],
  lessonId: "l1",
  position: { index: 0, total: 1 },
  isSummary: false,
  goNext: () => {},
  recordStepAttempts: async () => {},
};

describe("LessonRunner placeholder", () => {
  it.each(Object.entries(RUNNER_POLICIES))(
    "%s renders main#main.lesson-page with the prefixed page testid",
    (prefix, policy) => {
      render(<LessonRunner source={SOURCE} policy={policy} summary={() => null} />);
      const main = screen.getByTestId(`${prefix}-page`);
      expect(main.tagName).toBe("MAIN");
      expect(main).toHaveAttribute("id", "main");
      expect(main.className).toContain("lesson-page");
    },
  );

  it("composes nothing yet: the frame is empty", () => {
    render(<LessonRunner source={SOURCE} policy={RUNNER_POLICIES.review} summary={() => null} />);
    expect(screen.getByTestId("review-page").childElementCount).toBe(0);
  });

  it("does not invoke the summary or headerExtra render props yet", () => {
    const summary = vi.fn(() => null);
    const headerExtra = vi.fn(() => null);
    render(
      <LessonRunner
        source={{ ...SOURCE, isSummary: true }}
        policy={RUNNER_POLICIES.endless}
        summary={summary}
        headerExtra={headerExtra}
      />,
    );
    expect(summary).not.toHaveBeenCalled();
    expect(headerExtra).not.toHaveBeenCalled();
  });

  it("accepts a stream source without a position (Endless)", () => {
    render(
      <LessonRunner
        source={{ ...SOURCE, position: null }}
        policy={RUNNER_POLICIES.endless}
        summary={() => null}
      />,
    );
    expect(screen.getByTestId("endless-page")).toBeInTheDocument();
  });
});

/**
 * RunnerProgress (EXP-052 slice 1, refs #3169).
 *
 * The one progress bar of the shell: the percent is computed ONCE here
 * from the source position (the four inline copies go away slice by
 * slice), the label reads "Step n of m" / "Summary", the testid carries
 * the runner prefix.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RunnerProgress from "./RunnerProgress";

describe("RunnerProgress", () => {
  it.each([
    ["first step", { index: 0, total: 4 }, false, "0", "Step 1 of 4"],
    ["mid run", { index: 1, total: 4 }, false, "25", "Step 2 of 4"],
    ["last step", { index: 3, total: 4 }, false, "75", "Step 4 of 4"],
    ["summary", { index: 4, total: 4 }, true, "100", "Summary"],
    ["boundary: empty run", { index: 0, total: 0 }, true, "100", "Summary"],
  ])("%s: percent and label", (_name, position, isSummary, pct, label) => {
    render(<RunnerProgress testIdPrefix="review" position={position} isSummary={isSummary} />);
    const bar = screen.getByTestId("review-progress-bar");
    expect(bar).toHaveAttribute("aria-valuenow", pct);
    expect(bar).toHaveTextContent(label);
  });

  it("carries the runner prefix in the testid", () => {
    render(
      <RunnerProgress testIdPrefix="shuffle" position={{ index: 0, total: 2 }} isSummary={false} />,
    );
    expect(screen.getByTestId("shuffle-progress-bar")).toBeInTheDocument();
  });

  it("edge: a stream source without a position renders no bar", () => {
    const { container } = render(
      <RunnerProgress testIdPrefix="endless" position={null} isSummary={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("edge: a stream source on its summary renders no stat line (the recap carries the numbers)", () => {
    const { container } = render(
      <RunnerProgress
        testIdPrefix="endless"
        i18nNamespace="endless"
        position={null}
        isSummary
        tallies={{ correct: 2, total: 3, stats: STATS, elapsedSec: 5 }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// EXP-052 slice 2, Befund 2: the Endless stat line is pure display in the
// progress slot. No new policy column: the variant follows from the source
// shape (a stream has no position, so its progress IS the running tally).
const STATS = { cards: 45, correct: 38, reviewsDone: 3, newLearned: 2, errorsPracticed: 4, xp: 38 };

describe("RunnerProgress - stream stat line (Endless)", () => {
  function renderStream(stats: typeof STATS, elapsedSec: number) {
    return render(
      <RunnerProgress
        testIdPrefix="endless"
        i18nNamespace="endless"
        position={null}
        isSummary={false}
        tallies={{ correct: stats.correct, total: stats.cards, stats, elapsedSec }}
      />,
    );
  }

  it("reproduction + happy path: time, cards and hit rate under the kept endless-stat-line testid", () => {
    renderStream(STATS, 754);
    const line = screen.getByTestId("endless-stat-line");
    expect(line).toHaveTextContent("12:34");
    expect(line).toHaveTextContent("45 cards");
    expect(line).toHaveTextContent("38 correct (84%)");
    expect(screen.queryByTestId("endless-progress-bar")).toBeNull();
  });

  it("is pure display: no pause and no end control lives in the stat line any more", () => {
    renderStream(STATS, 0);
    expect(screen.queryByTestId("endless-pause")).toBeNull();
    expect(screen.queryByTestId("endless-end")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("boundary: before the first card the hit rate reads 0% and the clock 0:00", () => {
    renderStream({ ...STATS, cards: 0, correct: 0 }, 0);
    const line = screen.getByTestId("endless-stat-line");
    expect(line).toHaveTextContent("0:00");
    expect(line).toHaveTextContent("0 cards");
    expect(line).toHaveTextContent("0 correct (0%)");
  });
});

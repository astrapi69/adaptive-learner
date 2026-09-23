/**
 * RunnerProgress (EXP-052 slice 1, refs #3169).
 *
 * The one progress bar of the shell: the percent is computed ONCE here
 * from the source position (the four inline copies go away slice by
 * slice), the label reads "Step n of m" / "Summary", the testid carries
 * the runner prefix.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import RunnerProgress from "./RunnerProgress";

describe("RunnerProgress", () => {
  it.each([
    ["first step", {index: 0, total: 4}, false, "0", "Step 1 of 4"],
    ["mid run", {index: 1, total: 4}, false, "25", "Step 2 of 4"],
    ["last step", {index: 3, total: 4}, false, "75", "Step 4 of 4"],
    ["summary", {index: 4, total: 4}, true, "100", "Summary"],
    ["boundary: empty run", {index: 0, total: 0}, true, "100", "Summary"],
  ])("%s: percent and label", (_name, position, isSummary, pct, label) => {
    render(<RunnerProgress testIdPrefix="review" position={position} isSummary={isSummary} />);
    const bar = screen.getByTestId("review-progress-bar");
    expect(bar).toHaveAttribute("aria-valuenow", pct);
    expect(bar).toHaveTextContent(label);
  });

  it("carries the runner prefix in the testid", () => {
    render(<RunnerProgress testIdPrefix="shuffle" position={{index: 0, total: 2}} isSummary={false} />);
    expect(screen.getByTestId("shuffle-progress-bar")).toBeInTheDocument();
  });

  it("edge: a stream source without a position renders no bar", () => {
    const {container} = render(
      <RunnerProgress testIdPrefix="endless" position={null} isSummary={false} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

/**
 * XpBadge render tests (#505).
 *
 * Pins the presentational contract of the generic badge: the
 * icon / level / total / gain segments each render only when their
 * value is supplied, the gain pill hides for zero / negative
 * amounts, and labels + testids are caller-driven.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import XpBadge from "./XpBadge";

describe("XpBadge", () => {
  it("renders icon, level and total when all are supplied", () => {
    render(
      <XpBadge
        xp={1200}
        level={4}
        icon={<svg data-testid="xp-icon" />}
        xpLabel="XP"
        levelLabel="Level"
        testId="badge"
        levelTestId="badge-level"
        xpTestId="badge-total"
      />,
    );
    expect(screen.getByTestId("badge")).toBeInTheDocument();
    expect(screen.getByTestId("xp-icon")).toBeInTheDocument();
    expect(screen.getByTestId("badge-level").textContent).toBe("Level 4");
    expect(screen.getByTestId("badge-total").textContent).toBe("1200 XP");
  });

  it("omits the total segment when xp is undefined (gain-only pill)", () => {
    render(
      <XpBadge
        gain={80}
        xpLabel="XP"
        testId="badge"
        xpTestId="badge-total"
        gainTestId="badge-gain"
      />,
    );
    expect(screen.queryByTestId("badge-total")).toBeNull();
    expect(screen.getByTestId("badge-gain").textContent).toBe("+80 XP");
  });

  it("hides the level segment when level is undefined", () => {
    render(<XpBadge xp={50} levelTestId="badge-level" />);
    expect(screen.queryByTestId("badge-level")).toBeNull();
  });

  it("hides the gain pill for zero or negative gain", () => {
    const { rerender } = render(
      <XpBadge xp={10} gain={0} gainTestId="badge-gain" />,
    );
    expect(screen.queryByTestId("badge-gain")).toBeNull();
    rerender(<XpBadge xp={10} gain={-5} gainTestId="badge-gain" />);
    expect(screen.queryByTestId("badge-gain")).toBeNull();
  });

  it("applies the supplied aria-label to the root", () => {
    render(<XpBadge xp={300} ariaLabel="Level 2, 300 total XP" testId="badge" />);
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "aria-label",
      "Level 2, 300 total XP",
    );
  });

  it("falls back to the default XP / Level labels", () => {
    render(<XpBadge xp={5} level={1} levelTestId="lvl" xpTestId="tot" />);
    expect(screen.getByTestId("lvl").textContent).toBe("Level 1");
    expect(screen.getByTestId("tot").textContent).toBe("5 XP");
  });
});

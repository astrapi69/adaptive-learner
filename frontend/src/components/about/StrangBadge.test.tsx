/**
 * Tests for StrangBadge (#1172) — the About-tab strand indicator. Drives
 * the badge with an injected BuildInfo (so it doesn't depend on the build
 * literals) and pins: Latest shows the test warning + branch + hash;
 * Haupt shows no warning; unknown renders without crashing.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BuildInfo } from "../../lib/provenance/build-info";
import StrangBadge from "./StrangBadge";

const t = (_k: string, fallback?: string) => fallback ?? _k;

function info(overrides: Partial<BuildInfo> = {}): BuildInfo {
  return {
    version: "1.96.0",
    hash: "abc1234",
    date: "2026-06-26T00:00:00Z",
    branch: "develop",
    strang: "latest",
    derivedFromFallback: false,
    ...overrides,
  };
}

describe("StrangBadge", () => {
  it("Latest: shows the test warning + branch + hash", () => {
    render(<StrangBadge t={t} info={info({ strang: "latest" })} />);
    const badge = screen.getByTestId("about-strang-badge");
    expect(badge).toHaveAttribute("data-strang", "latest");
    expect(screen.getByTestId("about-strang-warning")).toBeInTheDocument();
    expect(screen.getByTestId("about-strang-branch")).toHaveTextContent(
      "develop",
    );
    expect(screen.getByTestId("about-strang-hash")).toHaveTextContent(
      "abc1234",
    );
  });

  it("Haupt: shows strand + branch + hash but NO warning", () => {
    render(
      <StrangBadge
        t={t}
        info={info({ strang: "haupt", branch: "main", hash: "deadbee" })}
      />,
    );
    expect(screen.getByTestId("about-strang-badge")).toHaveAttribute(
      "data-strang",
      "haupt",
    );
    expect(screen.queryByTestId("about-strang-warning")).toBeNull();
    expect(screen.getByTestId("about-strang-branch")).toHaveTextContent("main");
    expect(screen.getByTestId("about-strang-hash")).toHaveTextContent(
      "deadbee",
    );
  });

  it("shows the fallback note only when the strand was inferred", () => {
    const { rerender } = render(
      <StrangBadge
        t={t}
        info={info({ strang: "haupt", derivedFromFallback: true })}
      />,
    );
    expect(
      screen.getByTestId("about-strang-fallback-note"),
    ).toBeInTheDocument();

    rerender(
      <StrangBadge
        t={t}
        info={info({ strang: "haupt", derivedFromFallback: false })}
      />,
    );
    expect(screen.queryByTestId("about-strang-fallback-note")).toBeNull();
  });

  it("unknown strand renders without crashing and without a warning", () => {
    render(
      <StrangBadge
        t={t}
        info={info({ strang: "unknown", branch: "unknown", hash: "unknown" })}
      />,
    );
    expect(screen.getByTestId("about-strang-badge")).toHaveAttribute(
      "data-strang",
      "unknown",
    );
    expect(screen.queryByTestId("about-strang-warning")).toBeNull();
    // No fallback note for unknown (nothing was inferred to a real strand).
    expect(screen.queryByTestId("about-strang-fallback-note")).toBeNull();
  });
});

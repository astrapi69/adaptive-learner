/**
 * Tests for LessonHeader (#1633): the lesson title stays a semantic <h1>
 * for a11y / document structure, but is rendered small/unobtrusive, and
 * the description subtitle is no longer shown inside the active lesson —
 * so the task sits higher on the fold. The small "Set: {name}" context
 * label stays.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import LessonHeader from "./LessonHeader";
import type { SetPosition } from "../../../lib/lesson/set-position";
import type { ContentLesson } from "../../../storage/types";

const LESSON = {
  id: "01-overview",
  title: "Überblick: Die sechs Währungen des Geistes",
  description: "Die sechs Währungen des Geistes und die zentrale These.",
  estimated_minutes: 10,
  cards: [],
  steps: [],
} as unknown as ContentLesson;

function renderHeader(overrides: Record<string, unknown> = {}) {
  return render(
    <LessonHeader
      lesson={LESSON}
      setTitle="Die Währung des Geistes"
      {...overrides}
    />,
  );
}

/** Render with the #2793 position row (needs a router for its links). */
function renderWithPosition(
  position: SetPosition,
  hrefs: { prevHref?: string | null; nextHref?: string | null } = {},
) {
  return render(
    <MemoryRouter>
      <LessonHeader
        lesson={LESSON}
        setTitle="Die Währung des Geistes"
        position={position}
        prevHref={hrefs.prevHref ?? null}
        nextHref={hrefs.nextHref ?? null}
      />
    </MemoryRouter>,
  );
}

describe("LessonHeader in-set position (#2793)", () => {
  it("shows no position row when the position is unknown", () => {
    renderHeader();
    expect(screen.queryByTestId("lesson-position-row")).not.toBeInTheDocument();
  });

  it("renders the position readout with both neighbours linked", () => {
    renderWithPosition(
      { index: 3, total: 12, previous: "02.json", next: "04.json" },
      { prevHref: "/lesson/src/set/02.json", nextHref: "/lesson/src/set/04.json" },
    );
    expect(screen.getByTestId("lesson-position")).toHaveTextContent("3");
    expect(screen.getByTestId("lesson-position")).toHaveTextContent("12");
    expect(screen.getByTestId("lesson-nav-previous")).toHaveAttribute(
      "href",
      "/lesson/src/set/02.json",
    );
    expect(screen.getByTestId("lesson-nav-next")).toHaveAttribute(
      "href",
      "/lesson/src/set/04.json",
    );
  });

  it("omits the backward link on the first lesson, keeps the readout", () => {
    renderWithPosition(
      { index: 1, total: 5, previous: null, next: "02.json" },
      { nextHref: "/lesson/src/set/02.json" },
    );
    expect(screen.queryByTestId("lesson-nav-previous")).not.toBeInTheDocument();
    expect(screen.getByTestId("lesson-nav-next")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-position")).toBeInTheDocument();
  });

  it("omits the forward link on the last lesson", () => {
    renderWithPosition(
      { index: 5, total: 5, previous: "04.json", next: null },
      { prevHref: "/lesson/src/set/04.json" },
    );
    expect(screen.getByTestId("lesson-nav-previous")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-nav-next")).not.toBeInTheDocument();
  });
});

describe("LessonHeader", () => {
  it("keeps the lesson title as a level-1 heading for a11y", () => {
    renderHeader();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(
      "Überblick: Die sechs Währungen des Geistes",
    );
  });

  it("renders the title small/unobtrusive, not the large default", () => {
    renderHeader();
    // Proxy for "visually small": the title carries the compact size class
    // instead of the default large heading size.
    expect(screen.getByTestId("lesson-header-title").className).toContain(
      "text-sm",
    );
  });

  it("no longer shows the description subtitle inside the lesson", () => {
    renderHeader();
    expect(screen.queryByTestId("lesson-description")).toBeNull();
  });

  it("keeps the small set-context label", () => {
    renderHeader();
    expect(screen.getByTestId("lesson-header-set")).toHaveTextContent(
      "Die Währung des Geistes",
    );
  });

  it("no longer renders the pause control in the header (#1642 — moved to the footer)", () => {
    renderHeader();
    expect(screen.queryByTestId("lesson-back-btn")).toBeNull();
    expect(screen.queryByTestId("lesson-pause-btn")).toBeNull();
  });
});

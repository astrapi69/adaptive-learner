/**
 * Tests for LessonHeader (#1633): the lesson title stays a semantic <h1>
 * for a11y / document structure, but is rendered small/unobtrusive, and
 * the description subtitle is no longer shown inside the active lesson —
 * so the task sits higher on the fold. The small "Set: {name}" context
 * label stays.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LessonHeader from "./LessonHeader";
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

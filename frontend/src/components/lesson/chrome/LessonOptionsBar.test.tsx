/**
 * Tests for LessonOptionsBar (#1625): the playing-view dispatcher that
 * wires the favorite / mode / auto-read controls into the collapsible
 * options panel, and renders nothing on the summary screen.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LessonOptionsBar from "./LessonOptionsBar";
import type { ContentLesson } from "../../../storage/types";
import type { ReadAloudController } from "../../../hooks/lesson/audio/useReadAloud";

const LESSON = {
  id: "l1",
  title: "L1",
  estimated_minutes: 1,
  cards: [],
  steps: [],
} as unknown as ContentLesson;
const TTS = { enabled: false } as unknown as ReadAloudController;

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    isSummary: false,
    userId: "",
    source: "src",
    setId: "set-1",
    filename: "01.json",
    title: "L1",
    setTitle: "Set",
    lessonMode: "practice" as const,
    onModeChange: vi.fn(),
    modeLocked: false,
    showReadAloud: false,
    lesson: LESSON,
    tts: TTS,
    autoRead: false,
    toggleAutoRead: vi.fn(),
    startContinuous: vi.fn(),
    isContinuous: false,
    continuousAvailable: false,
    ...overrides,
  };
}

describe("LessonOptionsBar", () => {
  it("renders the collapsed options panel with the mode toggle on the playing view", () => {
    render(<LessonOptionsBar {...baseProps()} />);
    expect(screen.getByTestId("lesson-options-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // Bundled control is mounted but hidden while collapsed.
    expect(screen.getByTestId("lesson-mode-toggle")).not.toBeVisible();
    // Expanding reveals it.
    fireEvent.click(screen.getByTestId("lesson-options-toggle"));
    expect(screen.getByTestId("lesson-mode-toggle")).toBeVisible();
  });

  it("renders nothing on the summary screen", () => {
    render(<LessonOptionsBar {...baseProps({ isSummary: true })} />);
    expect(screen.queryByTestId("lesson-options-panel")).toBeNull();
    expect(screen.queryByTestId("lesson-mode-toggle")).toBeNull();
  });
});

/**
 * MyLessonsSection (#3007) — the create entry point EXP-021 planned for this
 * section and that was never built.
 *
 * EXP-021 lists three entry points to the lesson creator: the content-browser
 * button, a "+" in the My-Lessons area, and a dashboard quick action. Only
 * the first was ever built. Whoever looks at their own lessons and misses one
 * is in the moment of intent — this is the nearest place for the entry.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
  }),
}));

import MyLessonsSection from "./MyLessonsSection";
import type { ContentSetEntry } from "../../../storage/types";

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "user-generated",
    branch: "",
    id: "my-lesson-1",
    title: "Meine erste Lektion",
    language: "fr",
    target_language: "fr",
    source_language: "de",
    level: "A1",
    domain: "analysis",
    version: "1.0.0",
    lesson_count: 1,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    ...over,
  } as ContentSetEntry;
}

function renderSection(onCreateLesson = vi.fn()) {
  render(
    <MyLessonsSection
      userSets={[entry()]}
      communitySharingEnabled={false}
      onOpen={vi.fn()}
      onEdit={vi.fn()}
      onExportJson={vi.fn()}
      onExportSet={vi.fn()}
      onShare={vi.fn()}
      onDelete={vi.fn()}
      onPlayLessonFile={vi.fn()}
      onEditLessonFile={vi.fn()}
      onRequestDeleteLesson={vi.fn()}
      onRequestBulkDeleteLesson={vi.fn()}
      onCreateLesson={onCreateLesson}
      selectMode={false}
      selectedCount={0}
      isSelected={() => false}
      onToggleSelectMode={vi.fn()}
      onToggleSelect={vi.fn()}
      onOpenCombine={vi.fn()}
    />,
  );
  return onCreateLesson;
}

describe("MyLessonsSection create entry (#3007)", () => {
  it("renders a create button in the section head", () => {
    renderSection();
    const button = screen.getByTestId("my-lessons-create");
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("content-my-lessons")).toContainElement(button);
  });

  it("calls the host's handler on click, and does not navigate itself", () => {
    const onCreateLesson = renderSection();
    fireEvent.click(screen.getByTestId("my-lessons-create"));
    expect(onCreateLesson).toHaveBeenCalledTimes(1);
  });

  it("carries an accessible name and a 44px tap target", () => {
    renderSection();
    const button = screen.getByTestId("my-lessons-create");
    expect(button).toHaveAccessibleName(/Create New Lesson/i);
    expect(button.className).toContain("min-h-[44px]");
  });

  it("stays available while the combine selection mode is on", () => {
    render(
      <MyLessonsSection
        userSets={[entry()]}
        communitySharingEnabled={false}
        onOpen={vi.fn()}
        onEdit={vi.fn()}
        onExportJson={vi.fn()}
        onExportSet={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onPlayLessonFile={vi.fn()}
        onEditLessonFile={vi.fn()}
        onRequestDeleteLesson={vi.fn()}
        onRequestBulkDeleteLesson={vi.fn()}
        onCreateLesson={vi.fn()}
        selectMode
        selectedCount={1}
        isSelected={() => true}
        onToggleSelectMode={vi.fn()}
        onToggleSelect={vi.fn()}
        onOpenCombine={vi.fn()}
      />,
    );
    expect(screen.getByTestId("my-lessons-create")).toBeInTheDocument();
  });
});

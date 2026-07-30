/**
 * DeleteLessonFromSetModal (#2064) — the single-lesson delete confirmation.
 *
 * Pins: closed when target is null; names the lesson + honest "cannot be
 * undone / backup" copy + the opt-in progress checkbox with the real card
 * count; the confirm button is focused for a11y and carries an accessible
 * name; Cancel/Confirm fire their callbacks with the opt-in choice.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeleteLessonFromSetModal from "./DeleteLessonFromSetModal";
import type { LessonDeleteTarget } from "../../../hooks/content/useContentSetActions";
import type { ContentSetEntry } from "../../../storage/types";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

function target(): LessonDeleteTarget {
  return {
    entry: { source: "user-generated", id: "book42" } as ContentSetEntry,
    filename: "02-body.json",
    title: "Chapter 2",
  };
}

describe("DeleteLessonFromSetModal", () => {
  it("renders nothing when target is null", () => {
    render(
      <DeleteLessonFromSetModal target={null} deleting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.queryByTestId("delete-lesson-from-set-modal")).toBeNull();
  });

  it("names the lesson + honest copy + a focused confirm button (a11y)", () => {
    render(
      <DeleteLessonFromSetModal target={target()} deleting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    const dialog = screen.getByTestId("delete-lesson-from-set-modal");
    expect(dialog).toHaveTextContent("Chapter 2");
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    const confirm = screen.getByTestId("delete-lesson-from-set-confirm");
    // accessible name + focus for keyboard users (#2037 class).
    expect(confirm).toHaveTextContent(/delete/i);
    expect(confirm).toHaveFocus();
  });

  it("shows the real review-card count when a plan is provided", () => {
    render(
      <DeleteLessonFromSetModal
        target={target()}
        deleting={false}
        plan={{
          lessonProgressIds: ["lp"],
          orphanedSetIds: [],
          lessonCards: [{ set_id: "book42", lesson_id: "02-body.json" }],
          lessonCount: 1,
          cardCount: 3,
        }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId("delete-lesson-progress-option").parentElement).toHaveTextContent(
      "3 review cards",
    );
  });

  it("passes the opt-in choice to onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteLessonFromSetModal target={target()} deleting={false} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByTestId("delete-lesson-progress-option"));
    fireEvent.click(screen.getByTestId("delete-lesson-from-set-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });
});

/**
 * BulkDeleteLessonsModal (#2065) — the multi-select lesson delete confirmation.
 *
 * Pins: closed at count 0; names the COUNT + honest "cannot be undone / backup"
 * copy + a visible (non-forcing) backup recommendation; a distinct "whole set
 * will be deleted" message when the selection empties the set; the opt-in
 * progress checkbox with the aggregated card count; focused confirm for a11y;
 * Cancel/Confirm fire with the opt-in choice.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BulkDeleteLessonsModal from "./BulkDeleteLessonsModal";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

describe("BulkDeleteLessonsModal", () => {
  it("renders nothing when count is 0", () => {
    render(
      <BulkDeleteLessonsModal
        count={0}
        emptiesSet={false}
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("bulk-delete-lessons-modal")).toBeNull();
  });

  it("names the count, shows the backup hint, and focuses the confirm button (a11y)", () => {
    render(
      <BulkDeleteLessonsModal
        count={3}
        emptiesSet={false}
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const dialog = screen.getByTestId("bulk-delete-lessons-modal");
    expect(dialog).toHaveTextContent("Delete 3 lessons?");
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    expect(screen.getByTestId("bulk-delete-lessons-backup-hint")).toHaveTextContent(
      /backup/i,
    );
    const confirm = screen.getByTestId("bulk-delete-lessons-confirm");
    expect(confirm).toHaveTextContent(/delete/i);
    expect(confirm).toHaveFocus();
  });

  it("warns that the WHOLE SET will be deleted when the selection empties it", () => {
    render(
      <BulkDeleteLessonsModal
        count={2}
        emptiesSet={true}
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId("bulk-delete-lessons-modal")).toHaveTextContent(
      /whole set will be deleted/i,
    );
  });

  it("shows the aggregated review-card count when a plan is provided", () => {
    render(
      <BulkDeleteLessonsModal
        count={2}
        emptiesSet={false}
        deleting={false}
        plan={{
          lessonProgressIds: ["lp1", "lp2"],
          orphanedSetIds: [],
          lessonCards: [
            { set_id: "book42", lesson_id: "01.json" },
            { set_id: "book42", lesson_id: "02.json" },
          ],
          lessonCount: 2,
          cardCount: 5,
        }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("bulk-delete-lessons-progress-option").parentElement,
    ).toHaveTextContent("5 review cards");
  });

  it("passes the opt-in choice to onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <BulkDeleteLessonsModal
        count={2}
        emptiesSet={false}
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId("bulk-delete-lessons-progress-option"));
    fireEvent.click(screen.getByTestId("bulk-delete-lessons-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });
});

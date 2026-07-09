/**
 * Tests for RemoveRepoDialog (#1445 Part B). Keep-progress is the default;
 * the delete choice is opt-in, names real counts, warns of irreversibility,
 * and is absent when the store can't delete locally.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

import RemoveRepoDialog from "./RemoveRepoDialog";
import type { DeletionPlan } from "../../../lib/content/browse/orphan-cleanup";

const REPO = {
  url: "https://github.com/jane/repo",
  owner: "jane",
  repo: "repo",
  branch: "main",
  connected: true,
  last_synced: null,
  set_count: 1,
  lesson_count: 3,
};

function planWith(lessonCount: number, cardCount: number): DeletionPlan {
  return { lessonProgressIds: [], orphanedSetIds: [], lessonCount, cardCount };
}

function setup(overrides: Partial<React.ComponentProps<typeof RemoveRepoDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <RemoveRepoDialog
      repo={REPO}
      plan={planWith(3, 7)}
      canDeleteProgress
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe("RemoveRepoDialog", () => {
  it("defaults to keep-progress: confirm reports false, checkbox unchecked", () => {
    const { onConfirm } = setup();
    const checkbox = screen.getByTestId(
      "content-repo-remove-delete-progress",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(screen.getByTestId("content-repo-remove-dialog-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("opting in shows the real counts + irreversibility and confirms true", () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByTestId("content-repo-remove-delete-progress"));
    const warning = screen.getByTestId("content-repo-remove-consequence");
    expect(warning).toHaveTextContent("3");
    expect(warning).toHaveTextContent("7");
    expect(warning).toHaveTextContent(/cannot be undone/i);
    fireEvent.click(screen.getByTestId("content-repo-remove-dialog-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("hides the delete choice when the store cannot delete locally (API mode)", () => {
    setup({ canDeleteProgress: false });
    expect(
      screen.queryByTestId("content-repo-remove-delete-progress"),
    ).not.toBeInTheDocument();
  });

  it("hides the delete choice when there is no progress to delete", () => {
    setup({ plan: planWith(0, 0) });
    expect(
      screen.queryByTestId("content-repo-remove-delete-progress"),
    ).not.toBeInTheDocument();
  });

  it("blocks confirm while opted-in but counts are still loading", () => {
    const { onConfirm } = setup({ plan: null });
    // The choice is shown (counts unknown yet); ticking it must not allow a
    // delete against unknown numbers.
    fireEvent.click(screen.getByTestId("content-repo-remove-delete-progress"));
    const confirm = screen.getByTestId(
      "content-repo-remove-dialog-confirm",
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape cancels", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});

/** Tests for the multi-select bulk-action bar (#1351). */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BulkActionBar from "./BulkActionBar";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

function renderBar(count: number) {
  const onSetStatus = vi.fn();
  const onDelete = vi.fn();
  const onClear = vi.fn();
  render(
    <BulkActionBar
      count={count}
      onSetStatus={onSetStatus}
      onDelete={onDelete}
      onClear={onClear}
    />,
  );
  return { onSetStatus, onDelete, onClear };
}

describe("BulkActionBar (#1351)", () => {
  it("renders nothing when the selection is empty", () => {
    renderBar(0);
    expect(screen.queryByTestId("content-bulk-bar")).toBeNull();
  });

  it("shows the selection count once at least one is selected", () => {
    renderBar(3);
    expect(screen.getByTestId("content-bulk-bar")).toBeInTheDocument();
    expect(screen.getByTestId("content-bulk-count")).toHaveTextContent("3 selected");
  });

  it("offers every status action + delete, wired to the reused handlers", () => {
    const { onSetStatus, onDelete } = renderBar(2);
    fireEvent.click(screen.getByTestId("content-bulk-active"));
    expect(onSetStatus).toHaveBeenCalledWith("active");
    fireEvent.click(screen.getByTestId("content-bulk-deferred"));
    expect(onSetStatus).toHaveBeenCalledWith("deferred");
    fireEvent.click(screen.getByTestId("content-bulk-completed"));
    expect(onSetStatus).toHaveBeenCalledWith("completed");
    fireEvent.click(screen.getByTestId("content-bulk-delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("clears the selection via the clear control", () => {
    const { onClear } = renderBar(2);
    fireEvent.click(screen.getByTestId("content-bulk-clear"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

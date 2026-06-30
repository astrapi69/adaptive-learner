/**
 * DeleteSetModal (#1300) — the downloaded-set delete confirmation.
 *
 * Pins: closed when target is null; renders the set title + the honest
 * "what gets removed" copy + Cancel/Delete; Cancel and Confirm fire
 * their callbacks.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContentSetEntry } from "../../../storage/types";
import DeleteSetModal from "./DeleteSetModal";

function entry(): ContentSetEntry {
  return {
    source: "src",
    branch: "main",
    id: "psych",
    title: "Psychologie",
    language: "de",
    target_language: "de",
    source_language: "de",
    level: "A1",
    domain: "psychology",
    version: "1.0.0",
    lesson_count: 5,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
  };
}

describe("DeleteSetModal", () => {
  it("renders nothing when target is null", () => {
    render(<DeleteSetModal target={null} deleting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByTestId("delete-set-modal")).toBeNull();
  });

  it("renders the set title + confirm copy + actions", () => {
    render(
      <DeleteSetModal target={entry()} deleting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    const dialog = screen.getByTestId("delete-set-modal");
    expect(dialog).toHaveTextContent("Psychologie");
    // honest copy: mentions removal + re-download
    expect(dialog).toHaveTextContent(/remove|removed/i);
    expect(screen.getByTestId("delete-set-cancel")).toBeInTheDocument();
    expect(screen.getByTestId("delete-set-confirm")).toBeInTheDocument();
  });

  it("fires onConfirm when Delete is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteSetModal target={entry()} deleting={false} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByTestId("delete-set-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fires onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <DeleteSetModal target={entry()} deleting={false} onCancel={onCancel} onConfirm={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("delete-set-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while deleting", () => {
    render(
      <DeleteSetModal target={entry()} deleting={true} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByTestId("delete-set-cancel")).toBeDisabled();
    expect(screen.getByTestId("delete-set-confirm")).toBeDisabled();
  });
});

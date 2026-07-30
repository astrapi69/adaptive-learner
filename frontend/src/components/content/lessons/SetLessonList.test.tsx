/**
 * SetLessonList reorder behaviour (#2172).
 *
 * Proves the user-visible half of the hard constraint: the Up/Down controls
 * change the DISPLAYED order and persist it across a remount, while the
 * underlying lesson filenames (identities) are only permuted - the delete
 * target passed up for any row still carries that row's original filename, so
 * progress/SRS keyed on the filename can never be orphaned by a reorder.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SetLessonList from "./SetLessonList";
import type { ContentSetEntry } from "../../../storage/types";

const listLessons = vi.fn();
const getLesson = vi.fn();

vi.mock("../../../storage", () => ({
  getStorage: () => ({
    contentLoader: { listLessons, getLesson },
  }),
}));

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "user-generated",
    branch: "main",
    id: "mein-buch",
    title: "Mein Buch",
    language: "de",
    target_language: "de",
    source_language: "de",
    level: "A1",
    domain: "imported",
    version: "1.0.0",
    lesson_count: 3,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    downloaded_at: null,
    ...over,
  } as ContentSetEntry;
}

/** Alphabetical read-order: epilogue first, then chapters (the device bug). */
const LESSONS = [
  { id: "epilog", title: "Epilog" },
  { id: "kapitel-1", title: "Kapitel 1" },
  { id: "kapitel-2", title: "Kapitel 2" },
];

function mockLessons() {
  listLessons.mockResolvedValue({
    set_id: "mein-buch",
    source: "user-generated",
    version: "1.0.0",
    lessons: LESSONS.map((l) => `${l.id}.json`),
  });
  getLesson.mockImplementation((_source: string, _setId: string, filename: string) => {
    const found = LESSONS.find((l) => `${l.id}.json` === filename)!;
    return Promise.resolve(found);
  });
}

async function renderExpanded() {
  const onPlayLesson = vi.fn();
  const onRequestDelete = vi.fn();
  render(
    <SetLessonList
      entry={entry()}
      onPlayLesson={onPlayLesson}
      onRequestDelete={onRequestDelete}
    />,
  );
  fireEvent.click(screen.getByTestId("set-lessons-toggle-mein-buch"));
  await waitFor(() => screen.getByTestId("set-lesson-mein-buch-epilog.json"));
  return { onPlayLesson, onRequestDelete };
}

/** The visible order, read off the row testids. */
function orderOf(): string[] {
  return screen
    .getAllByTestId(/^set-lesson-mein-buch-.+\.json$/)
    .map((el) => el.getAttribute("data-testid")!.replace("set-lesson-mein-buch-", ""));
}

beforeEach(() => {
  localStorage.clear();
  mockLessons();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SetLessonList - reorder", () => {
  it("shows the natural order when nothing was reordered", async () => {
    await renderExpanded();
    expect(orderOf()).toEqual(["epilog.json", "kapitel-1.json", "kapitel-2.json"]);
  });

  it("moves a lesson down and reflects the new order immediately", async () => {
    await renderExpanded();
    fireEvent.click(screen.getByTestId("set-lesson-down-mein-buch-epilog.json"));
    expect(orderOf()).toEqual(["kapitel-1.json", "epilog.json", "kapitel-2.json"]);
  });

  it("moves a lesson up", async () => {
    await renderExpanded();
    fireEvent.click(screen.getByTestId("set-lesson-up-mein-buch-kapitel-2.json"));
    expect(orderOf()).toEqual(["epilog.json", "kapitel-2.json", "kapitel-1.json"]);
  });

  it("disables Up on the first row and Down on the last (edge behaviour)", async () => {
    await renderExpanded();
    expect(screen.getByTestId("set-lesson-up-mein-buch-epilog.json")).toBeDisabled();
    expect(screen.getByTestId("set-lesson-down-mein-buch-kapitel-2.json")).toBeDisabled();
    // Middle rows can move both ways.
    expect(screen.getByTestId("set-lesson-up-mein-buch-kapitel-1.json")).not.toBeDisabled();
    expect(screen.getByTestId("set-lesson-down-mein-buch-kapitel-1.json")).not.toBeDisabled();
  });

  it("announces the new position for screen readers (aria-live)", async () => {
    await renderExpanded();
    fireEvent.click(screen.getByTestId("set-lesson-down-mein-buch-epilog.json"));
    const live = screen.getByTestId("set-lessons-announce-mein-buch");
    expect(live).toHaveTextContent(/Epilog/);
    expect(live).toHaveTextContent(/2/);
  });

  it("persists the order across a remount (immediately, no save action)", async () => {
    const { unmount } = render(
      <SetLessonList entry={entry()} onPlayLesson={vi.fn()} onRequestDelete={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("set-lessons-toggle-mein-buch"));
    await waitFor(() => screen.getByTestId("set-lesson-mein-buch-epilog.json"));
    fireEvent.click(screen.getByTestId("set-lesson-down-mein-buch-epilog.json"));
    expect(orderOf()).toEqual(["kapitel-1.json", "epilog.json", "kapitel-2.json"]);
    unmount();

    // Fresh mount reads the persisted order.
    await renderExpanded();
    expect(orderOf()).toEqual(["kapitel-1.json", "epilog.json", "kapitel-2.json"]);
  });

  it("keeps identities intact: the delete target still carries the row's filename", async () => {
    const { onRequestDelete } = await renderExpanded();
    fireEvent.click(screen.getByTestId("set-lesson-down-mein-buch-epilog.json"));
    // Delete the moved lesson; the filename passed up is unchanged by the move.
    fireEvent.click(screen.getByTestId("set-lesson-delete-mein-buch-epilog.json"));
    expect(onRequestDelete).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "epilog.json", title: "Epilog" }),
    );
  });
});

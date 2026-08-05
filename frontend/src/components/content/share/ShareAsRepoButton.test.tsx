/**
 * ShareAsRepoButton (#2376) — the pre-export quality gate.
 *
 * Pins: a set that would fail a content repo's gates (here: a matching
 * exercise with a duplicate left value) is NOT pushed on the first click —
 * the issues are listed and the button flips to "Export anyway"; the second
 * click exports regardless (the author's own repo, no reviewer in the
 * loop). A clean set whose lesson filenames sort out of order is pushed
 * with fresh ``NN-`` prefixes and the done screen says so.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notify } = vi.hoisted(() => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("../../../utils/notify", () => ({ notify }));

const { storageMock } = vi.hoisted(() => {
  const storageMock = {
    github: {
      getStatus: vi.fn(async () => ({ configured: true })),
      exportSetToRepo: vi.fn(
        async (_request: { files: { path: string }[] }) => ({
          repoUrl: "https://github.com/coach/deck",
        }),
      ),
    },
    contentLoader: {
      listLessons: vi.fn(async () => ({ lessons: [] as string[] })),
      getLesson: vi.fn(),
    },
  };
  return { storageMock };
});
vi.mock("../../../storage", () => ({ getStorage: () => storageMock }));

import ShareAsRepoButton from "./ShareAsRepoButton";
import type { ContentLesson, ContentSetEntry } from "../../../storage/types";

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "coach/deck",
    branch: "main",
    id: "deck",
    title: "Coach Deck",
    title_native: "Coach Deck",
    language: "de",
    target_language: "fr",
    source_language: "de",
    level: "A1",
    domain: "language",
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

/** A lesson that clears every quality minimum (mirrors the validator's
 *  own good-lesson fixture). */
function cleanLesson(id: string): ContentLesson {
  return {
    id,
    title: id,
    estimated_minutes: 10,
    cards: [
      { id: "c1", front: "Bonjour", back: "Guten Tag", tags: [] },
      { id: "c2", front: "Merci", back: "Danke", tags: [] },
      { id: "c3", front: "Salut", back: "Hallo", tags: [] },
    ],
    steps: [
      { id: "intro", type: "theory", body: "# Begrüßung" },
      {
        id: "e1",
        type: "exercise",
        exercise: {
          id: "e1",
          type: "matching",
          prompt: "Zuordnen",
          card_ids: ["c1", "c2", "c3"],
          pairs: [
            { left: "Bonjour", right: "Guten Tag" },
            { left: "Merci", right: "Danke" },
            { left: "Salut", right: "Hallo" },
          ],
          distractors: [],
        },
      },
      {
        id: "e2",
        type: "exercise",
        exercise: {
          id: "e2",
          type: "free_text",
          prompt: "Tippe",
          card_ids: ["c1"],
          accept: ["Bonjour", "bonjour"],
          distractors: ["Salut", "Merci"],
        },
      },
      {
        id: "e3",
        type: "exercise",
        exercise: {
          id: "e3",
          type: "word_tiles",
          prompt: "Ordne",
          card_ids: ["c1"],
          tiles: ["Bon", "jour"],
          distractors: [],
        },
      },
      {
        id: "e4",
        type: "exercise",
        exercise: {
          id: "e4",
          type: "word_tiles",
          prompt: "Ordne",
          card_ids: ["c3"],
          tiles: ["Sa", "lut"],
          distractors: [],
        },
      },
      {
        id: "e5",
        type: "exercise",
        exercise: {
          id: "e5",
          type: "word_tiles",
          prompt: "Ordne",
          card_ids: ["c2"],
          tiles: ["Mer", "ci"],
          distractors: [],
        },
      },
    ],
  } as ContentLesson;
}

/** The clean lesson with an unsolvable duplicate-left matching pair. */
function dupLeftLesson(id: string): ContentLesson {
  const lesson = cleanLesson(id);
  const matching = lesson.steps.find((s) => s.exercise?.type === "matching")!;
  matching.exercise!.pairs = [
    { left: "Keimbahn-Editierung", right: "a" },
    { left: "Keimbahn-Editierung", right: "b" },
    { left: "Salut", right: "Hallo" },
  ];
  return lesson;
}

function seedLessons(byName: Record<string, ContentLesson>): void {
  storageMock.contentLoader.listLessons.mockImplementation(async () => ({
    lessons: Object.keys(byName),
  }));
  storageMock.contentLoader.getLesson.mockImplementation(
    async (_source: string, _id: string, filename: string) => byName[filename],
  );
}

async function openDialogAndExport(): Promise<void> {
  render(<ShareAsRepoButton entry={entry()} />);
  fireEvent.click(await screen.findByTestId("user-set-share-repo"));
  const name = await screen.findByTestId("repo-export-name");
  fireEvent.change(name, { target: { value: "coach/deck" } });
  fireEvent.click(screen.getByTestId("repo-export-submit"));
}

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.github.getStatus.mockImplementation(async () => ({
    configured: true,
  }));
  storageMock.github.exportSetToRepo.mockImplementation(async () => ({
    repoUrl: "https://github.com/coach/deck",
  }));
});

describe("ShareAsRepoButton quality gate (#2376)", () => {
  it("blocks the first export on quality issues and lists them", async () => {
    seedLessons({ "01-intro.json": dupLeftLesson("01-intro") });
    await openDialogAndExport();
    const issues = await screen.findByTestId("repo-export-quality-issues");
    expect(issues.textContent).toContain("matching_duplicate_left");
    expect(storageMock.github.exportSetToRepo).not.toHaveBeenCalled();
  });

  it("exports anyway on the second click", async () => {
    seedLessons({ "01-intro.json": dupLeftLesson("01-intro") });
    await openDialogAndExport();
    await screen.findByTestId("repo-export-quality-issues");
    fireEvent.click(screen.getByTestId("repo-export-submit"));
    await screen.findByTestId("repo-export-done");
    expect(storageMock.github.exportSetToRepo).toHaveBeenCalledTimes(1);
  });

  it("pushes a clean set with ordering prefixes and says so", async () => {
    seedLessons({
      "kapitel-2.json": cleanLesson("kapitel-2"),
      "kapitel-10.json": cleanLesson("kapitel-10"),
    });
    await openDialogAndExport();
    await screen.findByTestId("repo-export-done");
    await screen.findByTestId("repo-export-renamed-note");
    const call = storageMock.github.exportSetToRepo.mock.calls[0]?.[0];
    const paths = call!.files.map((f) => f.path);
    expect(paths).toContain("lessons/01-kapitel-2.json");
    expect(paths).toContain("lessons/02-kapitel-10.json");
  });

  it("skips the renamed note when the filenames already sort in order", async () => {
    seedLessons({
      "01-eins.json": cleanLesson("01-eins"),
      "02-zwei.json": cleanLesson("02-zwei"),
    });
    await openDialogAndExport();
    await screen.findByTestId("repo-export-done");
    await waitFor(() =>
      expect(
        screen.queryByTestId("repo-export-renamed-note"),
      ).not.toBeInTheDocument(),
    );
  });
});

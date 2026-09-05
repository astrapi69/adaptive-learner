/**
 * Tests for the deep-link "open a single set" page at
 * ``/content/set/:setId`` (#892).
 *
 * Pins (both storage modes — the mocked ``getStorage`` stands in for
 * either ApiStorage or DexieStorage; the page never branches on mode):
 * - downloaded set        → renders the set card + "Start learning",
 *   clicking jumps to the set's first lesson.
 * - not-downloaded set    → renders "Download & start", clicking
 *   downloads first, then opens the first lesson.
 * - unknown set id        → clean "Set not found" state with a Discover
 *   link, NO crash and NO error toast.
 * - empty set listing     → same clean not-found state (offline +
 *   nothing cached resolves to "not reachable here", never a throw).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentSetEntry } from "../../storage/types";

const listSetsMock = vi.fn();
const listLessonsMock = vi.fn();
const downloadSetMock = vi.fn();
const getLessonMock = vi.fn();
const listProgressMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      listLessons: listLessonsMock,
      downloadSet: downloadSetMock,
      getLesson: getLessonMock,
    },
    lessonProgress: {
      list: listProgressMock,
    },
  }),
}));

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

const notifyError = vi.fn();
const notifyWarning = vi.fn();
vi.mock("../../utils/notify", () => ({
  notify: { error: (...a: unknown[]) => notifyError(...a), warning: (...a: unknown[]) => notifyWarning(...a) },
}));

import SetDeepLink from "./SetDeepLink";
import { PAGE_CONTAINER_CLASSES } from "../../shared/layout/PageContainer";

function makeEntry(over: Partial<ContentSetEntry> & { id: string }): ContentSetEntry {
  return {
    source: "owner/repo",
    branch: "main",
    title: "French A1",
    title_native: null,
    language: "fr",
    target_language: "fr",
    source_language: "en",
    level: "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 3,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: null,
    update_available: false,
    ...over,
  };
}

/** Renders the matched ``:filename`` so tests can assert exactly which
 *  lesson "Start"/"Continue" navigated to, not just that navigation
 *  happened. */
function LessonPageProbe() {
  const { filename } = useParams<{ filename: string }>();
  return <div data-testid="lesson-page">{filename}</div>;
}

function renderAt(setId: string) {
  return render(
    <MemoryRouter initialEntries={[`/content/set/${setId}`]}>
      <Routes>
        <Route path="/content/set/:setId" element={<SetDeepLink />} />
        <Route path="/content" element={<div data-testid="content-page" />} />
        <Route path="/lesson/:setSlug/:setId/:filename" element={<LessonPageProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function progressRow(
  filename: string,
  status: "in_progress" | "paused" | "abandoned" | "completed",
) {
  return {
    id: filename,
    user_id: "u1",
    source: "owner/repo",
    set_id: "fr-a1",
    lesson_filename: filename,
    status,
    step_results: {},
    score_correct: 8,
    score_total: 10,
  };
}

beforeEach(() => {
  localStorage.clear();
  listSetsMock.mockReset();
  listLessonsMock.mockReset();
  downloadSetMock.mockReset();
  getLessonMock.mockReset();
  listProgressMock.mockReset();
  notifyError.mockReset();
  notifyWarning.mockReset();
  listLessonsMock.mockResolvedValue({ lessons: ["01.json", "02.json"] });
  getLessonMock.mockRejectedValue(new Error("not mocked for this test"));
  listProgressMock.mockResolvedValue([]);
});

describe("SetDeepLink (#892)", () => {
  it("opens a downloaded set's first lesson on Start", async () => {
    listSetsMock.mockResolvedValue({
      sets: [makeEntry({ id: "fr-a1", cached_version: "1.0.0" })],
    });
    renderAt("fr-a1");

    await screen.findByTestId("set-deep-link-found");
    expect(screen.getByTestId("set-deep-link-title")).toHaveTextContent("French A1");
    expect(screen.getByTestId("set-deep-link-start")).toHaveTextContent("Start learning");

    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    await waitFor(() => expect(screen.getByTestId("lesson-page")).toBeInTheDocument());
    expect(downloadSetMock).not.toHaveBeenCalled();
    expect(listLessonsMock).toHaveBeenCalledWith("owner/repo", "fr-a1");
  });

  // #2935 — "Start learning" ignored existing progress and always
  // restarted at lesson 1, forcing a manual click-through to resume.
  it("resumes at the first unfinished lesson instead of restarting at lesson 1", async () => {
    listSetsMock.mockResolvedValue({
      sets: [makeEntry({ id: "fr-a1", cached_version: "1.0.0" })],
    });
    listLessonsMock.mockResolvedValue({ lessons: ["01.json", "02.json", "03.json"] });
    localStorage.setItem("adaptive-learner.user_id", "u1");
    listProgressMock.mockResolvedValue([progressRow("01.json", "completed")]);
    renderAt("fr-a1");

    await screen.findByTestId("set-lesson-list");
    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    await waitFor(() => expect(screen.getByTestId("lesson-page")).toHaveTextContent("02.json"));
  });

  it("still opens lesson 1 on Start when the set has no progress yet", async () => {
    listSetsMock.mockResolvedValue({
      sets: [makeEntry({ id: "fr-a1", cached_version: "1.0.0" })],
    });
    localStorage.setItem("adaptive-learner.user_id", "u1");
    renderAt("fr-a1");

    await screen.findByTestId("set-lesson-list");
    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    await waitFor(() => expect(screen.getByTestId("lesson-page")).toHaveTextContent("01.json"));
  });

  it("falls back to lesson 1 on Start once every lesson is completed", async () => {
    listSetsMock.mockResolvedValue({
      sets: [makeEntry({ id: "fr-a1", cached_version: "1.0.0" })],
    });
    localStorage.setItem("adaptive-learner.user_id", "u1");
    listProgressMock.mockResolvedValue([
      progressRow("01.json", "completed"),
      progressRow("02.json", "completed"),
    ]);
    renderAt("fr-a1");

    await screen.findByTestId("set-lesson-list");
    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    await waitFor(() => expect(screen.getByTestId("lesson-page")).toHaveTextContent("01.json"));
  });

  // #2935 — a completed row showed only a muted score number, easy to
  // miss as "done" at a glance.
  it("marks a completed lesson row with a done indicator", async () => {
    listSetsMock.mockResolvedValue({
      sets: [makeEntry({ id: "fr-a1", cached_version: "1.0.0" })],
    });
    localStorage.setItem("adaptive-learner.user_id", "u1");
    listProgressMock.mockResolvedValue([progressRow("01.json", "completed")]);
    renderAt("fr-a1");

    await screen.findByTestId("set-lesson-list");
    expect(screen.getByTestId("set-lesson-done-01.json")).toBeInTheDocument();
    expect(screen.queryByTestId("set-lesson-done-02.json")).not.toBeInTheDocument();
  });

  // #2835 — the list previously rendered the raw filename.
  it("shows each lesson's title, falling back to the filename when the fetch fails", async () => {
    listSetsMock.mockResolvedValue({
      sets: [makeEntry({ id: "fr-a1", cached_version: "1.0.0" })],
    });
    getLessonMock.mockImplementation(async (_source: string, _setId: string, filename: string) => {
      if (filename === "01.json") return { title: "Greetings" };
      throw new Error("upstream unreachable");
    });
    renderAt("fr-a1");

    await screen.findByTestId("set-lesson-list");
    expect(screen.getByTestId("set-lesson-1")).toHaveTextContent("Greetings");
    expect(screen.getByTestId("set-lesson-2")).toHaveTextContent("02.json");
  });

  it("downloads a not-yet-cached set before opening it", async () => {
    listSetsMock.mockResolvedValue({
      sets: [makeEntry({ id: "es-a1", cached_version: null })],
    });
    downloadSetMock.mockResolvedValue(makeEntry({ id: "es-a1", cached_version: "1.0.0" }));
    renderAt("es-a1");

    await screen.findByTestId("set-deep-link-found");
    expect(screen.getByTestId("set-deep-link-start")).toHaveTextContent("Download & start");

    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    await waitFor(() => expect(screen.getByTestId("lesson-page")).toBeInTheDocument());
    expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "es-a1", expect.any(Function));
  });

  it("shows a clean not-found state for an unknown set id (no crash, no toast)", async () => {
    listSetsMock.mockResolvedValue({ sets: [makeEntry({ id: "fr-a1" })] });
    renderAt("does-not-exist");

    await screen.findByTestId("set-deep-link-not-found");
    expect(screen.getByTestId("set-deep-link-discover")).toBeInTheDocument();
    expect(notifyError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("set-deep-link-discover"));
    await waitFor(() => expect(screen.getByTestId("content-page")).toBeInTheDocument());
  });

  it("falls back to not-found when the set listing is empty", async () => {
    listSetsMock.mockResolvedValue({ sets: [] });
    renderAt("fr-a1");

    await screen.findByTestId("set-deep-link-not-found");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("does not throw when listSets rejects (offline, nothing cached)", async () => {
    listSetsMock.mockRejectedValue(new Error("offline"));
    renderAt("fr-a1");

    await screen.findByTestId("set-deep-link-not-found");
    expect(notifyError).not.toHaveBeenCalled();
  });
});

describe("shared page container (#1384)", () => {
  it("renders inside the shared PageContainer, with no deviating wrapper", async () => {
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
    renderAt("unknown-set");
    const main = await screen.findByTestId("set-deep-link-page");
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveAttribute("data-slot", "page-container");
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });
});

describe("SetDeepLink: bonus lessons (#2890)", () => {
  function setupBonusSet() {
    localStorage.setItem("adaptive-learner.user_id", "u1");
    localStorage.setItem("adaptive-learner.lesson.playful_mode", "true");
    listSetsMock.mockResolvedValue({
      sets: [makeEntry({ id: "fr-a1", cached_version: "1.0.0" })],
    });
    // Directory order puts the bonus file FIRST - the page must sort
    // it to the end and never make it the "start learning" target.
    listLessonsMock.mockResolvedValue({
      lessons: ["bonus-extra.json", "01.json"],
    });
    getLessonMock.mockResolvedValue({ title: "T" });
  }

  it("sorts the bonus lesson last and locks it while the set is unfinished", async () => {
    setupBonusSet();
    renderAt("fr-a1");
    await screen.findByTestId("set-lesson-list");
    // Row 1 is the regular lesson, row 2 the bonus lesson.
    const bonusRow = screen.getByTestId("set-lesson-2");
    expect(bonusRow).toHaveAttribute("data-locked", "true");
    expect(bonusRow).not.toHaveAttribute("href");
    expect(bonusRow).toHaveAttribute(
      "title",
      expect.stringContaining("at least one star"),
    );
    expect(screen.getByTestId("set-lesson-bonus-badge")).toBeInTheDocument();
    expect(screen.getByTestId("set-lesson-1")).not.toHaveAttribute(
      "data-locked",
    );
  });

  it("unlocks the bonus lesson once every regular lesson has a star", async () => {
    setupBonusSet();
    listProgressMock.mockResolvedValue([progressRow("01.json", "completed")]);
    renderAt("fr-a1");
    await screen.findByTestId("set-lesson-list");
    const bonusRow = screen.getByTestId("set-lesson-2");
    expect(bonusRow).not.toHaveAttribute("data-locked");
    expect(bonusRow).toHaveAttribute("href");
    expect(screen.getByTestId("set-lesson-bonus-badge")).toBeInTheDocument();
  });

  it("with the game mode off the bonus lesson is a normal link", async () => {
    setupBonusSet();
    localStorage.removeItem("adaptive-learner.lesson.playful_mode");
    renderAt("fr-a1");
    await screen.findByTestId("set-lesson-list");
    expect(screen.getByTestId("set-lesson-2")).toHaveAttribute("href");
  });

  it("'Start learning' opens the first REGULAR lesson, not the bonus file", async () => {
    setupBonusSet();
    renderAt("fr-a1");
    await screen.findByTestId("set-deep-link-found");
    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    await waitFor(() =>
      expect(screen.getByTestId("lesson-page")).toBeInTheDocument(),
    );
    expect(notifyWarning).not.toHaveBeenCalled();
  });
});

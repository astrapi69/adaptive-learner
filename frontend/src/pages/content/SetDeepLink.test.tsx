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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentSetEntry } from "../../storage/types";

const listSetsMock = vi.fn();
const listLessonsMock = vi.fn();
const downloadSetMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      listLessons: listLessonsMock,
      downloadSet: downloadSetMock,
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

function renderAt(setId: string) {
  return render(
    <MemoryRouter initialEntries={[`/content/set/${setId}`]}>
      <Routes>
        <Route path="/content/set/:setId" element={<SetDeepLink />} />
        <Route path="/content" element={<div data-testid="content-page" />} />
        <Route
          path="/lesson/:setSlug/:setId/:filename"
          element={<div data-testid="lesson-page" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listSetsMock.mockReset();
  listLessonsMock.mockReset();
  downloadSetMock.mockReset();
  notifyError.mockReset();
  notifyWarning.mockReset();
  listLessonsMock.mockResolvedValue({ lessons: ["01.json", "02.json"] });
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

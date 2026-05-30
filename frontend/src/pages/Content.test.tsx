/**
 * Tests for the Content / Set Browser page
 * (Phase 43 / EXP-002 / 2D — F-100 + F-101).
 *
 * Renders the page against a mocked storage namespace so
 * neither the API client nor the Dexie helper runs. Pins:
 *
 * - Loading state shows the loading testid first.
 * - Sets list renders one row per entry with the
 *   download action button.
 * - "Installed" label appears for already-cached sets.
 * - "Update available" label appears when cached < upstream.
 * - Clicking the download button calls the storage method
 *   with the right (source, set_id).
 * - Empty-state renders when ``listSets`` returns no rows.
 */

import "@testing-library/jest-dom/vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const listSetsMock = vi.fn();
const downloadSetMock = vi.fn();
const deleteSetMock = vi.fn();
const listLessonsMock = vi.fn();

vi.mock("../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      downloadSet: downloadSetMock,
      listLessons: listLessonsMock,
      getLesson: vi.fn(),
      deleteSet: deleteSetMock,
    },
  }),
}));

vi.mock("../utils/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import ContentPage from "./Content";

// source_language "de" matches the i18n fallback app language
// (the test renders without an I18nProvider, so useI18n().lang is
// "de") — so this set lands in the expanded primary tree.
const SAMPLE_ENTRY = {
  source: "astrapi69/adaptive-learner-content",
  branch: "main",
  id: "language-fr-a1",
  title: "French A1",
  title_native: null,
  language: "fr",
  target_language: "fr",
  source_language: "de",
  level: "A1",
  domain: "language",
  version: "1.0.0",
  lesson_count: 12,
  description: "Beginner French lessons.",
  tags: ["beginner"],
  cover_image: null,
  cached_version: null,
  update_available: false,
};

beforeEach(() => {
  listSetsMock.mockReset();
  downloadSetMock.mockReset();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ContentPage />
    </MemoryRouter>,
  );
}

describe("ContentPage", () => {
  it("shows the loading state before the list resolves", () => {
    listSetsMock.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("content-loading")).toBeInTheDocument();
  });

  it("renders each set row after the list resolves", async () => {
    listSetsMock.mockResolvedValue({
      sets: [SAMPLE_ENTRY],
      sources: [{ source: SAMPLE_ENTRY.source, branch: "main" }],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("content-page")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("content-set-language-fr-a1"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("content-set-language-fr-a1-action"),
    ).toHaveTextContent(/Download/i);
  });

  it("shows 'Installed' for cached sets without an update", async () => {
    listSetsMock.mockResolvedValue({
      sets: [
        {
          ...SAMPLE_ENTRY,
          cached_version: "1.0.0",
          update_available: false,
        },
      ],
      sources: [{ source: SAMPLE_ENTRY.source, branch: "main" }],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("content-page")).toBeInTheDocument();
    });
    const action = screen.getByTestId("content-set-language-fr-a1-action");
    expect(action).toHaveTextContent(/Installed/i);
    expect(action).toBeDisabled();
    expect(
      screen.getByTestId("content-set-language-fr-a1-cached"),
    ).toBeInTheDocument();
  });

  it("shows 'Update' for cached sets with a newer upstream", async () => {
    listSetsMock.mockResolvedValue({
      sets: [
        {
          ...SAMPLE_ENTRY,
          cached_version: "0.9.0",
          update_available: true,
        },
      ],
      sources: [{ source: SAMPLE_ENTRY.source, branch: "main" }],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("content-page")).toBeInTheDocument();
    });
    const action = screen.getByTestId("content-set-language-fr-a1-action");
    expect(action).toHaveTextContent(/Update/i);
    expect(action).not.toBeDisabled();
    expect(
      screen.getByTestId("content-set-language-fr-a1-update"),
    ).toBeInTheDocument();
  });

  it("calls downloadSet on action button click", async () => {
    listSetsMock.mockResolvedValue({
      sets: [SAMPLE_ENTRY],
      sources: [{ source: SAMPLE_ENTRY.source, branch: "main" }],
    });
    downloadSetMock.mockResolvedValue({
      ...SAMPLE_ENTRY,
      cached_version: "1.0.0",
      update_available: false,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("content-page")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("content-set-language-fr-a1-action"));
    });
    await waitFor(() => {
      expect(downloadSetMock).toHaveBeenCalledWith(
        "astrapi69/adaptive-learner-content",
        "language-fr-a1",
      );
    });
  });

  it("shows a GitHub source badge for an external set", async () => {
    listSetsMock.mockResolvedValue({
      sets: [SAMPLE_ENTRY],
      sources: [{ source: SAMPLE_ENTRY.source, branch: "main" }],
    });
    renderPage();
    await screen.findByTestId("content-page");
    expect(
      screen.getByTestId("content-set-language-fr-a1-source"),
    ).toHaveTextContent(/GitHub/i);
  });

  it("shows a Bundled source badge for a bundled set", async () => {
    listSetsMock.mockResolvedValue({
      sets: [{ ...SAMPLE_ENTRY, source: "bundled:fr-a1" }],
      sources: [{ source: "bundled:fr-a1", branch: "" }],
    });
    renderPage();
    await screen.findByTestId("content-page");
    expect(
      screen.getByTestId("content-set-language-fr-a1-source"),
    ).toHaveTextContent(/Bundled/i);
  });

  it("renders the empty state when no sets are available", async () => {
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("content-page")).toBeInTheDocument();
    });
    expect(screen.getByTestId("content-empty")).toBeInTheDocument();
  });
});

describe("Content — language-pair tree (Phase 60)", () => {
  beforeEach(() => {
    listSetsMock.mockReset();
  });

  const EN_ENTRY = {
    ...SAMPLE_ENTRY,
    id: "fr-a1-from-en",
    source_language: "en",
    target_language: "fr",
    cached_version: "1.0.0",
  };

  it("renders the source-language tree with an 'I speak' heading", async () => {
    listSetsMock.mockResolvedValue({
      sets: [{ ...SAMPLE_ENTRY, cached_version: "1.0.0" }],
      sources: [],
    });
    renderPage();
    await screen.findByTestId("content-page");
    expect(screen.getByTestId("content-tree")).toBeInTheDocument();
    expect(screen.getByTestId("content-source-primary")).toBeInTheDocument();
    // de-source set is in the expanded primary tree → visible.
    expect(
      screen.getByTestId("content-set-language-fr-a1"),
    ).toBeInTheDocument();
  });

  it("puts a non-matching source language under the collapsed 'other' section", async () => {
    // App language is "de"; this set is en-source → "other",
    // collapsed by default so the row is NOT rendered yet.
    listSetsMock.mockResolvedValue({ sets: [EN_ENTRY], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    expect(screen.getByTestId("content-source-other")).toBeInTheDocument();
    expect(
      screen.queryByTestId("content-set-fr-a1-from-en"),
    ).not.toBeInTheDocument();
    // Expanding the section reveals the en-source set.
    await act(async () => {
      fireEvent.click(screen.getByTestId("content-other-toggle"));
    });
    expect(
      screen.getByTestId("content-set-fr-a1-from-en"),
    ).toBeInTheDocument();
  });

  it("collapses a primary target group when its toggle is clicked", async () => {
    listSetsMock.mockResolvedValue({
      sets: [{ ...SAMPLE_ENTRY, cached_version: "1.0.0" }],
      sources: [],
    });
    renderPage();
    await screen.findByTestId("content-page");
    expect(
      screen.getByTestId("content-set-language-fr-a1"),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("content-target-de/fr-toggle"));
    });
    expect(
      screen.queryByTestId("content-set-language-fr-a1"),
    ).not.toBeInTheDocument();
  });
});

const USER_ENTRY = {
  source: "user-generated",
  branch: "",
  id: "analysis-conv-1",
  title: "My Spanish lesson",
  title_native: null,
  language: "es",
  target_language: "es",
  source_language: "de",
  level: "beginner",
  domain: "analysis",
  version: "1.0.0",
  lesson_count: 1,
  description: "Generated from a chat.",
  tags: [],
  cover_image: null,
  cached_version: "1.0.0",
  update_available: false,
};

describe("Content — My Lessons (Phase 59C)", () => {
  beforeEach(() => {
    listSetsMock.mockReset();
    deleteSetMock.mockReset();
    listLessonsMock.mockReset();
  });

  it("shows the My Lessons empty state when there are no user sets", async () => {
    listSetsMock.mockResolvedValue({
      sets: [
        { ...SAMPLE_ENTRY, cached_version: "1.0.0", update_available: false },
      ],
      sources: [],
    });
    renderPage();
    await screen.findByTestId("content-page");
    expect(screen.getByTestId("content-my-lessons-empty")).toBeInTheDocument();
  });

  it("lists a user lesson (play/edit/delete), separate from downloaded sets", async () => {
    listSetsMock.mockResolvedValue({
      sets: [
        USER_ENTRY,
        { ...SAMPLE_ENTRY, cached_version: "1.0.0", update_available: false },
      ],
      sources: [],
    });
    renderPage();
    await screen.findByTestId("content-page");
    expect(screen.getByTestId("my-lesson-analysis-conv-1")).toBeInTheDocument();
    expect(
      screen.getByTestId("my-lesson-analysis-conv-1-play"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("my-lesson-analysis-conv-1-edit"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("my-lesson-analysis-conv-1-delete"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("my-lesson-analysis-conv-1-export"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("my-lesson-analysis-conv-1-export-set"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("my-lesson-analysis-conv-1-share"),
    ).toBeInTheDocument();
    // The downloaded set renders in the other section.
    expect(
      screen.getByTestId("content-set-language-fr-a1"),
    ).toBeInTheDocument();
    // The user set is NOT duplicated as a downloaded content-set row.
    expect(
      screen.queryByTestId("content-set-analysis-conv-1"),
    ).not.toBeInTheDocument();
  });

  it("hides Edit for non-analysis (adaptive) lessons", async () => {
    listSetsMock.mockResolvedValue({
      sets: [{ ...USER_ENTRY, id: "adaptive-x", domain: "adaptive" }],
      sources: [],
    });
    renderPage();
    await screen.findByTestId("content-page");
    expect(
      screen.queryByTestId("my-lesson-adaptive-x-edit"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("my-lesson-adaptive-x-play")).toBeInTheDocument();
  });

  it("deletes a user lesson after confirmation", async () => {
    listSetsMock.mockResolvedValue({ sets: [USER_ENTRY], sources: [] });
    deleteSetMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByTestId("content-page");
    fireEvent.click(screen.getByTestId("my-lesson-analysis-conv-1-delete"));
    expect(screen.getByTestId("my-lesson-delete-modal")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("my-lesson-delete-confirm"));
    });
    await waitFor(() =>
      expect(deleteSetMock).toHaveBeenCalledWith(
        "user-generated",
        "analysis-conv-1",
      ),
    );
  });

  it("opens the import-lesson modal from the Import button", async () => {
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    expect(screen.queryByTestId("import-lesson-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("content-import-lesson"));
    expect(screen.getByTestId("import-lesson-modal")).toBeInTheDocument();
  });

  it("Share with Community opens a pre-filled GitHub issue", async () => {
    listSetsMock.mockResolvedValue({ sets: [USER_ENTRY], sources: [] });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderPage();
    await screen.findByTestId("content-page");
    fireEvent.click(screen.getByTestId("my-lesson-analysis-conv-1-share"));
    expect(openSpy).toHaveBeenCalled();
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain(
      "github.com/astrapi69/adaptive-learner-content/issues/new",
    );
    expect(new URL(url).searchParams.get("title")).toContain(
      "My Spanish lesson",
    );
    vi.unstubAllGlobals();
  });
});

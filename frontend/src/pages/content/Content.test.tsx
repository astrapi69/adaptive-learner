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

import { PAGE_CONTAINER_CLASSES } from "../../shared/layout/PageContainer";

const listSetsMock = vi.fn();
const downloadSetMock = vi.fn();
const deleteSetMock = vi.fn();
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const aiValidateMock = vi.fn();

vi.mock("../../lib/content/repos/recommended-repos", async (orig) => ({
  ...(await orig<typeof import("../../lib/content/repos/recommended-repos")>()),
  fetchRecommendedRepos: vi.fn(async () => []),
}));

vi.mock("../../storage", () => ({
  resolveStorageMode: () => "api",
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      downloadSet: downloadSetMock,
      listLessons: listLessonsMock,
      getLesson: getLessonMock,
      deleteSet: deleteSetMock,
      aiValidate: aiValidateMock,
      aiValidateCards: vi.fn(),
      getAiValidationCache: vi.fn(async () => null),
      saveAiValidationCache: vi.fn(async () => undefined),
    },
    // ShareWizard reads the GitHub token status on mount to pick the
    // automated-PR vs URL-fallback path. No token here, so these tests
    // exercise the pre-filled-URL flow.
    github: {
      getStatus: async () => ({ configured: false, source: "none" }),
    },
  }),
}));

// Default: no API key (so the AI section is hidden); the AI-flow
// test overrides this to expose the opt-in step.
const apiKeyStatusMock = vi.fn(() => ({
  ready: true,
  hasKey: false,
  activeProvider: null as string | null,
  refresh: vi.fn(),
}));
vi.mock("../../hooks/settings/useApiKeyStatus", () => ({
  useApiKeyStatus: () => apiKeyStatusMock(),
}));
vi.mock("../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "u1" }),
}));

// A schema-valid, quality-passing lesson for the share-flow tests.
function shareableLesson() {
  return {
    id: "01-lektion",
    title: "Lektion",
    estimated_minutes: 10,
    cards: [
      { id: "c1", front: "Bonjour", back: "Guten Tag", tags: [] },
      { id: "c2", front: "Merci", back: "Danke", tags: [] },
      { id: "c3", front: "Salut", back: "Hallo", tags: [] },
    ],
    steps: [
      { id: "intro", type: "theory", body: "# Theorie" },
      {
        id: "m",
        type: "exercise",
        exercise: {
          id: "m",
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
        id: "f",
        type: "exercise",
        exercise: {
          id: "f",
          type: "free_text",
          prompt: "Tippe",
          card_ids: ["c1"],
          accept: ["Bonjour", "bonjour"],
          distractors: ["Salut", "Merci"],
        },
      },
      { id: "t1", type: "exercise", exercise: { id: "t1", type: "word_tiles", prompt: "x", card_ids: ["c1"], tiles: ["Bon", "jour"], distractors: [] } },
      { id: "t2", type: "exercise", exercise: { id: "t2", type: "word_tiles", prompt: "x", card_ids: ["c2"], tiles: ["Mer", "ci"], distractors: [] } },
      { id: "t3", type: "exercise", exercise: { id: "t3", type: "word_tiles", prompt: "x", card_ids: ["c3"], tiles: ["Sa", "lut"], distractors: [] } },
    ],
  };
}

vi.mock("../../utils/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import ContentPage from "./Content";
import { recordContribution } from "../../lib/content/placement/contribution-history";

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
  // #1257 — the global content-view default is now "list". These tests
  // assert the source→target→level TREE (grid view), so pin grid here.
  // The list default itself is covered by Content.viewmode.test.tsx.
  localStorage.setItem("adaptive-learner.content_view_mode", "grid");
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
    getLessonMock.mockReset();
  });

  it("folds a matching user lesson into the tree, out of My Lessons (EXP-026)", async () => {
    const downloaded = {
      ...SAMPLE_ENTRY,
      id: "es-a1-from-de",
      title: "Spanish A1",
      target_language: "es",
      language: "es",
      source_language: "de",
      level: "A1",
      cached_version: "1.0.0",
      update_available: false,
    };
    const mine = {
      ...USER_ENTRY,
      id: "analysis-mine",
      title: "My folded set",
      target_language: "es",
      language: "es",
      source_language: "de",
      level: "A1",
    };
    listSetsMock.mockResolvedValue({ sets: [downloaded, mine], sources: [] });
    // The load effect reads the user set's lessons to fold them.
    listLessonsMock.mockResolvedValue({ lessons: ["ul1.json"] });
    getLessonMock.mockResolvedValue({
      id: "ul1",
      title: "Subjuntivo",
      cards: [],
      steps: [],
      estimated_minutes: 5,
      variation_of: null,
    });

    renderPage();
    await screen.findByTestId("content-page");

    // The lesson folds into the es/A1 node...
    await screen.findByTestId("folded-lesson-ul1");
    expect(screen.getByTestId("folded-lesson-ul1")).toHaveTextContent("Subjuntivo");
    expect(screen.getByTestId("folded-lesson-ul1-badge")).toHaveTextContent("Your lesson");
    // ...carries the shared actions...
    expect(screen.getByTestId("folded-lesson-ul1-play")).toBeInTheDocument();
    expect(screen.getByTestId("folded-lesson-ul1-delete")).toBeInTheDocument();
    // ...shows the "+1 own" count...
    expect(
      screen.getByTestId("content-level-de/es-A1-own-count"),
    ).toHaveTextContent("+1 own");
    // ...and is NOT left in the My Lessons fallback.
    expect(screen.queryByTestId("my-lesson-analysis-mine")).not.toBeInTheDocument();
  });

  it("hides the My Lessons section when there are no user sets (EXP-026 E4)", async () => {
    listSetsMock.mockResolvedValue({
      sets: [
        { ...SAMPLE_ENTRY, cached_version: "1.0.0", update_available: false },
      ],
      sources: [],
    });
    renderPage();
    await screen.findByTestId("content-page");
    // The fallback section is only visible with unplaced drafts (E4).
    expect(screen.queryByTestId("content-my-lessons")).not.toBeInTheDocument();
  });

  it("#1253 — no longer renders the action buttons or the standalone My Lessons section (moved to Import)", async () => {
    listSetsMock.mockResolvedValue({ sets: [USER_ENTRY], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    // The search bar stays in "Meine Inhalte"...
    expect(screen.getByTestId("content-search-input")).toBeInTheDocument();
    // ...but the action buttons moved to the Import tab.
    for (const testId of [
      "content-import-lesson",
      "content-import-chat",
      "content-anki-export",
      "content-learning-path",
      "content-create-lesson",
    ]) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
    // The standalone My Lessons section is gone (an unmatched user set
    // no longer renders here; it lives on the Import tab now).
    expect(screen.queryByTestId("content-my-lessons")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("my-lesson-analysis-conv-1"),
    ).not.toBeInTheDocument();
  });

  it("detects a near-duplicate lesson during the wizard scan", async () => {
    const valid = { ...USER_ENTRY, title_native: "Español A1" };
    // A published set in the same de->es / beginner pair whose lesson
    // shares the same cards triggers the lesson-level duplicate scan.
    const existing = {
      ...SAMPLE_ENTRY,
      source: "astrapi69/adaptive-learner-content",
      id: "es-beginner-from-de",
      title: "My Spanish Lesson",
      target_language: "es",
      source_language: "de",
      level: "beginner",
      cached_version: "1.0.0",
    };
    listSetsMock.mockResolvedValue({ sets: [valid, existing], sources: [] });
    listLessonsMock.mockResolvedValue({ lessons: ["01.json"] });
    // The candidate lesson has the SAME cards but a DIFFERENT id (as
    // an independently-authored lesson would) so the lesson-level scan
    // sees a near-duplicate rather than self-matching it away.
    getLessonMock.mockImplementation((_source: string, setId: string) =>
      Promise.resolve(
        setId === "es-beginner-from-de"
          ? { ...shareableLesson(), id: "existing-lesson" }
          : shareableLesson(),
      ),
    );
    renderPage();
    await screen.findByTestId("content-page");
    // #537 — this user set shares the de->es / beginner pair with the
    // published set above, so EXP-026 folds it INTO the tree node (out of
    // "My Lessons") once its lessons load asynchronously. The previous
    // version clicked the "My Lessons" share button, which races that
    // async fold (the button is removed when the set folds away). Instead
    // wait for the folded row to settle and share from there — it carries
    // the identical UserSetActions/onShare, so the wizard + duplicate scan
    // are exactly the same, but the target is now stable. The folded
    // lesson's id is the shareableLesson() id ("01-lektion").
    await screen.findByTestId("folded-lesson-01-lektion-share");
    await act(async () => {
      fireEvent.click(screen.getByTestId("folded-lesson-01-lektion-share"));
    });
    await screen.findByTestId("share-wizard-step-1");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    expect(
      await screen.findByTestId("share-wizard-duplicate"),
    ).toBeInTheDocument();
    // Near-duplicate (identical cards) offers the supplement option.
    expect(
      screen.getByTestId("share-wizard-mode-supplement"),
    ).toBeInTheDocument();
  });

  it("shows My Contributions from the local sharing history", async () => {
    // #1253 — the actual sharing happens on the Import tab now; the
    // "My Contributions" display stays here and reads the local history.
    localStorage.clear();
    recordContribution({
      lesson_id: "analysis-conv-1",
      title: "My Spanish lesson",
      shared_at: new Date().toISOString(),
      github_url: "https://github.com/x/y/pull/1",
      status: "submitted",
    });
    listSetsMock.mockResolvedValue({ sets: [SAMPLE_ENTRY], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    expect(
      await screen.findByTestId("content-my-contributions"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("content-contributions-count"),
    ).toHaveTextContent("1");
    localStorage.clear();
  });

  it("no longer renders the 'Missing Lessons' gap block (#1149 — moved to /contribute)", async () => {
    // A published de->fr A1 set with no A2 would be a next-level gap, but
    // the gap block now lives in the dedicated /contribute area, not here.
    listSetsMock.mockResolvedValue({ sets: [SAMPLE_ENTRY], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    expect(screen.queryByTestId("content-gaps")).not.toBeInTheDocument();
  });
});

describe("ContentPage — source filter + origin badge (#118)", () => {
  const USER_ENTRY = {
    ...SAMPLE_ENTRY,
    source: "jane/my-content",
    id: "jane-deck",
    title: "Jane's Deck",
    cached_version: "1.0.0",
  };

  it("hides the source filter when only official sets exist", async () => {
    listSetsMock.mockResolvedValue({
      sets: [SAMPLE_ENTRY],
      sources: [{ source: SAMPLE_ENTRY.source, branch: "main" }],
    });
    renderPage();
    await screen.findByTestId("content-page");
    expect(screen.queryByTestId("content-source-filter")).toBeNull();
    // Official sets carry no "Your repo" origin badge.
    expect(screen.queryByTestId("content-set-language-fr-a1-origin")).toBeNull();
  });

  it("badges a user-repo set and filters by source", async () => {
    listSetsMock.mockResolvedValue({
      sets: [SAMPLE_ENTRY, USER_ENTRY],
      sources: [
        { source: SAMPLE_ENTRY.source, branch: "main" },
        { source: USER_ENTRY.source, branch: "main" },
      ],
    });
    renderPage();
    await screen.findByTestId("content-page");

    // The user-repo set carries the origin badge; the official one does not.
    expect(screen.getByTestId("content-set-jane-deck-origin")).toBeInTheDocument();

    // Filtering to "Official" drops the user-repo row from the tree.
    fireEvent.click(screen.getByTestId("content-source-filter-official"));
    await waitFor(() => {
      expect(screen.queryByTestId("content-set-jane-deck")).toBeNull();
    });
    expect(
      screen.getByTestId("content-set-language-fr-a1"),
    ).toBeInTheDocument();

    // Filtering to the specific user repo drops the official row instead.
    fireEvent.click(
      screen.getByTestId("content-source-filter-jane/my-content"),
    );
    await waitFor(() => {
      expect(screen.queryByTestId("content-set-language-fr-a1")).toBeNull();
    });
    expect(screen.getByTestId("content-set-jane-deck")).toBeInTheDocument();
  });
});

describe("shared page container (#1380)", () => {
  it("renders the page inside the shared PageContainer, with no deviating wrapper", async () => {
    listSetsMock.mockResolvedValue({
      sets: [SAMPLE_ENTRY],
      sources: [{ source: SAMPLE_ENTRY.source, branch: "main" }],
    });
    renderPage();
    const main = await screen.findByTestId("content-page");
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveAttribute("data-slot", "page-container");
    // Exact match: the canonical container set only — no per-tab
    // special widths and no legacy dead classes (page/content-page).
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });

  it("renders the loading state inside the same shared container", () => {
    listSetsMock.mockImplementation(() => new Promise(() => {}));
    renderPage();
    const main = screen.getByTestId("content-loading");
    expect(main).toHaveAttribute("data-slot", "page-container");
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });
});

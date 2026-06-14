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
const getLessonMock = vi.fn();
const aiValidateMock = vi.fn();

vi.mock("../lib/content/recommended-repos", async (orig) => ({
  ...(await orig<typeof import("../lib/content/recommended-repos")>()),
  fetchRecommendedRepos: vi.fn(async () => []),
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      downloadSet: downloadSetMock,
      listLessons: listLessonsMock,
      getLesson: getLessonMock,
      deleteSet: deleteSetMock,
      aiValidate: aiValidateMock,
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
vi.mock("../hooks/useApiKeyStatus", () => ({
  useApiKeyStatus: () => apiKeyStatusMock(),
}));
vi.mock("../lib/learnerState", () => ({
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
    getLessonMock.mockReset();
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

  it("renders the search bar before the action toolbar (search-first)", async () => {
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    const search = screen.getByTestId("content-search-bar");
    const importBtn = screen.getByTestId("content-import-lesson");
    // Search sits before the action buttons in document order.
    expect(
      search.compareDocumentPosition(importBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("toolbar action buttons are icon-only on mobile (label hidden below md)", async () => {
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    const importBtn = screen.getByTestId("content-import-lesson");
    // Icon always present (an inline svg).
    expect(importBtn.querySelector("svg")).toBeInTheDocument();
    // The text label is rendered but CSS-hidden until md.
    const label = importBtn.querySelector("span.hidden");
    expect(label).not.toBeNull();
    expect(label).toHaveClass("md:inline");
    expect(label).toHaveTextContent(/Import Lesson/i);
    // Accessible name survives even when the label is visually hidden.
    expect(importBtn).toHaveAccessibleName(/Import Lesson/i);
  });

  it("secondary toolbar actions use the outline variant so they stay visible in dark themes (#177)", async () => {
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    // The surface-less ghost variant read as nearly invisible in dark
    // themes; outline gives a bordered surface (border-input +
    // bg-background) while keeping AA text-foreground.
    for (const testId of [
      "content-import-lesson",
      "content-import-chat",
      "content-learning-path",
    ]) {
      const btn = screen.getByTestId(testId);
      expect(btn.className).toContain("border");
      expect(btn.className).toContain("text-foreground");
    }
    // The primary CTA stays dominant (no border-* surface utility).
    expect(
      screen.getByTestId("content-create-lesson").className,
    ).toContain("bg-primary");
  });

  it("walks the wizard and shares a flagged lesson anyway", async () => {
    // USER_ENTRY: no title_native + a trivial lesson -> rule check
    // flags issues. The wizard's quality step is informational; the
    // user can still reach the share step, and the findings land in
    // the pull-request body (the create-file ``description`` param).
    listSetsMock.mockResolvedValue({ sets: [USER_ENTRY], sources: [] });
    listLessonsMock.mockResolvedValue({ lessons: ["01.json"] });
    getLessonMock.mockResolvedValue({
      id: "01",
      title: "x",
      estimated_minutes: 10,
      cards: [{ id: "c", front: "a", back: "b", tags: [] }],
      // One exercise so it clears the new empty-lesson gate, but a
      // single exercise / type still fails the quality minimums -> the
      // share-anyway path stays exercised.
      steps: [
        { id: "s", type: "theory", body: "x" },
        {
          id: "ex",
          type: "exercise",
          exercise: {
            id: "ex",
            type: "free_text",
            prompt: "p",
            card_ids: ["c"],
            accept: ["a"],
            distractors: [],
          },
        },
      ],
    });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderPage();
    await screen.findByTestId("content-page");
    await act(async () => {
      fireEvent.click(screen.getByTestId("my-lesson-analysis-conv-1-share"));
    });
    await screen.findByTestId("share-wizard-step-1");
    // Step 1 -> 2: no published set in this pair -> unique.
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    await screen.findByTestId("share-wizard-unique");
    // Step 2 -> 3: quality issues, but share-anyway is allowed.
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    expect(screen.getByTestId("share-wizard-quality-issues")).toBeInTheDocument();
    // Step 3 -> 4 -> share.
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-share"));
    expect(openSpy).toHaveBeenCalled();
    const url = openSpy.mock.calls[0][0] as string;
    // Small flagged lesson still uses the PR fast lane; the findings
    // ride in the pre-filled PR body (``description`` param), not an
    // issue body.
    expect(url).toContain("/new/main?");
    const body = new URL(url).searchParams.get("description") ?? "";
    expect(body).toContain("⚠ shared with warnings");
    expect(body).toContain("Quality-check findings");
    // Celebration shown after sharing.
    expect(screen.getByTestId("share-wizard-celebration")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("auto-computes placement and opens the PR fast lane for a clean lesson", async () => {
    const valid = { ...USER_ENTRY, title_native: "Español A1" };
    listSetsMock.mockResolvedValue({ sets: [valid], sources: [] });
    listLessonsMock.mockResolvedValue({ lessons: ["01.json"] });
    getLessonMock.mockResolvedValue(shareableLesson());
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderPage();
    await screen.findByTestId("content-page");
    await act(async () => {
      fireEvent.click(screen.getByTestId("my-lesson-analysis-conv-1-share"));
    });
    await screen.findByTestId("share-wizard-step-1");
    // Step 1 shows the auto-computed placement. The saved non-CEFR
    // "beginner" level is corrected to a CEFR estimate (A1) by the
    // editable Step-1 form (BUG C), so the placement lands under es-a1.
    expect(screen.getByTestId("share-wizard-placement")).toHaveTextContent(
      "sets/de/es-a1",
    );
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    await screen.findByTestId("share-wizard-unique");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    expect(screen.getByTestId("share-wizard-quality-ok")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-share"));
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toMatch(
      /github\.com\/astrapi69\/adaptive-learner-content\/new\/main\?/,
    );
    const qs = new URL(url).searchParams;
    expect(qs.get("filename")).toContain("sets/de/es-a1/lessons/");
    const value = qs.get("value") ?? "";
    expect(value).toContain('"title"');
    expect(value).toContain('"cards"');
    vi.unstubAllGlobals();
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
    await act(async () => {
      fireEvent.click(screen.getByTestId("my-lesson-analysis-conv-1-share"));
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

  it("offers opt-in AI validation in the quality step", async () => {
    apiKeyStatusMock.mockReturnValue({
      ready: true,
      hasKey: true,
      activeProvider: "anthropic",
      refresh: vi.fn(),
    });
    const valid = { ...USER_ENTRY, title_native: "Español A1" };
    listSetsMock.mockResolvedValue({ sets: [valid], sources: [] });
    listLessonsMock.mockResolvedValue({ lessons: ["01.json"] });
    getLessonMock.mockResolvedValue(shareableLesson());
    aiValidateMock.mockResolvedValue({
      overall: "review_needed",
      translation_issues: [
        { card_id: "c1", issue: "schould be Guten Morgen", suggestion: "Guten Morgen" },
      ],
      distractor_issues: [],
      grammar_issues: [],
      level_issues: [],
      cultural_flags: [],
      quality_score: 0.78,
    });
    renderPage();
    await screen.findByTestId("content-page");
    await act(async () => {
      fireEvent.click(screen.getByTestId("my-lesson-analysis-conv-1-share"));
    });
    await screen.findByTestId("share-wizard-step-1");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    await screen.findByTestId("share-wizard-unique");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    // AI section lives in the quality step (key present).
    expect(screen.getByTestId("content-ai-validation")).toBeInTheDocument();
    const runBtn = screen.getByTestId("content-ai-run");
    expect(runBtn).toBeDisabled();
    fireEvent.click(screen.getByTestId("content-ai-consent"));
    expect(runBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(runBtn);
    });
    await screen.findByTestId("content-ai-result");
    expect(aiValidateMock).toHaveBeenCalled();
    expect(screen.getByTestId("content-ai-issues")).toHaveTextContent(
      "Guten Morgen",
    );
    apiKeyStatusMock.mockReturnValue({
      ready: true,
      hasKey: false,
      activeProvider: null,
      refresh: vi.fn(),
    });
  });

  it("records a contribution and shows My Contributions after sharing", async () => {
    localStorage.clear();
    const valid = { ...USER_ENTRY, title_native: "Español A1" };
    listSetsMock.mockResolvedValue({ sets: [valid], sources: [] });
    listLessonsMock.mockResolvedValue({ lessons: ["01.json"] });
    getLessonMock.mockResolvedValue(shareableLesson());
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderPage();
    await screen.findByTestId("content-page");
    await act(async () => {
      fireEvent.click(screen.getByTestId("my-lesson-analysis-conv-1-share"));
    });
    await screen.findByTestId("share-wizard-step-1");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    await screen.findByTestId("share-wizard-unique");
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-next"));
    fireEvent.click(screen.getByTestId("share-wizard-share"));
    // The page now shows the local contribution history.
    expect(
      await screen.findByTestId("content-my-contributions"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("content-contributions-count"),
    ).toHaveTextContent("1");
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("surfaces encouraging gap suggestions for missing levels", async () => {
    // A published de->fr A1 set with no A2 -> a next-level gap.
    listSetsMock.mockResolvedValue({ sets: [SAMPLE_ENTRY], sources: [] });
    renderPage();
    await screen.findByTestId("content-page");
    expect(await screen.findByTestId("content-gaps")).toBeInTheDocument();
    const list = screen.getByTestId("content-gaps-list");
    // The next missing CEFR level (A2) is suggested.
    expect(list).toHaveTextContent("A2");
    expect(list.querySelectorAll("li").length).toBeGreaterThan(0);
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

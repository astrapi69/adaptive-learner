/**
 * Tests for the /contribute page (#1149).
 *
 * The "Missing Lessons" gap block moved out of "Meine Inhalte" into this
 * dedicated contribution area. Pins:
 *   - the gap block renders here (the same ``content-gaps`` block, fed by
 *     the unchanged ``detectGaps`` detector);
 *   - the empty state shows when the library has no gaps;
 *   - user-generated sets are excluded from the gap source.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const listSetsMock = vi.fn();

vi.mock("../../storage", () => ({
  resolveStorageMode: () => "api",
  getStorage: () => ({
    contentLoader: { listSets: listSetsMock },
  }),
}));

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import Contribute from "./Contribute";

// de-source A1 set with no A2 -> detectGaps reports a next-level gap.
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
  cached_version: "1.0.0",
  update_available: false,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Contribute />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listSetsMock.mockReset();
});

describe("Contribute page", () => {
  it("renders the 'Missing Lessons' gap block for a library with gaps", async () => {
    listSetsMock.mockResolvedValue({ sets: [SAMPLE_ENTRY], sources: [] });
    renderPage();
    await screen.findByTestId("contribute-page");
    expect(await screen.findByTestId("content-gaps")).toBeInTheDocument();
    const list = screen.getByTestId("content-gaps-list");
    // The next missing CEFR level (A2) is suggested.
    expect(list).toHaveTextContent("A2");
    expect(list.querySelectorAll("li").length).toBeGreaterThan(0);
  });

  it("shows the empty state when the library has no gaps", async () => {
    listSetsMock.mockResolvedValue({ sets: [], sources: [] });
    renderPage();
    await screen.findByTestId("contribute-page");
    expect(screen.getByTestId("contribute-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("content-gaps")).not.toBeInTheDocument();
  });

  it("excludes user-generated sets from the gap source", async () => {
    // Only a user-generated set is present -> no community-library gaps.
    listSetsMock.mockResolvedValue({
      sets: [
        {
          ...SAMPLE_ENTRY,
          source: "user-generated",
          id: "analysis-mine",
          domain: "analysis",
        },
      ],
      sources: [],
    });
    renderPage();
    await screen.findByTestId("contribute-page");
    await waitFor(() => {
      expect(screen.getByTestId("contribute-empty")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("content-gaps")).not.toBeInTheDocument();
  });
});

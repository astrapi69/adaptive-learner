/**
 * ContentSetListView (#1240) — compact list rows.
 *
 * Pins the language-vs-knowledge distinction (via ``isKnowledgeDomain``):
 *  - a language set row shows the title PLUS the language codes,
 *  - a knowledge-domain set row shows ONLY the title (no codes).
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContentSetEntry } from "../../../storage/types";
import ContentSetListView from "./ContentSetListView";
import { setDevModeEnabled } from "../../../hooks/settings/useDevMode";
import { getBuildInfo } from "../../../lib/provenance/build-info";

vi.mock("../../../lib/provenance/build-info", () => ({
  getBuildInfo: vi.fn(() => ({ strang: "unknown" })),
}));

const mockedGetBuildInfo = vi.mocked(getBuildInfo);

function setStrang(strang: "latest" | "haupt" | "unknown") {
  mockedGetBuildInfo.mockReturnValue({ strang } as ReturnType<typeof getBuildInfo>);
}

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
  return {
    source: "astrapi69/adaptive-learner-content",
    branch: "main",
    id: "set-id",
    title: "Untitled",
    title_native: null,
    language: "en",
    target_language: "en",
    source_language: "de",
    level: "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 5,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    ...over,
  };
}

function renderList(sets: ContentSetEntry[]) {
  render(
    <MemoryRouter>
      <ContentSetListView sets={sets} />
    </MemoryRouter>,
  );
}

describe("ContentSetListView", () => {
  it("renders one row per set", () => {
    renderList([
      entry({ id: "a", title: "Set A" }),
      entry({ id: "b", title: "Set B" }),
    ]);
    expect(screen.getByTestId("content-list-view")).toBeInTheDocument();
    expect(screen.getByTestId("content-list-set-a")).toHaveTextContent("Set A");
    expect(screen.getByTestId("content-list-set-b")).toHaveTextContent("Set B");
  });

  it("shows title + language codes for a language set", () => {
    renderList([
      entry({ id: "lang", title: "English A1", source_language: "de", target_language: "en", domain: "language" }),
    ]);
    const langs = screen.getByTestId("content-list-set-lang-langs");
    expect(langs).toHaveTextContent("de");
    expect(langs).toHaveTextContent("en");
  });

  it("shows ONLY the title for a knowledge-domain set (no language codes)", () => {
    renderList([
      entry({ id: "know", title: "Psychologie", domain: "psychology", source_language: "de", target_language: "de" }),
    ]);
    expect(screen.getByTestId("content-list-set-know")).toHaveTextContent("Psychologie");
    expect(screen.queryByTestId("content-list-set-know-langs")).not.toBeInTheDocument();
  });

  it("links each row to the single-set deep link", () => {
    renderList([entry({ id: "deep", title: "Deep" })]);
    expect(screen.getByTestId("content-list-set-deep")).toHaveAttribute(
      "href",
      "/content/set/deep",
    );
  });

  // #1298 — the Dev-Mode download-date readout (the #1259 diagnostic, which
  // only landed on the Learning Path SetRow) must ALSO show here, the list
  // view of "Meine Inhalte" → Heruntergeladene Sets.
  describe("Dev-Mode download-date readout (#1298)", () => {
    afterEach(() => {
      setDevModeEnabled(false);
      setStrang("unknown");
      localStorage.clear();
    });

    it("shows downloaded_at when Dev Mode is ON", () => {
      setDevModeEnabled(true);
      renderList([entry({ id: "a", downloaded_at: "2026-06-20T00:00:00.000Z" })]);
      expect(screen.getByTestId("content-list-set-a-downloaded-at")).toHaveTextContent(
        "downloaded_at: 2026-06-20T00:00:00.000Z",
      );
    });

    it("does NOT show downloaded_at when Dev Mode is OFF (no leak)", () => {
      setDevModeEnabled(false);
      renderList([entry({ id: "a", downloaded_at: "2026-06-20T00:00:00.000Z" })]);
      expect(screen.queryByTestId("content-list-set-a-downloaded-at")).toBeNull();
    });

    it("renders 'null' when downloaded_at is missing (old set, no crash)", () => {
      setDevModeEnabled(true);
      renderList([entry({ id: "a" })]);
      expect(screen.getByTestId("content-list-set-a-downloaded-at")).toHaveTextContent(
        "downloaded_at: null",
      );
    });

    it("shows downloaded_at per default in the Latest strand (#1273)", () => {
      localStorage.clear();
      setStrang("latest");
      renderList([entry({ id: "a", downloaded_at: "2026-06-20T00:00:00.000Z" })]);
      expect(
        screen.getByTestId("content-list-set-a-downloaded-at"),
      ).toBeInTheDocument();
    });
  });
});

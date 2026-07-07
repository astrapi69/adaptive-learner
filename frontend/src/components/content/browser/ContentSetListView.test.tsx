/**
 * ContentSetListView (#1240) — compact list rows.
 *
 * Pins the language-vs-knowledge distinction (via ``isKnowledgeDomain``):
 *  - a language set row shows the title PLUS the language codes,
 *  - a knowledge-domain set row shows ONLY the title (no codes).
 */

import { render, screen, fireEvent } from "@testing-library/react";
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

  // #1392 — long titles must not push the language badge / actions menu out
  // of the viewport (same class as #1328/#1329: a flex-1 item without
  // min-w-0 can never shrink below its content, so the nested truncate is
  // inert). happy-dom has no layout engine, so we pin the structural
  // containment classes + the sibling structure that keeps the menu button
  // in one flush right-hand column.
  describe("long-title overflow containment (#1392)", () => {
    const LONG = "Portugiesisch (Brasilianisch) A1 (für Deutschsprachige)";

    function renderLongRowWithMenu(over: Partial<ContentSetEntry> = {}) {
      render(
        <MemoryRouter>
          <ContentSetListView
            sets={[entry({ id: "pt-br", title: LONG, ...over })]}
            onSetStatus={vi.fn()}
            onDelete={vi.fn()}
          />
        </MemoryRouter>,
      );
    }

    it("keeps the row link shrinkable (min-w-0) and truncates the title", () => {
      renderLongRowWithMenu();
      const link = screen.getByTestId("content-list-set-pt-br");
      expect(link.className).toContain("min-w-0");
      const title = screen.getByText(LONG);
      expect(title.className).toContain("truncate");
    });

    it("exposes the full title via a native tooltip", () => {
      renderLongRowWithMenu();
      expect(screen.getByTitle(LONG)).toBeInTheDocument();
    });

    it("keeps the language badge visible and non-shrinking on a long title", () => {
      renderLongRowWithMenu({ source_language: "de", target_language: "pt" });
      const langs = screen.getByTestId("content-list-set-pt-br-langs");
      expect(langs).toBeInTheDocument();
      expect(langs.className).toContain("shrink-0");
    });

    it("keeps the actions menu a non-shrinking sibling of the link (one flush column)", () => {
      renderLongRowWithMenu();
      const link = screen.getByTestId("content-list-set-pt-br");
      const trigger = screen.getByTestId("set-actions-pt-br");
      // The menu wrapper sits NEXT TO the link in the same flex row (not
      // inside it), so with a shrinkable link every row's menu lands at the
      // same right edge regardless of title length.
      const menuWrapper = trigger.parentElement as HTMLElement;
      expect(menuWrapper.className).toContain("shrink-0");
      expect(menuWrapper.parentElement).toBe(link.parentElement);
      expect((link.parentElement as HTMLElement).className).toContain("flex");
    });

    it("leaves a short title fully rendered (no regression)", () => {
      render(
        <MemoryRouter>
          <ContentSetListView
            sets={[entry({ id: "short", title: "Spanish A2" })]}
            onSetStatus={vi.fn()}
            onDelete={vi.fn()}
          />
        </MemoryRouter>,
      );
      expect(screen.getByText("Spanish A2")).toBeInTheDocument();
      expect(screen.getByTestId("content-list-set-short").className).toContain("min-w-0");
    });
  });

  // #1300 — the per-set overflow menu (status + delete) appears in the list
  // view when handlers are supplied, and never otherwise.
  describe("status/delete overflow menu (#1300)", () => {
    it("hides the menu when no handlers are supplied", () => {
      renderList([entry({ id: "a", status: "active" })]);
      expect(screen.queryByTestId("set-actions-a")).toBeNull();
    });

    it("renders the menu and wires the status action", () => {
      const onSetStatus = vi.fn();
      const onDelete = vi.fn();
      render(
        <MemoryRouter>
          <ContentSetListView
            sets={[entry({ id: "a", status: "active" })]}
            onSetStatus={onSetStatus}
            onDelete={onDelete}
          />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByTestId("set-actions-a"));
      fireEvent.click(screen.getByTestId("set-action-a-completed"));
      expect(onSetStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a" }),
        "completed",
      );
    });
  });
});

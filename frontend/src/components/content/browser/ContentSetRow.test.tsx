/**
 * ContentSetRow (#1298) — the grid (rich tree) row of "Meine Inhalte"
 * → Heruntergeladene Sets.
 *
 * Pins the Dev-Mode ``downloaded_at`` readout (the #1259 diagnostic,
 * which only landed on the Learning Path SetRow) so it ALSO shows in
 * the default grid view here, and never leaks to normal users.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContentSetEntry } from "../../../storage/types";
import ContentSetRow from "./ContentSetRow";
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
    id: "psych",
    title: "Psychologie",
    title_native: null,
    language: "de",
    target_language: "de",
    source_language: "de",
    level: "A1",
    domain: "psychology",
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

function renderRow(over: Partial<ContentSetEntry> = {}) {
  render(
    <MemoryRouter>
      <ul>
        <ContentSetRow
          entry={entry(over)}
          downloadState="done"
          online={true}
          repoMeta={{}}
          recommendedSources={new Set()}
          onOpen={vi.fn()}
          onDownload={vi.fn()}
        />
      </ul>
    </MemoryRouter>,
  );
}

describe("ContentSetRow Dev-Mode download-date readout (#1298)", () => {
  afterEach(() => {
    setDevModeEnabled(false);
    setStrang("unknown");
    localStorage.clear();
  });

  it("shows downloaded_at when Dev Mode is ON", () => {
    setDevModeEnabled(true);
    renderRow({ downloaded_at: "2026-06-20T00:00:00.000Z" });
    expect(screen.getByTestId("content-set-psych-downloaded-at")).toHaveTextContent(
      "downloaded_at: 2026-06-20T00:00:00.000Z",
    );
  });

  it("does NOT show downloaded_at when Dev Mode is OFF (no leak)", () => {
    setDevModeEnabled(false);
    renderRow({ downloaded_at: "2026-06-20T00:00:00.000Z" });
    expect(screen.queryByTestId("content-set-psych-downloaded-at")).toBeNull();
  });

  it("renders 'null' when downloaded_at is missing (old set, no crash)", () => {
    setDevModeEnabled(true);
    renderRow({});
    expect(screen.getByTestId("content-set-psych-downloaded-at")).toHaveTextContent(
      "downloaded_at: null",
    );
  });

  it("shows downloaded_at per default in the Latest strand (#1273)", () => {
    localStorage.clear();
    setStrang("latest");
    renderRow({ downloaded_at: "2026-06-20T00:00:00.000Z" });
    expect(screen.getByTestId("content-set-psych-downloaded-at")).toBeInTheDocument();
  });
});

// #1392 — the grid (tile) heading must contain long titles the same way the
// list view does: the title text truncates (ellipsis + native tooltip) while
// the inline source/origin badges stay visible and non-shrinking. happy-dom
// has no layout engine, so we pin the structural containment classes.
describe("ContentSetRow long-title containment (#1392)", () => {
  const LONG = "Portugiesisch (Brasilianisch) A1 (für Deutschsprachige)";

  it("truncates a long title with a native tooltip and keeps the heading shrinkable", () => {
    renderRow({ id: "pt-br", title: LONG });
    const title = screen.getByTitle(LONG);
    expect(title.className).toContain("truncate");
    expect(title.className).toContain("min-w-0");
    // The heading itself must be allowed to shrink inside the flex title row.
    const heading = title.closest("h4") as HTMLElement;
    expect(heading).not.toBeNull();
    expect(heading.className).toContain("min-w-0");
  });

  it("keeps the source badge visible and non-shrinking on a long title", () => {
    renderRow({ id: "pt-br", title: LONG });
    const source = screen.getByTestId("content-set-pt-br-source");
    expect(source).toBeInTheDocument();
    expect(source.className).toContain("shrink-0");
  });

  it("keeps the origin/trust badges non-shrinking for a user-repo set", () => {
    render(
      <MemoryRouter>
        <ul>
          <ContentSetRow
            entry={entry({ id: "pt-br", title: LONG, source: "coach/repo" })}
            downloadState="done"
            online={true}
            repoMeta={{ "coach/repo": { trust: 1, coach: true } }}
            recommendedSources={new Set()}
            onOpen={vi.fn()}
            onDownload={vi.fn()}
          />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("content-set-pt-br-origin").className).toContain("shrink-0");
    expect(screen.getByTestId("content-set-pt-br-trust").className).toContain("shrink-0");
  });

  it("leaves a short title fully rendered (no regression)", () => {
    renderRow({ id: "short", title: "Psychologie" });
    expect(screen.getByText("Psychologie")).toBeInTheDocument();
    expect(screen.getByTitle("Psychologie")).toBeInTheDocument();
  });
});

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

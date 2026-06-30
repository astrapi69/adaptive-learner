/**
 * DownloadedAtReadout (#1298) — the shared Dev-Mode-gated
 * ``downloaded_at`` diagnostic line, extracted from #1259's
 * ``learning-path/SetRow`` so the Learning Path AND the "Meine
 * Inhalte" downloaded-set views render it identically.
 *
 * Pins: visible only in Dev Mode; renders the ISO timestamp;
 * ``null`` when the field is missing (no crash); strand default
 * (#1271) — visible in Latest, hidden in Haupt.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DownloadedAtReadout from "./DownloadedAtReadout";
import { setDevModeEnabled } from "../../hooks/settings/useDevMode";
import { getBuildInfo } from "../../lib/provenance/build-info";

vi.mock("../../lib/provenance/build-info", () => ({
  getBuildInfo: vi.fn(() => ({ strang: "unknown" })),
}));

const mockedGetBuildInfo = vi.mocked(getBuildInfo);

function setStrang(strang: "latest" | "haupt" | "unknown") {
  mockedGetBuildInfo.mockReturnValue({ strang } as ReturnType<typeof getBuildInfo>);
}

describe("DownloadedAtReadout", () => {
  afterEach(() => {
    setDevModeEnabled(false);
    setStrang("unknown");
    localStorage.clear();
  });

  it("shows the ISO timestamp when Dev Mode is ON", () => {
    setDevModeEnabled(true);
    render(
      <DownloadedAtReadout downloadedAt="2026-06-20T00:00:00.000Z" testId="readout" />,
    );
    expect(screen.getByTestId("readout")).toHaveTextContent(
      "downloaded_at: 2026-06-20T00:00:00.000Z",
    );
  });

  it("renders 'null' when downloaded_at is missing (no crash)", () => {
    setDevModeEnabled(true);
    render(<DownloadedAtReadout downloadedAt={null} testId="readout" />);
    expect(screen.getByTestId("readout")).toHaveTextContent("downloaded_at: null");
  });

  it("renders 'null' when downloaded_at is undefined (old set, no field)", () => {
    setDevModeEnabled(true);
    render(<DownloadedAtReadout testId="readout" />);
    expect(screen.getByTestId("readout")).toHaveTextContent("downloaded_at: null");
  });

  it("renders nothing when Dev Mode is OFF (no leak)", () => {
    setDevModeEnabled(false);
    render(
      <DownloadedAtReadout downloadedAt="2026-06-20T00:00:00.000Z" testId="readout" />,
    );
    expect(screen.queryByTestId("readout")).toBeNull();
  });

  it("shows per default in the Latest strand (no explicit choice)", () => {
    localStorage.clear();
    setStrang("latest");
    render(
      <DownloadedAtReadout downloadedAt="2026-06-20T00:00:00.000Z" testId="readout" />,
    );
    expect(screen.getByTestId("readout")).toBeInTheDocument();
  });

  it("hides per default in the Haupt strand (no explicit choice)", () => {
    localStorage.clear();
    setStrang("haupt");
    render(
      <DownloadedAtReadout downloadedAt="2026-06-20T00:00:00.000Z" testId="readout" />,
    );
    expect(screen.queryByTestId("readout")).toBeNull();
  });
});

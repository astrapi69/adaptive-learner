/**
 * SetShareButton (#1572) — the per-set "Share" button + QR modal.
 *
 * Pins: the button renders with an accessible label; clicking it opens the
 * QR modal carrying the correct ``…/add-repo?url=…&branch=…&set=…`` deep
 * link; the link NEVER carries a token (security); copy writes the link to
 * the clipboard and reports the "Link copied" feedback.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: { toDataURL: () => Promise.resolve("data:image/png;base64,QQ==") },
}));
const { notify } = vi.hoisted(() => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../utils/notify", () => ({ notify }));

import SetShareButton from "./SetShareButton";
import type { ContentSetEntry } from "../../../storage/types";

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
  return {
    source: "coach/deck",
    branch: "dev",
    id: "coach/lesson-1",
    title: "Coach Deck",
    language: "de",
    target_language: "de",
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

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe("SetShareButton (#1572)", () => {
  it("renders a share button labelled with the set title", () => {
    render(<SetShareButton entry={entry()} />);
    const btn = screen.getByTestId("set-share-coach/lesson-1");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-label", expect.stringContaining("Coach Deck"));
  });

  it("opens the QR modal with the set deep link on click", async () => {
    render(<SetShareButton entry={entry()} />);
    fireEvent.click(screen.getByTestId("set-share-coach/lesson-1"));
    const url = await screen.findByTestId("set-share-modal-url");
    const parsed = new URL(url.textContent ?? "");
    expect(parsed.pathname).toContain("add-repo");
    expect(parsed.searchParams.get("url")).toBe("coach/deck");
    expect(parsed.searchParams.get("branch")).toBe("dev");
    expect(parsed.searchParams.get("set")).toBe("coach/lesson-1");
  });

  it("never carries a token in the generated link (security)", async () => {
    render(<SetShareButton entry={entry({ source: "coach/private" })} />);
    fireEvent.click(screen.getByTestId("set-share-coach/lesson-1"));
    const url = await screen.findByTestId("set-share-modal-url");
    expect((url.textContent ?? "").toLowerCase()).not.toContain("token");
    expect([...new URL(url.textContent ?? "").searchParams.keys()].sort()).toEqual([
      "branch",
      "set",
      "url",
    ]);
  });

  it("copies the link and shows the copied feedback", async () => {
    render(<SetShareButton entry={entry()} />);
    fireEvent.click(screen.getByTestId("set-share-coach/lesson-1"));
    fireEvent.click(await screen.findByTestId("set-share-modal-copy"));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("set=coach%2Flesson-1"),
      ),
    );
    expect(notify.success).toHaveBeenCalled();
  });
});

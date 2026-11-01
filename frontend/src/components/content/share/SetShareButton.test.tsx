/**
 * SetShareButton (#1572) — the per-set "Share" button + QR modal.
 *
 * Pins: the button renders with an accessible label; clicking it opens the
 * QR modal carrying the short ``…/content/set/<id>`` link when the recipient
 * can resolve the set (#3819), else the ``…/add-repo?repo=…&branch=…&set=…``
 * deep link; the link NEVER carries a token (security); copy writes the link
 * to the clipboard and reports the "Link copied" feedback.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: { toDataURL: () => Promise.resolve("data:image/png;base64,QQ==") },
}));
const { notify } = vi.hoisted(() => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../utils/notify", () => ({ notify }));
const { findSetInRegistry } = vi.hoisted(() => ({ findSetInRegistry: vi.fn() }));
vi.mock("../../../lib/content/repos/registry-set-lookup", () => ({ findSetInRegistry }));

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
  findSetInRegistry.mockResolvedValue({ status: "absent" });
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

  it("opens the QR modal with the add-repo link for a set outside the registry", async () => {
    render(<SetShareButton entry={entry()} />);
    fireEvent.click(screen.getByTestId("set-share-coach/lesson-1"));
    const url = await screen.findByTestId("set-share-modal-url");
    const parsed = new URL(url.textContent ?? "");
    expect(parsed.pathname).toContain("add-repo");
    expect(parsed.searchParams.get("repo")).toBe("coach/deck");
    expect(parsed.searchParams.get("branch")).toBe("dev");
    expect(parsed.searchParams.get("set")).toBe("coach/lesson-1");
    expect(screen.getByTestId("set-share-modal-note")).toHaveTextContent("PUBLIC repository");
  });

  it("opens the QR modal with the short link for a set the registry lists (#3819)", async () => {
    findSetInRegistry.mockResolvedValue({
      status: "found",
      set: { id: "ki-einsteiger-from-de" },
      repo: { url: "https://github.com/astrapi69/alc-ai", branch: "main" },
    });
    render(
      <SetShareButton
        entry={entry({ source: "astrapi69/alc-ai", branch: "main", id: "ki-einsteiger-from-de" })}
      />,
    );
    fireEvent.click(screen.getByTestId("set-share-ki-einsteiger-from-de"));
    const url = await screen.findByTestId("set-share-modal-url");
    expect(new URL(url.textContent ?? "").pathname).toMatch(/\/content\/set\/ki-einsteiger-from-de$/);
    expect(findSetInRegistry).toHaveBeenCalledWith("ki-einsteiger-from-de");
    expect(screen.getByTestId("set-share-modal-note")).toHaveTextContent(
      "stays valid as long as the set keeps its id",
    );
  });

  it("never carries a token in the generated link (security)", async () => {
    render(<SetShareButton entry={entry({ source: "coach/private" })} />);
    fireEvent.click(screen.getByTestId("set-share-coach/lesson-1"));
    const url = await screen.findByTestId("set-share-modal-url");
    expect((url.textContent ?? "").toLowerCase()).not.toContain("token");
    expect([...new URL(url.textContent ?? "").searchParams.keys()].sort()).toEqual([
      "branch",
      "repo",
      "set",
    ]);
  });

  it("copies the link and shows the copied feedback", async () => {
    render(<SetShareButton entry={entry()} />);
    fireEvent.click(screen.getByTestId("set-share-coach/lesson-1"));
    fireEvent.click(await screen.findByTestId("set-share-modal-copy"));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("set=coach/lesson-1"),
      ),
    );
    expect(notify.success).toHaveBeenCalled();
  });
});

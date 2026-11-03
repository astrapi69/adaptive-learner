/**
 * Tests for the card a short set link shows for a set of a repo the learner
 * has not added yet (#3819).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchableSet } from "../../lib/content/repos/search-index-loader";
import type { ContentSetEntry } from "../../storage/types";

const { connectPublicRepo, listSets } = vi.hoisted(() => ({
  connectPublicRepo: vi.fn(),
  listSets: vi.fn(),
}));
vi.mock("../../lib/content/repos/shared-link/connect-repo", () => ({ connectPublicRepo }));
vi.mock("../../storage", () => ({
  getStorage: () => ({ contentLoader: { listSets } }),
}));
vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));
const notifyError = vi.fn();
vi.mock("../../utils/notify", () => ({
  notify: { error: (...a: unknown[]) => notifyError(...a) },
}));

import RegistrySetCard from "./RegistrySetCard";

const SET: SearchableSet = {
  id: "ki-einsteiger-from-de",
  name: "KI für Einsteiger",
  description: "Was KI kann und was nicht.",
  source_language: "de",
  target_language: "de",
  level: "A1",
  domain: "ai",
  lesson_count: 6,
  card_count: 0,
  tags: [],
  ai_validated: false,
  trust_level: 3,
  book: null,
  updated_at: null,
  repo_url: "astrapi69/alc-ai",
  repo_name: "KI",
  review_status: "authored",
};
const REPO = { url: "https://github.com/astrapi69/alc-ai", branch: "main" };

const CONNECTED: Partial<ContentSetEntry> = {
  id: "ki-einsteiger-from-de",
  source: "astrapi69/alc-ai",
  cached_version: null,
};

function renderCard(onConnected = vi.fn(), onDiscover = vi.fn()) {
  render(
    <RegistrySetCard set={SET} repo={REPO} onConnected={onConnected} onDiscover={onDiscover} />,
  );
  return { onConnected, onDiscover };
}

beforeEach(() => {
  vi.clearAllMocks();
  connectPublicRepo.mockResolvedValue({ ok: true, source: "astrapi69/alc-ai" });
  listSets.mockResolvedValue({ sets: [{ id: "other", source: "astrapi69/alc-ai" }, CONNECTED] });
});

describe("RegistrySetCard", () => {
  it("shows the set from the index and the repo it comes from", () => {
    renderCard();
    expect(screen.getByTestId("set-deep-link-title")).toHaveTextContent("KI für Einsteiger");
    expect(screen.getByTestId("set-deep-link-lessons")).toHaveTextContent("6 lessons");
    expect(screen.getByTestId("registry-set-repo")).toHaveTextContent("From the repository KI");
    expect(screen.getByTestId("registry-set-explain")).toBeInTheDocument();
    expect(screen.getByTestId("set-deep-link-start")).toHaveTextContent("Add & start");
  });

  it("connects the repo and hands over the set from the fresh listing", async () => {
    const { onConnected } = renderCard();
    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    await waitFor(() => expect(onConnected).toHaveBeenCalledWith(CONNECTED));
    expect(connectPublicRepo).toHaveBeenCalledWith(REPO, expect.any(Function));
  });

  it("shows the validation reason and hands over nothing when the repo fails", async () => {
    connectPublicRepo.mockResolvedValue({
      ok: false,
      validation: { ok: false, setCount: 0, lessonCount: 0, reasonCode: "no_sets" },
    });
    const { onConnected } = renderCard();
    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    expect(await screen.findByTestId("registry-set-error")).toHaveTextContent(
      "Validation failed",
    );
    expect(onConnected).not.toHaveBeenCalled();
    expect(screen.getByTestId("set-deep-link-start")).toBeEnabled();
  });

  it.each([
    ["the id is missing", [{ id: "other", source: "astrapi69/alc-ai" }]],
    ["only another repo carries the id", [{ ...CONNECTED, source: "jane/deck" }]],
  ])("names the set when %s after connecting", async (_label, sets) => {
    listSets.mockResolvedValue({ sets });
    const { onConnected } = renderCard();
    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    expect(await screen.findByTestId("registry-set-error")).toHaveTextContent(
      "ki-einsteiger-from-de",
    );
    expect(onConnected).not.toHaveBeenCalled();
  });

  it("reports a failed connect with its error and stays usable", async () => {
    const failure = new Error("sync failed: 503");
    connectPublicRepo.mockRejectedValue(failure);
    renderCard();
    fireEvent.click(screen.getByTestId("set-deep-link-start"));
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][1]).toEqual({ error: failure });
    expect(screen.getByTestId("set-deep-link-start")).toBeEnabled();
  });

  it("offers Discover instead", () => {
    const { onDiscover } = renderCard();
    fireEvent.click(screen.getByTestId("set-deep-link-discover"));
    expect(onDiscover).toHaveBeenCalled();
  });
});

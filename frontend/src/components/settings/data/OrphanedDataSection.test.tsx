/**
 * Tests for OrphanedDataSection (#1445 Part C). Only shows when orphaned data
 * exists; the delete removes exactly the orphaned progress + cards.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

const listProgress = vi.fn();
const listErrors = vi.fn();
const listSets = vi.fn();
const deleteLearningData = vi.fn();
let mode = "dexie";

vi.mock("../../../storage", () => ({
  getStorage: () => ({
    lessonProgress: { list: listProgress },
    elementErrors: { list: listErrors },
    contentLoader: { listSets },
    learningData: { deleteLearningData },
  }),
  resolveStorageMode: () => mode,
}));

vi.mock("../../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "user-1" }),
}));

const notifySuccess = vi.fn();
vi.mock("../../../utils/notify", () => ({
  notify: { success: (...a: unknown[]) => notifySuccess(...a) },
}));

import OrphanedDataSection from "./OrphanedDataSection";

beforeEach(() => {
  mode = "dexie";
  listProgress.mockReset();
  listErrors.mockReset();
  listSets.mockReset();
  deleteLearningData.mockReset().mockResolvedValue({
    lessonsDeleted: 1,
    cardsDeleted: 2,
  });
  notifySuccess.mockReset();
});

// One orphaned repo (jane/gone), one connected (owner/keep).
function seedOrphans() {
  listProgress.mockResolvedValue([
    { id: "p1", source: "jane/gone", set_id: "waehrung" },
    { id: "p2", source: "owner/keep", set_id: "fr-a1" },
  ]);
  listErrors.mockResolvedValue([
    { set_id: "waehrung", lesson_id: "01", exercise_id: "e1", element_key: "geld" },
    { set_id: "fr-a1", lesson_id: "01", exercise_id: "e1", element_key: "merci" },
  ]);
  listSets.mockResolvedValue({
    sets: [{ source: "owner/keep", id: "fr-a1" }],
  });
}

describe("OrphanedDataSection", () => {
  it("renders nothing when there is no orphaned data", async () => {
    listProgress.mockResolvedValue([
      { id: "p2", source: "owner/keep", set_id: "fr-a1" },
    ]);
    listErrors.mockResolvedValue([]);
    listSets.mockResolvedValue({ sets: [{ source: "owner/keep", id: "fr-a1" }] });
    const { container } = render(<OrphanedDataSection />);
    await waitFor(() => expect(listProgress).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing in API mode (local delete unsupported)", async () => {
    mode = "api";
    seedOrphans();
    const { container } = render(<OrphanedDataSection />);
    await waitFor(() => expect(container.firstChild).toBeNull());
    expect(listProgress).not.toHaveBeenCalled();
  });

  it("shows the orphaned counts when orphaned data exists", async () => {
    seedOrphans();
    render(<OrphanedDataSection />);
    const summary = await screen.findByTestId("orphaned-summary");
    // 1 orphaned lesson (jane/gone), 1 orphaned card (waehrung/geld).
    expect(summary).toHaveTextContent("1 lessons");
    expect(summary).toHaveTextContent("1 review cards");
  });

  it("deletes exactly the orphaned progress + cards on confirm", async () => {
    seedOrphans();
    render(<OrphanedDataSection />);
    fireEvent.click(await screen.findByTestId("orphaned-delete-button"));
    fireEvent.click(
      await screen.findByTestId("orphaned-confirm-dialog-confirm"),
    );
    await waitFor(() => expect(deleteLearningData).toHaveBeenCalled());
    const [userId, deletion] = deleteLearningData.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(deletion.lessonProgressIds).toEqual(["p1"]); // only jane/gone
    expect(deletion.setIds).toEqual(["waehrung"]);
    expect(notifySuccess).toHaveBeenCalled();
  });
});

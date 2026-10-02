/**
 * #3416 - a failed share quality check says the check failed, not that the
 * lesson could not be opened.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContentSetEntry } from "../../storage/types";

const notifyError = vi.fn();
vi.mock("../../utils/notify", () => ({
  notify: { error: (...args: unknown[]) => notifyError(...args), success: vi.fn() },
}));
vi.mock("../ui/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { useContentSharing } from "./useContentSharing";

describe("useContentSharing share-check failure (#3416)", () => {
  it("reports share_check_failed with the detail and closes the gate", async () => {
    const fetchSetLessons = vi.fn(async () => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useContentSharing({ sets: [], fetchSetLessons }));
    await act(async () => {
      await result.current.handleShare({ id: "s1", title: "Set" } as unknown as ContentSetEntry);
    });
    expect(notifyError).toHaveBeenCalledWith("content.error.share_check_failed", {
      error: expect.objectContaining({ message: "offline" }),
    });
    expect(result.current.shareTarget).toBeNull();
  });
});

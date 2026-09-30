/**
 * #3416 - a failed set export says the export failed, not that the lesson
 * could not be opened.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentSetEntry } from "../../../storage/types";

const notifyError = vi.fn();
vi.mock("../../../utils/notify", () => ({
  notify: { error: (...args: unknown[]) => notifyError(...args), success: vi.fn() },
}));
vi.mock("../../ui/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("./set-entry", () => ({
  fetchSetLessons: vi.fn(async () => {
    throw new Error("disk full");
  }),
}));

import { useSetExport } from "./useSetExport";

const entry = { id: "s1", title: "Set" } as unknown as ContentSetEntry;

describe("useSetExport failure message (#3416)", () => {
  beforeEach(() => notifyError.mockClear());

  it.each([
    ["JSON export", "handleExportJson"],
    ["ZIP export", "handleExportSet"],
  ] as const)("%s reports export_failed with the detail", async (_name, handler) => {
    const { result } = renderHook(() => useSetExport());
    await result.current[handler](entry);
    expect(notifyError).toHaveBeenCalledWith("content.error.export_failed disk full");
  });
});

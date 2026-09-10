/** Tests for the header "Update all" hook (#3001) and its held-back toast (#3081). */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentSetEntry } from "../../../storage/types";

const assessMock = vi.fn();
vi.mock("../../../lib/content/update/assess-set-update", () => ({
  assessSetUpdate: (...args: unknown[]) => assessMock(...args),
}));
const notifyInfo = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock("../../../utils/notify", () => ({
  notify: {
    info: (...args: unknown[]) => notifyInfo(...args),
    success: (...args: unknown[]) => notifySuccess(...args),
    error: (...args: unknown[]) => notifyError(...args),
    warning: vi.fn(),
  },
}));
vi.mock("../../ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

import { useUpdateAllSets } from "./useUpdateAllSets";

function entry(id: string, title: string, update = true): ContentSetEntry {
  return {
    source: "astrapi69/alc-psychology",
    branch: "main",
    id,
    title,
    language: "de",
    target_language: "de",
    source_language: "de",
    level: "A1",
    domain: "psychology",
    version: "1.1.0",
    lesson_count: 5,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: update,
  };
}

function breaking(isBreaking: boolean) {
  return { impact: { breaking: isBreaking }, retiredIds: [] };
}

beforeEach(() => {
  assessMock.mockReset();
  notifyInfo.mockReset();
  notifySuccess.mockReset();
  notifyError.mockReset();
});

describe("useUpdateAllSets held-back toast (#3081)", () => {
  it("names every held-back set in one toast that stays open", async () => {
    assessMock.mockImplementation(async (_source: string, id: string) =>
      breaking(id !== "applied-set"),
    );
    const applyDownload = vi.fn(async () => true);
    const { result } = renderHook(() => useUpdateAllSets({ applyDownload }));
    await act(async () => {
      await result.current.handleUpdateAll([
        entry("psych-rhetorik", "Psychologie der Rhetorik"),
        entry("applied-set", "Spanisch A1"),
        entry("psych-intro", "Psychologie - Grundlagen"),
      ]);
    });
    expect(applyDownload).toHaveBeenCalledTimes(1);
    expect(notifyInfo).toHaveBeenCalledTimes(1);
    const [message, opts] = notifyInfo.mock.calls[0];
    expect(message).toContain("Psychologie der Rhetorik, Psychologie - Grundlagen");
    expect(message).not.toContain("{titles}");
    expect(opts).toMatchObject({ autoClose: false });
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifySuccess.mock.calls[0][0]).toContain("1 sets updated");
  });

  it("stays silent about held sets when nothing was held back", async () => {
    assessMock.mockResolvedValue(breaking(false));
    const applyDownload = vi.fn(async () => true);
    const { result } = renderHook(() => useUpdateAllSets({ applyDownload }));
    await act(async () => {
      await result.current.handleUpdateAll([entry("a", "A")]);
    });
    expect(notifyInfo).not.toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledTimes(1);
  });

  it("treats a failed assessment as not held: the update is applied", async () => {
    assessMock.mockRejectedValue(new Error("peek failed"));
    const applyDownload = vi.fn(async () => true);
    const { result } = renderHook(() => useUpdateAllSets({ applyDownload }));
    await act(async () => {
      await result.current.handleUpdateAll([entry("a", "A")]);
    });
    expect(applyDownload).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), [], true);
    expect(notifyInfo).not.toHaveBeenCalled();
  });
});

/**
 * #2128 — the manual "Update" identity guard in useContentSetActions.
 * A breaking update (one that would orphan the learner's progress/SRS) is held
 * behind a confirmation instead of overwriting silently; a safe update applies
 * straight away.
 */

import "@testing-library/jest-dom/vitest";
import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useContentSetActions} from "./useContentSetActions";
import type {ContentSetEntry} from "../../storage/types";
import type {UpdateImpact} from "../../lib/content/update/update-impact";

const downloadSetMock = vi.fn();
const assessSetUpdateMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {downloadSet: (...a: unknown[]) => downloadSetMock(...a)},
    }),
}));
vi.mock("../../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), warning: vi.fn()},
}));
vi.mock("../ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb: string) => fb, lang: "de"}),
}));
vi.mock("../../lib/content/update/assess-set-update", () => ({
    assessSetUpdate: (...a: unknown[]) => assessSetUpdateMock(...a),
}));

function entry(over: Partial<ContentSetEntry> = {}): ContentSetEntry {
    return {
        source: "owner/repo",
        branch: "main",
        id: "ja-a1",
        title: "Japanisch A1",
        cached_version: "1.0.0",
        update_available: true,
        lesson_count: 10,
        ...over,
    } as ContentSetEntry;
}

const breaking: UpdateImpact = {
    lostLessons: ["01.json"],
    lostCards: [
        {lesson_id: "01.json", exercise_id: "ex-pic-1", element_key: "さようなら"},
    ],
    breaking: true,
};

function setup() {
    return renderHook(() =>
        useContentSetActions({
            navigate: vi.fn(),
            setSets: vi.fn() as never,
            setPerSetState: vi.fn() as never,
        }),
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    downloadSetMock.mockResolvedValue({});
});

describe("handleDownload update guard (#2128)", () => {
    it("holds a breaking update: no download, guard target set with counts", async () => {
        assessSetUpdateMock.mockResolvedValue(breaking);
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        expect(downloadSetMock).not.toHaveBeenCalled();
        expect(result.current.updateGuard?.entry.id).toBe("ja-a1");
        expect(result.current.updateGuard?.impact.lostCards).toHaveLength(1);
    });

    it("confirmUpdate applies the held update and clears the guard", async () => {
        assessSetUpdateMock.mockResolvedValue(breaking);
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        await act(async () => {
            await result.current.confirmUpdate();
        });
        expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "ja-a1");
        expect(result.current.updateGuard).toBeNull();
    });

    it("dismissUpdateGuard keeps the current version (no download)", async () => {
        assessSetUpdateMock.mockResolvedValue(breaking);
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        act(() => result.current.dismissUpdateGuard());
        expect(result.current.updateGuard).toBeNull();
        expect(downloadSetMock).not.toHaveBeenCalled();
    });

    it("a safe update (null impact) downloads straight away", async () => {
        assessSetUpdateMock.mockResolvedValue(null);
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "ja-a1");
        expect(result.current.updateGuard).toBeNull();
    });
});

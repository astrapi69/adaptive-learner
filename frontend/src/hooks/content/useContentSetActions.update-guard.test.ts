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
const planSetUpdateMock = vi.fn();
const remapKeysMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {downloadSet: (...a: unknown[]) => downloadSetMock(...a)},
        elementErrors: {remapKeys: (...a: unknown[]) => remapKeysMock(...a)},
    }),
}));
vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));
vi.mock("../../lib/content/update/plan-set-update", () => ({
    planSetUpdate: (...a: unknown[]) => planSetUpdateMock(...a),
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

const breakingImpact: UpdateImpact = {
    lostLessons: ["01.json"],
    lostCards: [
        {lesson_id: "01.json", exercise_id: "ex-pic-1", element_key: "さようなら"},
    ],
    breaking: true,
};
/** #2308 — the assessment now carries the peeked lessons so the dialog can
 *  plan without fetching the set a second time. */
const breaking = {impact: breakingImpact, incomingLessons: []};

const REMAP = {
    set_id: "ja-a1",
    lesson_id: "01.json",
    exercise_id: "ex-pic-1",
    old: "さようなら",
    new: "さようなら (sayounara)",
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
    planSetUpdateMock.mockResolvedValue({certain: [], uncertain: []});
    remapKeysMock.mockResolvedValue({applied: 1, skipped: 0});
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

    it("carries the derived plan into the guard, unapplied (#2308)", async () => {
        assessSetUpdateMock.mockResolvedValue(breaking);
        planSetUpdateMock.mockResolvedValue({certain: [REMAP], uncertain: []});
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        expect(result.current.updateGuard?.plan.certain).toEqual([REMAP]);
        // Held, not applied: the mapping is an inference and needs a decision.
        expect(remapKeysMock).not.toHaveBeenCalled();
        expect(downloadSetMock).not.toHaveBeenCalled();
    });

    it("a failed plan still holds the update, it just offers nothing (#2308)", async () => {
        assessSetUpdateMock.mockResolvedValue(breaking);
        planSetUpdateMock.mockRejectedValue(new Error("cache miss"));
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        expect(result.current.updateGuard?.plan).toEqual({certain: [], uncertain: []});
        expect(downloadSetMock).not.toHaveBeenCalled();
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

    it("confirmUpdate WITHOUT carry-over re-keys nothing (#2308)", async () => {
        assessSetUpdateMock.mockResolvedValue(breaking);
        planSetUpdateMock.mockResolvedValue({certain: [REMAP], uncertain: []});
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        await act(async () => {
            await result.current.confirmUpdate();
        });
        expect(downloadSetMock).toHaveBeenCalled();
        expect(remapKeysMock).not.toHaveBeenCalled();
    });

    it("confirmUpdate WITH carry-over re-keys after downloading (#2308)", async () => {
        assessSetUpdateMock.mockResolvedValue(breaking);
        planSetUpdateMock.mockResolvedValue({certain: [REMAP], uncertain: []});
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        await act(async () => {
            await result.current.confirmUpdate(true);
        });
        expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "ja-a1");
        expect(remapKeysMock).toHaveBeenCalledWith("u1", [REMAP]);
        // Content first, then the re-key: a failure after the download leaves
        // today's state (orphaned), not a new one (keys no version has).
        expect(downloadSetMock.mock.invocationCallOrder[0]).toBeLessThan(
            remapKeysMock.mock.invocationCallOrder[0],
        );
    });

    it("carry-over with an empty certain list touches nothing (#2308)", async () => {
        assessSetUpdateMock.mockResolvedValue(breaking);
        planSetUpdateMock.mockResolvedValue({
            certain: [],
            uncertain: [{identity: breakingImpact.lostCards[0], reason: "reordered"}],
        });
        const {result} = setup();
        await act(async () => {
            await result.current.handleDownload(entry());
        });
        await act(async () => {
            await result.current.confirmUpdate(true);
        });
        expect(remapKeysMock).not.toHaveBeenCalled();
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

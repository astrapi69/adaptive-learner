/**
 * #3001 — "Aktualisieren" in the Meine-Inhalte header applies EVERY
 * available set update, not just one per row. The bulk path reuses the
 * per-set download flow (stable-id migration, retirement archival, badge
 * invalidation) and keeps the #2128 identity guard: a breaking update is
 * never applied in bulk, it is skipped and reported for individual
 * confirmation.
 */

import "@testing-library/jest-dom/vitest";
import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useContentSetActions} from "./useContentSetActions";
import type {ContentSetEntry} from "../../storage/types";
import {notify} from "../../utils/notify";

const downloadSetMock = vi.fn();
const assessSetUpdateMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {downloadSet: (...a: unknown[]) => downloadSetMock(...a)},
        elementErrors: {
            remapKeys: vi.fn(async () => ({applied: 0, skipped: 0})),
            remapExerciseIds: vi.fn(async () => ({applied: 0, skipped: 0})),
        },
    }),
}));
vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));
vi.mock("../../lib/content/update/plan-set-update", () => ({
    planSetUpdate: vi.fn(async () => ({
        exercise: {certain: [], uncertain: []},
        element: {certain: [], uncertain: []},
    })),
}));
vi.mock("../../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn()},
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

const safe = {
    impact: {lostLessons: [], lostCards: [], retiredCards: [], breaking: false},
    retiredIds: [],
    incomingLessons: [],
};
const breaking = {
    impact: {
        lostLessons: ["01.json"],
        lostCards: [{lesson_id: "01.json", exercise_id: "ex-1", element_key: "k"}],
        retiredCards: [],
        breaking: true,
    },
    retiredIds: [],
    incomingLessons: [],
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
    assessSetUpdateMock.mockResolvedValue(safe);
});

describe("handleUpdateAll (#3001)", () => {
    it("applies every set with an update available and skips up-to-date sets", async () => {
        const {result} = setup();
        await act(async () => {
            await result.current.handleUpdateAll([
                entry({id: "ja-a1"}),
                entry({id: "fr-a1", update_available: false}),
                entry({id: "es-a1"}),
            ]);
        });
        expect(downloadSetMock).toHaveBeenCalledTimes(2);
        expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "ja-a1");
        expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "es-a1");
        // One summary toast with the count, not one toast per set.
        expect(notify.success).toHaveBeenCalledTimes(1);
        expect(notify.success).toHaveBeenCalledWith(
            expect.stringContaining("2"),
            expect.anything(),
        );
    });

    it("holds a breaking update out of the bulk run and reports it (#2128)", async () => {
        assessSetUpdateMock
            .mockResolvedValueOnce(breaking)
            .mockResolvedValueOnce(safe);
        const {result} = setup();
        await act(async () => {
            await result.current.handleUpdateAll([
                entry({id: "ja-a1"}),
                entry({id: "es-a1"}),
            ]);
        });
        expect(downloadSetMock).toHaveBeenCalledTimes(1);
        expect(downloadSetMock).toHaveBeenCalledWith("owner/repo", "es-a1");
        // The guard dialog is NOT opened by the bulk path: the learner
        // confirms held updates one by one via the row button.
        expect(result.current.updateGuard).toBeNull();
        expect(notify.info).toHaveBeenCalledWith(expect.stringContaining("1"));
    });

    it("counts a failed download and still applies the rest", async () => {
        downloadSetMock
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({});
        const {result} = setup();
        await act(async () => {
            await result.current.handleUpdateAll([
                entry({id: "ja-a1"}),
                entry({id: "es-a1"}),
            ]);
        });
        expect(downloadSetMock).toHaveBeenCalledTimes(2);
        expect(notify.error).toHaveBeenCalledWith(expect.stringContaining("1"));
        expect(notify.success).toHaveBeenCalledWith(
            expect.stringContaining("1"),
            expect.anything(),
        );
    });

    it("reports 'all up to date' and downloads nothing when no update is pending", async () => {
        const {result} = setup();
        await act(async () => {
            await result.current.handleUpdateAll([
                entry({id: "ja-a1", update_available: false}),
            ]);
        });
        expect(downloadSetMock).not.toHaveBeenCalled();
        expect(assessSetUpdateMock).not.toHaveBeenCalled();
        expect(notify.info).toHaveBeenCalledTimes(1);
    });

    it("flags updatingAll for the whole run", async () => {
        let release: () => void = () => undefined;
        downloadSetMock.mockImplementationOnce(
            () => new Promise<object>((resolve) => {
                release = () => resolve({});
            }),
        );
        const {result} = setup();
        expect(result.current.updatingAll).toBe(false);
        let run: Promise<void> = Promise.resolve();
        act(() => {
            run = result.current.handleUpdateAll([entry({id: "ja-a1"})]);
        });
        await waitFor(() => expect(result.current.updatingAll).toBe(true));
        await act(async () => {
            release();
            await run;
        });
        expect(result.current.updatingAll).toBe(false);
    });
});

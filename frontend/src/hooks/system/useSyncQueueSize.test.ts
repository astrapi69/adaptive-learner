import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {renderHook, act} from "@testing-library/react";

const mode = {value: "api"};
vi.mock("../../storage", () => ({
    resolveStorageMode: () => mode.value,
}));

let queueSize = 0;
vi.mock("../../lib/pwa/sync-queue", () => ({
    SYNC_QUEUE_CHANGED_EVENT: "adaptive-learner:sync-queue-changed",
    syncQueueSize: () => queueSize,
}));

import {useSyncQueueSize} from "./useSyncQueueSize";

beforeEach(() => {
    mode.value = "api";
    queueSize = 0;
});
afterEach(() => vi.restoreAllMocks());

describe("useSyncQueueSize", () => {
    it("reads the queue size in API mode", () => {
        queueSize = 4;
        const {result} = renderHook(() => useSyncQueueSize());
        expect(result.current).toBe(4);
    });

    it("returns 0 in Dexie mode (SYNC-UI-GATE)", () => {
        mode.value = "dexie";
        queueSize = 7;
        const {result} = renderHook(() => useSyncQueueSize());
        expect(result.current).toBe(0);
    });

    it("updates on the queue-changed event", () => {
        const {result} = renderHook(() => useSyncQueueSize());
        expect(result.current).toBe(0);
        act(() => {
            queueSize = 2;
            window.dispatchEvent(
                new CustomEvent("adaptive-learner:sync-queue-changed"),
            );
        });
        expect(result.current).toBe(2);
    });
});

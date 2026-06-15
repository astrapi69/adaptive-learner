import {useEffect, useState} from "react";

import {resolveStorageMode} from "../storage";
import {
    SYNC_QUEUE_CHANGED_EVENT,
    syncQueueSize,
} from "../lib/pwa/sync-queue";

/**
 * Reactive count of pending (un-synced) offline mutations (#604).
 *
 * SYNC-UI-GATE: the offline sync queue only exists in **API mode**
 * (Dexie mode has no backend to replay to), so in Dexie mode this
 * always returns 0 and registers no listeners. In API mode it reads
 * {@link syncQueueSize} and updates on the queue-changed event, the
 * cross-tab ``storage`` event, and ``focus`` (a replay may have run
 * elsewhere).
 */
export function useSyncQueueSize(): number {
    const enabled = resolveStorageMode() === "api";
    const [size, setSize] = useState<number>(() =>
        enabled ? syncQueueSize() : 0,
    );

    useEffect(() => {
        if (!enabled) return;
        const refresh = () => setSize(syncQueueSize());
        refresh();
        window.addEventListener(SYNC_QUEUE_CHANGED_EVENT, refresh);
        window.addEventListener("storage", refresh);
        window.addEventListener("focus", refresh);
        window.addEventListener("online", refresh);
        return () => {
            window.removeEventListener(SYNC_QUEUE_CHANGED_EVENT, refresh);
            window.removeEventListener("storage", refresh);
            window.removeEventListener("focus", refresh);
            window.removeEventListener("online", refresh);
        };
    }, [enabled]);

    return enabled ? size : 0;
}

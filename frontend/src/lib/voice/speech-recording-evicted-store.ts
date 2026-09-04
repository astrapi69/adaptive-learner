/**
 * Speech-recording eviction marker (#2841, follow-up to #2818).
 *
 * ``speech-recordings-dexie.ts`` enforces a total-storage cap and evicts
 * the OLDEST clips (by ``recorded_at``) once a save would push the
 * user over it. Once a row is deleted there is nothing left to read -
 * recordings deliberately live outside ``LessonProgress.step_results``,
 * so there is no other signal that lets ``SpeakAndRecordExercise``
 * distinguish "never recorded" from "was recorded, then evicted". This
 * module is that signal: a small localStorage set of recording ids
 * marked evicted, mirrored into the Dexie ``userData`` store (the #791
 * pattern) so it survives a Dexie restore and rides the ``.alb``
 * backup's localStorage snapshot.
 *
 * Mirrors ``lesson-order-store.ts``'s shape (tolerant read/write, an
 * optional ``storage`` override for pure tests, mirrored via
 * {@link mirrorUserData}) but simpler: membership in a set, not an
 * ordered map.
 */

import {mirrorUserData} from "../../storage/dexie/dexie-user-data";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.speech-recording-evicted";

function resolveStorage(override?: Storage): Storage | null {
    if (override) return override;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
}

function read(storage: Storage): Set<string> {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((v): v is string => typeof v === "string"));
    } catch {
        return new Set();
    }
}

function write(storage: Storage, ids: Set<string>, mirror: boolean): void {
    try {
        const raw = JSON.stringify([...ids]);
        storage.setItem(STORAGE_KEY, raw);
        if (mirror) void mirrorUserData(STORAGE_KEY, raw);
    } catch {
        /* quota / disabled storage - worst case the marker is lost, the
           row is simply gone with no explanation, no worse than before
           this feature existed */
    }
}

/** Whether ``id`` (a ``SpeechRecording.id``) was evicted for storage-cap
 *  reasons and has not been re-recorded since. */
export function wasSpeechRecordingEvicted(id: string, storage?: Storage): boolean {
    const store = resolveStorage(storage);
    if (!store) return false;
    return read(store).has(id);
}

/** Mark ``id`` as evicted (idempotent, mirrored). */
export function markSpeechRecordingEvicted(id: string, storage?: Storage): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const ids = read(store);
    ids.add(id);
    write(store, ids, storage === undefined);
}

/** Clear the eviction marker for ``id`` - called when the exercise is
 *  re-recorded, so the marker never outlives the row it referred to. */
export function clearSpeechRecordingEvicted(id: string, storage?: Storage): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const ids = read(store);
    if (!ids.delete(id)) return;
    write(store, ids, storage === undefined);
}

/**
 * Client-side speech-recording store for Dexie / GitHub Pages mode
 * (engine#68 idea 3: speak-and-record).
 *
 * Mirrors ``lesson-progress-dexie.ts``'s composite-key shape, one level
 * deeper (``exercise_id``): a lesson can carry several speak-and-record
 * exercises, each with its own clip. Unlike lesson progress there is no
 * merge logic - a save always overwrites the whole row (re-recording
 * replaces the clip, it does not append to a history).
 */

import type {
    SpeechRecording,
    SpeechRecordingUpsertBody,
} from "../types";
import {getDb, nowIso} from "../dexie/db";
import type {SpeechRecordingRow} from "../dexie/db";
import {
    clearSpeechRecordingEvicted,
    markSpeechRecordingEvicted,
    wasSpeechRecordingEvicted,
} from "../../lib/voice/speech-recording-evicted-store";

/**
 * Total speechRecordings storage per user, in stored base64 characters
 * (a close proxy for bytes - base64 overhead is fixed, so this is
 * consistent as both the cap and the eviction measure). 20 MB fits
 * roughly 170 max-length recordings (~30s at 24kbps -> ~90KB raw / ~120KB
 * base64 each, #2818) - generous for real usage, bounded for worst-case
 * IndexedDB growth on mobile. No prior art in this codebase for this
 * number; a product/UX call, not derived from an existing constant.
 */
export const SPEECH_RECORDINGS_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function slugifySource(source: string): string {
    return source.replace(/\//g, "--");
}

function rowKey(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
    exerciseId: string,
): string {
    return `${userId}#${slugifySource(source)}#${setId}#${lessonFilename}#${exerciseId}`;
}

function rowToWire(row: SpeechRecordingRow): SpeechRecording {
    return {
        id: row.id,
        user_id: row.user_id,
        source: row.source,
        set_id: row.set_id,
        lesson_filename: row.lesson_filename,
        exercise_id: row.exercise_id,
        audio_base64: row.audio_base64,
        mime_type: row.mime_type,
        duration_ms: row.duration_ms,
        recorded_at: row.recorded_at,
        updated_at: row.updated_at,
    };
}

export async function getSpeechRecordingDexie(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
    exerciseId: string,
): Promise<SpeechRecording | null> {
    const db = getDb();
    const row = await db.speechRecordings.get(
        rowKey(userId, source, setId, lessonFilename, exerciseId),
    );
    return row ? rowToWire(row) : null;
}

/**
 * Delete the oldest (by ``recorded_at``) rows of ``userId`` until the
 * total is back under ``maxTotalBytes``, marking each as evicted so
 * {@link wasEvictedDexie} can tell the difference between "never
 * recorded" and "was recorded, then evicted" once the row is gone.
 * The row just saved is never a candidate: it is always the most
 * recent (or ties on ``recorded_at`` with itself), so a single save
 * can never evict itself under a realistic cap.
 */
async function evictOldestUntilUnderCap(
    userId: string,
    maxTotalBytes: number,
): Promise<void> {
    const db = getDb();
    const rows = await db.speechRecordings.where("user_id").equals(userId).toArray();
    let total = rows.reduce((sum, r) => sum + r.audio_base64.length, 0);
    if (total <= maxTotalBytes) return;
    const oldestFirst = [...rows].sort((a, b) =>
        a.recorded_at < b.recorded_at ? -1 : a.recorded_at > b.recorded_at ? 1 : 0,
    );
    for (const row of oldestFirst) {
        if (total <= maxTotalBytes) break;
        await db.speechRecordings.delete(row.id);
        markSpeechRecordingEvicted(row.id);
        total -= row.audio_base64.length;
    }
}

export async function saveSpeechRecordingDexie(
    userId: string,
    body: SpeechRecordingUpsertBody,
    maxTotalBytesOverride?: number,
): Promise<SpeechRecording> {
    const db = getDb();
    const key = rowKey(
        userId,
        body.source,
        body.set_id,
        body.lesson_filename,
        body.exercise_id,
    );
    const now = nowIso();
    const existing = await db.speechRecordings.get(key);
    const row: SpeechRecordingRow = {
        id: key,
        user_id: userId,
        source: body.source,
        set_id: body.set_id,
        lesson_filename: body.lesson_filename,
        exercise_id: body.exercise_id,
        audio_base64: body.audio_base64,
        mime_type: body.mime_type,
        duration_ms: body.duration_ms,
        recorded_at: existing?.recorded_at ?? now,
        updated_at: now,
    };
    await db.speechRecordings.put(row);
    // A fresh recording supersedes any earlier eviction of this exact
    // exercise - the marker must not outlive the row it referred to.
    clearSpeechRecordingEvicted(key);
    await evictOldestUntilUnderCap(
        userId,
        maxTotalBytesOverride ?? SPEECH_RECORDINGS_MAX_TOTAL_BYTES,
    );
    return rowToWire(row);
}

export async function wasEvictedDexie(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
    exerciseId: string,
): Promise<boolean> {
    return wasSpeechRecordingEvicted(
        rowKey(userId, source, setId, lessonFilename, exerciseId),
    );
}

export async function deleteSpeechRecordingDexie(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
    exerciseId: string,
): Promise<void> {
    const db = getDb();
    await db.speechRecordings.delete(
        rowKey(userId, source, setId, lessonFilename, exerciseId),
    );
}

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

export async function saveSpeechRecordingDexie(
    userId: string,
    body: SpeechRecordingUpsertBody,
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
    return rowToWire(row);
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

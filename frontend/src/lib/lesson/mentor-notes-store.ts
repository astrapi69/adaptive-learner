/**
 * Mode-agnostic mentor-note persistence (#2768, umbrella #2765).
 *
 * While an author plays their OWN lesson they can leave a per-step note
 * ("typo here", "distractor too obvious") and work the list off in the
 * editor afterwards — the runner never mutates the lesson (the #2765
 * note-first decision). Notes are a local authoring aid, not synced
 * learner data, so their home is ONE localStorage store that behaves
 * identically in both storage modes (the ``set-status-store`` /
 * ``dismissed-sets`` pattern; a per-mode write path is the recurring
 * #2053 reset-bug class).
 *
 * - Keys are ``source::setId::filename::stepId``.
 * - Write-through mirrored into the Dexie ``userData`` canonical store
 *   (#791 pattern) so the notes survive a Dexie restore and ride the
 *   ``.alb`` backup's localStorage snapshot — the key is registered in
 *   ``MANAGED_USER_DATA_KEYS``.
 * - Reads tolerate corrupt/absent storage (empty result); writes swallow
 *   quota errors (a lost note is an inconvenience, not data loss).
 * - Tests pass an explicit ``storage`` override and stay pure (no Dexie
 *   side effect) — the same contract the sibling stores use.
 */

import {mirrorUserData} from "../../storage/dexie/dexie-user-data";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.mentor-notes";

/** What kind of problem the author noticed on the step. */
export const MENTOR_NOTE_CATEGORIES = [
    "typo",
    "unclear",
    "too_easy",
    "too_hard",
    "wrong_answer",
    "other",
] as const;

export type MentorNoteCategory = (typeof MENTOR_NOTE_CATEGORIES)[number];

/** One stored note. */
export interface MentorNote {
    category: MentorNoteCategory;
    text: string;
    /** ISO timestamp of the first save (kept across edits of the note). */
    created_at: string;
}

/** Address of a note: one step of one lesson of one set. */
export interface MentorNoteRef {
    source: string;
    setId: string;
    filename: string;
    stepId: string;
}

/** A listed note together with the step it annotates. */
export interface MentorNoteEntry {
    stepId: string;
    note: MentorNote;
}

function noteKey(ref: MentorNoteRef): string {
    return `${ref.source}::${ref.setId}::${ref.filename}::${ref.stepId}`;
}

function lessonPrefix(ref: Pick<MentorNoteRef, "source" | "setId" | "filename">): string {
    return `${ref.source}::${ref.setId}::${ref.filename}::`;
}

function resolveStorage(override?: Storage): Storage | null {
    if (override) return override;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
}

function isMentorNote(value: unknown): value is MentorNote {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.text === "string" &&
        typeof candidate.created_at === "string" &&
        (MENTOR_NOTE_CATEGORIES as readonly string[]).includes(
            candidate.category as string,
        )
    );
}

function read(storage: Storage): Record<string, MentorNote> {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const out: Record<string, MentorNote> = {};
        for (const [key, val] of Object.entries(
            parsed as Record<string, unknown>,
        )) {
            if (isMentorNote(val)) out[key] = val;
        }
        return out;
    } catch {
        return {};
    }
}

function write(
    storage: Storage,
    map: Record<string, MentorNote>,
    mirror: boolean,
): void {
    try {
        const raw = JSON.stringify(map);
        storage.setItem(STORAGE_KEY, raw);
        if (mirror) void mirrorUserData(STORAGE_KEY, raw);
    } catch {
        /* quota / disabled storage — worst case the note is lost on refresh */
    }
}

/** The stored note for one step, or ``null`` when none is recorded. */
export function getMentorNote(
    ref: MentorNoteRef,
    storage?: Storage,
): MentorNote | null {
    const store = resolveStorage(storage);
    if (!store) return null;
    return read(store)[noteKey(ref)] ?? null;
}

/**
 * Save (or update) the note for one step. The first save stamps
 * ``created_at``; edits keep it.
 */
export function storeMentorNote(
    ref: MentorNoteRef,
    note: {category: MentorNoteCategory; text: string},
    storage?: Storage,
): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = read(store);
    const key = noteKey(ref);
    map[key] = {
        category: note.category,
        text: note.text,
        created_at: map[key]?.created_at ?? new Date().toISOString(),
    };
    write(store, map, storage === undefined);
}

/** Remove the note for one step (no-op when absent). */
export function removeMentorNote(ref: MentorNoteRef, storage?: Storage): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = read(store);
    const key = noteKey(ref);
    if (!(key in map)) return;
    delete map[key];
    write(store, map, storage === undefined);
}

/** Every note of one lesson, in stable step-key order. */
export function listLessonMentorNotes(
    ref: Pick<MentorNoteRef, "source" | "setId" | "filename">,
    storage?: Storage,
): MentorNoteEntry[] {
    const store = resolveStorage(storage);
    if (!store) return [];
    const prefix = lessonPrefix(ref);
    return Object.entries(read(store))
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, note]) => ({stepId: key.slice(prefix.length), note}))
        .sort((a, b) => a.stepId.localeCompare(b.stepId));
}

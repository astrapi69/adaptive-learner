/**
 * custom-paths — pure + localStorage layer behind the "My Paths" /
 * "Meine Pfade" mode of the personal Learning Path (Curriculum
 * Builder, Option A of #722).
 *
 * The learner assembles existing content lessons into ordered,
 * personal "custom paths". This is NOT a parallel ``curricula``
 * system: it stores nothing on the server and adds no SQLAlchemy
 * model — it is user-local data. That gives identical behaviour in
 * BOTH storage modes (ApiStorage + DexieStorage) with no backend.
 *
 * #791 Teil B: in Dexie mode the canonical home is the IndexedDB
 * ``userData`` store. The synchronous localStorage API below is kept
 * as a read cache; production writes (no ``storage`` override) mirror
 * through to Dexie via {@link mirrorUserData}, and
 * {@link syncUserDataAtBoot} reconciles the two at app start.
 *
 * Every storage function takes an optional ``storage`` override
 * (defaulting to ``localStorage``) so the unit tests can inject an
 * in-memory ``Storage`` and stay deterministic (no Dexie side effect).
 * All reads tolerate corrupt / absent / disabled storage by returning
 * an empty list rather than throwing — a custom path is a convenience,
 * never load-bearing data.
 */

import type {LessonProgress} from "../../storage/types";
import {mirrorUserData} from "../../storage/dexie/dexie-user-data";

const STORAGE_KEY = "adaptive-learner.custom-paths";

/** One lesson reference inside a custom path. Mirrors the
 *  ``{source, setId, filename}`` triple used across the
 *  content-loader + continue-learning surfaces. */
export interface CustomPathLesson {
    source: string;
    setId: string;
    filename: string;
}

/** A user-assembled, ordered list of content lessons. */
export interface CustomPath {
    /** Stable opaque id (``crypto.randomUUID()``). */
    id: string;
    name: string;
    description?: string;
    /** Ordered lesson references; order is the learner's chosen
     *  sequence. No duplicates (by source+setId+filename). */
    lessons: CustomPathLesson[];
    /** ISO-8601 timestamp the path was created. */
    createdAt: string;
    /** ISO-8601 timestamp of the last mutation. */
    updatedAt: string;
}

/** Progress roll-up for a custom path against the learner's
 *  lesson-progress rows. */
export interface CustomPathProgress {
    /** Lessons whose matching ``LessonProgress.status === "completed"``. */
    done: number;
    /** Total lessons in the path. */
    total: number;
    /** First non-completed lesson in path order, or null when the
     *  path is empty or fully completed. */
    nextLesson: CustomPathLesson | null;
}

function resolveStorage(override?: Storage): Storage | null {
    if (override) return override;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
}

function isLesson(value: unknown): value is CustomPathLesson {
    return (
        !!value &&
        typeof value === "object" &&
        typeof (value as CustomPathLesson).source === "string" &&
        typeof (value as CustomPathLesson).setId === "string" &&
        typeof (value as CustomPathLesson).filename === "string"
    );
}

function isPath(value: unknown): value is CustomPath {
    if (!value || typeof value !== "object") return false;
    const path = value as CustomPath;
    return (
        typeof path.id === "string" &&
        typeof path.name === "string" &&
        Array.isArray(path.lessons) &&
        path.lessons.every(isLesson) &&
        typeof path.createdAt === "string" &&
        typeof path.updatedAt === "string"
    );
}

function read(storage: Storage): CustomPath[] {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isPath);
    } catch {
        return [];
    }
}

function write(storage: Storage, list: CustomPath[]): void {
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        /* quota / disabled storage — custom paths are a convenience */
    }
}

/**
 * Persist a mutated list: write the localStorage cache, then (production path
 * only — no ``storage`` override) mirror it through to the Dexie canonical
 * store. Keeps the unit tests' injected ``Storage`` free of Dexie effects.
 */
function persist(s: Storage, list: CustomPath[], override?: Storage): void {
    write(s, list);
    if (override === undefined) void mirrorUserData(STORAGE_KEY, JSON.stringify(list));
}

function nowIso(): string {
    return new Date().toISOString();
}

function newId(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID (very old
    // runtimes / stripped test shims): a timestamp + random suffix.
    return `cp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sameLesson(a: CustomPathLesson, b: CustomPathLesson): boolean {
    return (
        a.source === b.source &&
        a.setId === b.setId &&
        a.filename === b.filename
    );
}

/** All custom paths, newest-created first. */
export function listCustomPaths(storage?: Storage): CustomPath[] {
    const s = resolveStorage(storage);
    if (!s) return [];
    return read(s)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Create a new (empty) custom path. The ``name`` is trimmed;
 * ``description`` is trimmed and dropped when blank. Returns the
 * created path.
 */
export function createCustomPath(
    name: string,
    description?: string,
    storage?: Storage,
): CustomPath {
    const trimmedDescription = description?.trim();
    const created: CustomPath = {
        id: newId(),
        name: name.trim(),
        ...(trimmedDescription ? {description: trimmedDescription} : {}),
        lessons: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    const s = resolveStorage(storage);
    if (!s) return created;
    persist(s, [...read(s), created], storage);
    return created;
}

/**
 * Rename a path and/or update its description. A blank
 * ``description`` clears it. Returns the updated path, or null when
 * the id is unknown.
 */
export function renameCustomPath(
    id: string,
    name: string,
    description: string | undefined,
    storage?: Storage,
): CustomPath | null {
    const s = resolveStorage(storage);
    if (!s) return null;
    const list = read(s);
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const trimmedDescription = description?.trim();
    const updated: CustomPath = {
        ...list[idx],
        name: name.trim(),
        ...(trimmedDescription
            ? {description: trimmedDescription}
            : {description: undefined}),
        updatedAt: nowIso(),
    };
    if (!trimmedDescription) delete updated.description;
    list[idx] = updated;
    persist(s, list, storage);
    return updated;
}

/** Delete a path by id. Idempotent. Returns the remaining list. */
export function deleteCustomPath(id: string, storage?: Storage): CustomPath[] {
    const s = resolveStorage(storage);
    if (!s) return [];
    const next = read(s).filter((p) => p.id !== id);
    persist(s, next, storage);
    return next.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Append a lesson to a path. No-op when the lesson is already in
 * the path (matched by source+setId+filename). Returns the updated
 * path, or null when the id is unknown.
 */
export function addLessonToPath(
    id: string,
    lesson: CustomPathLesson,
    storage?: Storage,
): CustomPath | null {
    const s = resolveStorage(storage);
    if (!s) return null;
    const list = read(s);
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const path = list[idx];
    if (path.lessons.some((l) => sameLesson(l, lesson))) return path;
    const updated: CustomPath = {
        ...path,
        lessons: [...path.lessons, lesson],
        updatedAt: nowIso(),
    };
    list[idx] = updated;
    persist(s, list, storage);
    return updated;
}

/**
 * Remove a lesson from a path (matched by source+setId+filename).
 * Idempotent. Returns the updated path, or null when the id is
 * unknown.
 */
export function removeLessonFromPath(
    id: string,
    lesson: CustomPathLesson,
    storage?: Storage,
): CustomPath | null {
    const s = resolveStorage(storage);
    if (!s) return null;
    const list = read(s);
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const path = list[idx];
    const lessons = path.lessons.filter((l) => !sameLesson(l, lesson));
    if (lessons.length === path.lessons.length) return path;
    const updated: CustomPath = {...path, lessons, updatedAt: nowIso()};
    list[idx] = updated;
    persist(s, list, storage);
    return updated;
}

/**
 * Move a lesson one slot up or down within its path. A move that
 * would run off either end is a no-op (the bounds clamp). Returns
 * the updated path, or null when the id is unknown.
 */
export function moveLessonInPath(
    id: string,
    index: number,
    dir: "up" | "down",
    storage?: Storage,
): CustomPath | null {
    const s = resolveStorage(storage);
    if (!s) return null;
    const list = read(s);
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const path = list[idx];
    const target = dir === "up" ? index - 1 : index + 1;
    if (
        index < 0 ||
        index >= path.lessons.length ||
        target < 0 ||
        target >= path.lessons.length
    ) {
        return path;
    }
    const lessons = path.lessons.slice();
    const [moved] = lessons.splice(index, 1);
    lessons.splice(target, 0, moved);
    const updated: CustomPath = {...path, lessons, updatedAt: nowIso()};
    list[idx] = updated;
    persist(s, list, storage);
    return updated;
}

/**
 * Compute a path's completion roll-up against the learner's
 * lesson-progress rows. A lesson counts as ``done`` when a matching
 * row (source + set_id + lesson_filename) has
 * ``status === "completed"``. ``nextLesson`` is the first
 * non-completed lesson in path order (null for an empty or
 * fully-completed path).
 *
 * Pure + synchronous — the caller supplies the progress rows.
 */
export function customPathProgress(
    path: CustomPath,
    progressRows: readonly LessonProgress[],
): CustomPathProgress {
    const completed = new Set<string>();
    for (const row of progressRows) {
        if (row.status === "completed") {
            completed.add(`${row.source}#${row.set_id}#${row.lesson_filename}`);
        }
    }
    let done = 0;
    let nextLesson: CustomPathLesson | null = null;
    for (const lesson of path.lessons) {
        const key = `${lesson.source}#${lesson.setId}#${lesson.filename}`;
        if (completed.has(key)) {
            done += 1;
        } else if (nextLesson === null) {
            nextLesson = lesson;
        }
    }
    return {done, total: path.lessons.length, nextLesson};
}

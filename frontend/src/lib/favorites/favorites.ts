/**
 * favorites — per-user lesson bookmarks, stored locally (#596).
 *
 * Mirrors the contribution-history pattern: a per-user localStorage list
 * (no server, no auth), mode-agnostic so it works identically in API and
 * Dexie builds. Reads tolerate corrupt/absent storage by returning an
 * empty list rather than throwing. A change event lets open surfaces
 * (Dashboard card, toggles) react live.
 *
 * Cross-device sync (a real storage namespace + backup inclusion) is a
 * deliberate follow-up; favorites are a local convenience here.
 */

const KEY_PREFIX = "adaptive-learner.favorites.";

export const FAVORITES_CHANGE_EVENT = "adaptive-learner:favorites";

/** One bookmarked lesson. */
export interface FavoriteEntry {
    source: string;
    setId: string;
    filename: string;
    title: string;
    setTitle: string;
    /** ISO-8601 timestamp the favorite was added. */
    addedAt: string;
}

function keyFor(userId: string): string {
    return `${KEY_PREFIX}${userId}`;
}

function isEntry(e: unknown): e is FavoriteEntry {
    return (
        !!e &&
        typeof e === "object" &&
        typeof (e as FavoriteEntry).setId === "string" &&
        typeof (e as FavoriteEntry).filename === "string"
    );
}

function read(userId: string): FavoriteEntry[] {
    if (!userId || typeof localStorage === "undefined") return [];
    try {
        const raw = localStorage.getItem(keyFor(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
    } catch {
        return [];
    }
}

function write(userId: string, list: FavoriteEntry[]): void {
    if (!userId || typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(keyFor(userId), JSON.stringify(list));
    } catch {
        /* quota / disabled — favorites are a convenience, not load-bearing */
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(FAVORITES_CHANGE_EVENT));
    }
}

/** Stable identity for a lesson within a user's favorites. */
export function favoriteId(setId: string, filename: string): string {
    return `${setId}::${filename}`;
}

/** All favorites for a user, newest-added first. */
export function listFavorites(userId: string): FavoriteEntry[] {
    return read(userId).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/** Whether a lesson is currently favorited. */
export function isFavorite(
    userId: string,
    setId: string,
    filename: string,
): boolean {
    return read(userId).some(
        (e) => e.setId === setId && e.filename === filename,
    );
}

/** Add a favorite (no-op if already present). Returns the new list. */
export function addFavorite(
    userId: string,
    entry: Omit<FavoriteEntry, "addedAt">,
    now: Date = new Date(),
): FavoriteEntry[] {
    const list = read(userId);
    if (list.some((e) => e.setId === entry.setId && e.filename === entry.filename)) {
        return list;
    }
    const next = [...list, {...entry, addedAt: now.toISOString()}];
    write(userId, next);
    return next;
}

/** Remove a favorite. Returns the new list. */
export function removeFavorite(
    userId: string,
    setId: string,
    filename: string,
): FavoriteEntry[] {
    const next = read(userId).filter(
        (e) => !(e.setId === setId && e.filename === filename),
    );
    write(userId, next);
    return next;
}

/**
 * Toggle a lesson's favorite state. Returns the new favorited state
 * (true = now favorited).
 */
export function toggleFavorite(
    userId: string,
    entry: Omit<FavoriteEntry, "addedAt">,
    now: Date = new Date(),
): boolean {
    if (isFavorite(userId, entry.setId, entry.filename)) {
        removeFavorite(userId, entry.setId, entry.filename);
        return false;
    }
    addFavorite(userId, entry, now);
    return true;
}

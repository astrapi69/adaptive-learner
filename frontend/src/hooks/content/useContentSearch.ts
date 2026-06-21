import {useEffect, useMemo, useRef, useState} from "react";
import type {RefObject} from "react";

import {useI18n} from "../ui/useI18n";
import {
    buildLessonHaystack,
    buildSetHaystack,
    searchContentIndex,
    type ContentSearchResult,
    type IndexedLesson,
    type IndexedSet,
} from "../../lib/content/browse/content-search";
import {getStorage} from "../../storage";
import type {ContentSetEntry} from "../../storage/types";

/**
 * Result of {@link useContentSearch}: the controlled input state, the
 * focus ref (Cmd/Ctrl+K target), and the memoised search result over
 * the lazily-built index.
 */
export interface UseContentSearchResult {
    /** Raw, undebounced input value (drives the controlled input). */
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    /** Marks the search as engaged so the lazy index build starts.
     *  Wire to the input's focus + change handlers. */
    activateSearch: () => void;
    /** Ref for the search input — the Cmd/Ctrl+K shortcut focuses it. */
    searchInputRef: RefObject<HTMLInputElement | null>;
    /** Matches for the debounced query against the built index. */
    searchResult: ContentSearchResult;
}

/**
 * Content Browser search (#354, extracted from ``ContentPage``).
 *
 * Owns the query/debounce state, the global Cmd/Ctrl+K focus
 * shortcut, and the LAZY index build: the index loads every cached
 * lesson (title + cards) so card-content search works, so it is only
 * built once the learner actually engages the search (focus or first
 * keystroke) — keeping the /content mount cheap for the common
 * browse case. The index is keyed on a signature of the downloaded
 * sets so it rebuilds after a download.
 */
export function useContentSearch(
    sets: ContentSetEntry[],
): UseContentSearchResult {
    const {t} = useI18n();

    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [searchIndex, setSearchIndex] = useState<IndexedSet[]>([]);
    const [searchActivated, setSearchActivated] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Debounce the query (300ms) so the index isn't re-scanned on
    // every keystroke.
    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    // Cmd/Ctrl+K focuses the search input from anywhere on the page.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Build the search index once the sets are known. Not-yet-cached
    // sets are indexed at set level only. EXP-026 / UGC-05: index
    // user-generated sets too, so lessons folded into the tree (and
    // unplaced "My Lessons" drafts) stay findable.
    const downloadedSig = sets
        .map(
            (entry) =>
                `${entry.source}#${entry.id}@${entry.cached_version ?? ""}`,
        )
        .join(",");
    useEffect(() => {
        let cancelled = false;
        if (!searchActivated) return;
        const downloaded = sets;
        if (downloaded.length === 0) {
            setSearchIndex([]);
            return;
        }
        void (async () => {
            const built: IndexedSet[] = [];
            for (const entry of downloaded) {
                const domainLbl = t(
                    `content.tree.domain_${entry.domain ?? "language"}`,
                    entry.domain ?? "",
                );
                const indexed: IndexedSet = {
                    setId: entry.id,
                    source: entry.source,
                    setHaystack: buildSetHaystack(
                        entry.title,
                        entry.description,
                        domainLbl,
                        entry.tags ?? [],
                    ),
                    lessons: [],
                };
                // Only cached sets have readable lessons; skip the rest
                // so we don't fire doomed listLessons calls.
                if (entry.cached_version) {
                    try {
                        const listing = await getStorage().contentLoader.listLessons(
                            entry.source,
                            entry.id,
                        );
                        const lessons = await Promise.all(
                            listing.lessons.map(async (filename) => {
                                try {
                                    const lesson =
                                        await getStorage().contentLoader.getLesson(
                                            entry.source,
                                            entry.id,
                                            filename,
                                        );
                                    return {
                                        filename,
                                        title: lesson.title,
                                        haystack: buildLessonHaystack(
                                            lesson.title,
                                            lesson.cards ?? [],
                                        ),
                                    } satisfies IndexedLesson;
                                } catch {
                                    return null;
                                }
                            }),
                        );
                        indexed.lessons = lessons.filter(
                            (lesson): lesson is IndexedLesson => lesson !== null,
                        );
                    } catch {
                        /* set not cached / unreadable -> set-level index only */
                    }
                }
                built.push(indexed);
            }
            if (!cancelled) setSearchIndex(built);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [downloadedSig, searchActivated]);

    const searchResult = useMemo(
        () => searchContentIndex(searchIndex, debouncedQuery),
        [searchIndex, debouncedQuery],
    );

    return {
        searchQuery,
        setSearchQuery,
        activateSearch: () => setSearchActivated(true),
        searchInputRef,
        searchResult,
    };
}

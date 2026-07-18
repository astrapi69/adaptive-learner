/**
 * useLessonSetContext (#1790 — extracted from Lesson.tsx).
 *
 * The lesson page's set-level context reads, resolved once on mount:
 * the next lesson's filename (for the summary's "Next lesson"
 * button) and the parent set's display title / domain / manifest
 * book (header context + the "Vertiefe das Thema" section). Every
 * read degrades silently — the consuming UI simply omits the
 * matching element.
 */

import {useEffect, useState} from "react";

import {getStorage} from "../../../storage";
import type {ContentSetBook} from "../../../storage/types";

/**
 * Resolve next-lesson + set metadata for the lesson viewer.
 *
 * @example
 * const {nextLessonFilename, setTitle} = useLessonSetContext({
 *     source, setId, filename,
 * });
 */
export function useLessonSetContext({
    source,
    setId,
    filename,
}: {
    source: string;
    setId: string;
    filename: string;
}) {
    // Phase 46A — fetch the set's lesson list so the summary
    // screen's "Next lesson" button knows whether there's a
    // successor + what filename to navigate to. One extra
    // storage round-trip on mount; cached by both storages.
    // ``null`` means "no next lesson" (last in set OR list not
    // yet loaded). Failures degrade silently — the button just
    // doesn't render.
    const [nextLessonFilename, setNextLessonFilename] = useState<
        string | null
    >(null);
    useEffect(() => {
        if (!source || !setId || !filename) {
            setNextLessonFilename(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const list = await getStorage().contentLoader.listLessons(
                    source,
                    setId,
                );
                if (cancelled) return;
                const idx = list.lessons.indexOf(filename);
                if (idx >= 0 && idx < list.lessons.length - 1) {
                    setNextLessonFilename(list.lessons[idx + 1]);
                } else {
                    setNextLessonFilename(null);
                }
            } catch {
                if (!cancelled) setNextLessonFilename(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [source, setId, filename]);

    // Phase 51 bugfix — resolve the set's display title so the
    // header can show context above the lesson title
    // ("Set: Français A1 — Beginner" → "Les articles"). Looks up
    // via listSets + filter; degrades silently if the set isn't
    // in the discovered list (header just omits the line).
    const [setTitle, setSetTitle] = useState<string | null>(null);
    // EXP-029 — the set's domain, used to surface domain-level media.yaml
    // resources in the "Vertiefe das Thema" section. Falls back to the
    // lesson's own domain when the set lookup misses.
    const [setDomain, setSetDomain] = useState<string | null>(null);
    // #769 — the set's manifest book, surfaced as the first "Vertiefe das
    // Thema" media item.
    const [setBook, setSetBook] = useState<ContentSetBook | null>(null);
    useEffect(() => {
        if (!setId) {
            setSetTitle(null);
            setSetDomain(null);
            setSetBook(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const list = await getStorage().contentLoader.listSets();
                if (cancelled) return;
                const match = list.sets.find((s) => s.id === setId);
                setSetTitle(match?.title ?? null);
                setSetDomain(match?.domain ?? null);
                setSetBook(match?.book ?? null);
            } catch {
                if (!cancelled) {
                    setSetTitle(null);
                    setSetDomain(null);
                    setSetBook(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [setId]);

    return {nextLessonFilename, setTitle, setDomain, setBook};
}

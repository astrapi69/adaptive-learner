/**
 * useLessonSetContext (#1790 — extracted from Lesson.tsx).
 *
 * The lesson page's set-level context reads, resolved once on mount:
 * the lesson's POSITION in the set (#2793 — index, total and both
 * neighbours, which drives "Lesson N of M" plus the backward /
 * forward controls) and the parent set's display title / domain /
 * manifest book (header context + the "Vertiefe das Thema" section).
 * Every read degrades silently — the consuming UI simply omits the
 * matching element.
 */

import {useEffect, useState} from "react";

import {getStorage} from "../../../storage";
import {resolveSetPosition, type SetPosition} from "../../../lib/lesson/set-position";
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
    // #2793 — the same round-trip now yields the FULL position (index,
    // total, both neighbours) instead of only the successor, so the runner
    // can show "Lesson N of M" and navigate backwards. ``null`` means the
    // list has not loaded or the lesson is not in it; every consumer omits
    // its UI in that case.
    const [position, setPosition] = useState<SetPosition | null>(null);
    useEffect(() => {
        if (!source || !setId || !filename) {
            setPosition(null);
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
                setPosition(resolveSetPosition(list.lessons, filename));
            } catch {
                if (!cancelled) setPosition(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [source, setId, filename]);
    const nextLessonFilename = position?.next ?? null;
    const prevLessonFilename = position?.previous ?? null;

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

    return {
        nextLessonFilename,
        prevLessonFilename,
        position,
        setTitle,
        setDomain,
        setBook,
    };
}

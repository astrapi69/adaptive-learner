/**
 * LessonPicker — a presentational, searchable list for adding a
 * content lesson to a custom path. Given the available lessons (each
 * with a ready-to-display label + its parent set title), it filters
 * on a debounce-free substring search and calls ``onSelect`` with the
 * chosen lesson's ``{source, setId, filename}`` triple.
 *
 * App-agnostic and props-driven: the host loads the lessons via
 * ``getStorage()`` and feeds them in; this component owns only the
 * search box state. No i18n / storage imports. Token-backed Tailwind,
 * 44px touch targets, stable testIds.
 *
 * @example
 * <LessonPicker
 *   availableLessons={[
 *     {source: "bundled:x", setId: "fr-a1", filename: "03.json",
 *      label: "03 articles", setTitle: "French A1"},
 *   ]}
 *   searchPlaceholder="Search lessons…"
 *   emptyLabel="No lessons found"
 *   onSelect={(lesson) => addLessonToPath(pathId, lesson)}
 * />
 */

import {Plus, Search} from "lucide-react";
import {useMemo, useState} from "react";

/** One selectable lesson in the picker. */
export interface PickableLesson {
    source: string;
    setId: string;
    filename: string;
    /** Ready-to-display lesson label (e.g. "03 articles"). */
    label: string;
    /** Parent set title, shown as secondary context. */
    setTitle: string;
}

export interface LessonPickerProps {
    /** All lessons the learner may add. */
    availableLessons: readonly PickableLesson[];
    /** Placeholder for the search input. */
    searchPlaceholder: string;
    /** Shown when the search matches nothing. */
    emptyLabel: string;
    /** Fired with the chosen lesson's ``{source, setId, filename}``. */
    onSelect: (lesson: {
        source: string;
        setId: string;
        filename: string;
    }) => void;
    /** Accessible label for the list region. */
    listLabel?: string;
    testId?: string;
}

function normalize(value: string): string {
    return value.toLowerCase().trim();
}

/** Searchable lesson list for adding to a custom path (presentational). */
export default function LessonPicker({
    availableLessons,
    searchPlaceholder,
    emptyLabel,
    onSelect,
    listLabel,
    testId,
}: LessonPickerProps) {
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = normalize(query);
        if (!q) return availableLessons;
        return availableLessons.filter(
            (l) =>
                normalize(l.label).includes(q) ||
                normalize(l.setTitle).includes(q),
        );
    }, [availableLessons, query]);

    return (
        <div className="flex flex-col gap-2" data-testid={testId}>
            <div className="relative">
                <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
                />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="min-h-[44px] w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm text-fg-primary placeholder:text-fg-muted"
                    data-testid={testId ? `${testId}-search` : undefined}
                />
            </div>

            {filtered.length === 0 ? (
                <p
                    className="px-1 py-2 text-sm text-fg-muted"
                    data-testid={testId ? `${testId}-empty` : undefined}
                >
                    {emptyLabel}
                </p>
            ) : (
                <ul
                    aria-label={listLabel}
                    className="flex max-h-72 flex-col gap-1 overflow-y-auto"
                    data-testid={testId ? `${testId}-list` : undefined}
                >
                    {filtered.map((lesson) => (
                        <li key={`${lesson.source}#${lesson.setId}#${lesson.filename}`}>
                            <button
                                type="button"
                                onClick={() =>
                                    onSelect({
                                        source: lesson.source,
                                        setId: lesson.setId,
                                        filename: lesson.filename,
                                    })
                                }
                                className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-muted"
                                data-testid={
                                    testId
                                        ? `${testId}-item-${lesson.setId}-${lesson.filename}`
                                        : undefined
                                }
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-fg-primary">
                                        {lesson.label}
                                    </span>
                                    <span className="block truncate text-xs text-fg-muted">
                                        {lesson.setTitle}
                                    </span>
                                </span>
                                <Plus
                                    size={16}
                                    aria-hidden="true"
                                    className="shrink-0 text-accent"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

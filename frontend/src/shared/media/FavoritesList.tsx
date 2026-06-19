/**
 * FavoritesList — a list of bookmarked items, each opening on click with
 * a remove action.
 *
 * App-agnostic and props-driven: items carry a display title + subtitle
 * and stable id; open/remove are caller callbacks; labels are supplied.
 * No i18n/storage/router imports. Renders an empty-state line when there
 * are none. Token-backed Tailwind, 44px controls.
 *
 * @example
 * <FavoritesList
 *   items={[{id: "es::01", title: "Greetings", subtitle: "Spanish A1"}]}
 *   onOpen={(id) => navigate(routeFor(id))}
 *   onRemove={(id) => unfavorite(id)}
 *   removeLabel="Remove"
 *   emptyLabel="No favorites yet — tap the star on a lesson."
 * />
 */

import {Star, X} from "lucide-react";

export interface FavoritesListItem {
    id: string;
    title: string;
    subtitle?: string;
}

export interface FavoritesListProps {
    items: readonly FavoritesListItem[];
    onOpen: (id: string) => void;
    onRemove: (id: string) => void;
    /** Accessible label for the per-row remove button. */
    removeLabel: string;
    emptyLabel: string;
    testId?: string;
}

/** Bookmarked-items list with open + remove (presentational). */
export default function FavoritesList({
    items,
    onOpen,
    onRemove,
    removeLabel,
    emptyLabel,
    testId,
}: FavoritesListProps) {
    if (items.length === 0) {
        return (
            <p className="text-sm text-fg-muted" data-testid={testId}>
                {emptyLabel}
            </p>
        );
    }
    return (
        <ul className="flex flex-col gap-1" data-testid={testId}>
            {items.map((item) => (
                <li
                    key={item.id}
                    className="flex items-center gap-2"
                    data-testid={`favorite-${item.id}`}
                >
                    <button
                        type="button"
                        onClick={() => onOpen(item.id)}
                        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left hover:bg-muted"
                        data-testid={`favorite-open-${item.id}`}
                    >
                        <Star
                            size={14}
                            aria-hidden="true"
                            className="shrink-0 fill-[var(--star,currentColor)] text-warning"
                        />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-fg-primary">
                                {item.title}
                            </span>
                            {item.subtitle && (
                                <span className="block truncate text-xs text-fg-muted">
                                    {item.subtitle}
                                </span>
                            )}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        aria-label={removeLabel}
                        title={removeLabel}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-muted"
                        data-testid={`favorite-remove-${item.id}`}
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    );
}

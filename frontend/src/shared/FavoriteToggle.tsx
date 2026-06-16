/**
 * FavoriteToggle — a star button that toggles a favorite/bookmark, with
 * a filled (favorited) vs outline (not) state and a brief pop animation
 * on activation.
 *
 * App-agnostic and props-driven: state + the toggle callback + the
 * accessible labels are all caller-supplied; no i18n/storage imports.
 * Token-backed Tailwind, 44px touch target. Reusable for any
 * bookmark/favorite affordance.
 *
 * @example
 * <FavoriteToggle
 *   isFavorite={fav}
 *   onToggle={() => setFav(toggleFavorite(...))}
 *   addLabel="Add to favorites"
 *   removeLabel="Remove from favorites"
 * />
 */

import {Star} from "lucide-react";
import {useState} from "react";

export interface FavoriteToggleProps {
    isFavorite: boolean;
    onToggle: () => void;
    /** Accessible label when NOT favorited (the action: add). */
    addLabel: string;
    /** Accessible label when favorited (the action: remove). */
    removeLabel: string;
    /** Icon size in px. Default 18. */
    size?: number;
    testId?: string;
}

/** Star favorite toggle (presentational, token-backed). */
export default function FavoriteToggle({
    isFavorite,
    onToggle,
    addLabel,
    removeLabel,
    size = 18,
    testId,
}: FavoriteToggleProps) {
    const [pop, setPop] = useState(false);
    const label = isFavorite ? removeLabel : addLabel;
    return (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPop(true);
                window.setTimeout(() => setPop(false), 200);
                onToggle();
            }}
            aria-pressed={isFavorite}
            aria-label={label}
            title={label}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-muted motion-safe:transition-transform"
            style={pop ? {transform: "scale(1.25)"} : undefined}
            data-testid={testId}
            data-favorite={isFavorite ? "true" : "false"}
        >
            <Star
                size={size}
                aria-hidden="true"
                className={
                    isFavorite
                        ? "fill-[var(--star,currentColor)] text-warning"
                        : ""
                }
            />
        </button>
    );
}

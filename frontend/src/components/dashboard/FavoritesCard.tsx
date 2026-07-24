/**
 * FavoritesCard — Dashboard "Top 5 favorites" widget (#596, #625).
 *
 * Lists the learner's 5 most recently bookmarked lessons via the
 * reusable shared/FavoritesList: clicking opens the lesson, the X
 * removes the bookmark. When more than 5 are saved a muted "+N more"
 * line acknowledges the rest (managed via the per-lesson stars). Always
 * rendered (it carries the empty state). Local-only + mode-agnostic via
 * useFavorites.
 */

import {useNavigate} from "react-router-dom";

import FavoritesList from "../../shared/media/FavoritesList";
import {useFavorites} from "../../hooks/learning/useFavorites";
import {useI18n} from "../../hooks/ui/useI18n";
import {favoriteId} from "../../lib/favorites/favorites";
import {lessonRoute} from "../../lib/content/browse/continue-learning";

export interface FavoritesCardProps {
    userId: string;
}

/** How many favorites the Dashboard card surfaces (#625 — Top 5). */
const TOP_N = 5;

export default function FavoritesCard({userId}: FavoritesCardProps) {
    const {t} = useI18n();
    const navigate = useNavigate();
    const {favorites, remove} = useFavorites(userId);

    const items = favorites.slice(0, TOP_N).map((f) => ({
        id: favoriteId(f.setId, f.filename),
        title: f.title,
        subtitle: f.setTitle || undefined,
    }));
    const overflow = Math.max(0, favorites.length - TOP_N);

    const find = (id: string) =>
        favorites.find((f) => favoriteId(f.setId, f.filename) === id);

    return (
        <article className="dashboard-card" data-testid="favorites-card">
            <h2 className="dashboard-card-title">
                {t("favorites.card_title", "Your favorites")}
            </h2>
            <FavoritesList
                items={items}
                onOpen={(id) => {
                    const f = find(id);
                    if (f) navigate(lessonRoute(f.source, f.setId, f.filename));
                }}
                onRemove={(id) => {
                    const f = find(id);
                    if (f) remove(f.setId, f.filename);
                }}
                removeLabel={t("favorites.remove", "Remove from favorites")}
                emptyLabel={t(
                    "favorites.empty",
                    "No favorites yet - tap the star on a lesson to save it.",
                )}
                testId="favorites-list"
            />
            {overflow > 0 && (
                <p
                    className="mt-2 text-sm text-fg-muted"
                    data-testid="favorites-card-more"
                >
                    {t("favorites.card_more", "+{n} more").replace(
                        "{n}",
                        String(overflow),
                    )}
                </p>
            )}
        </article>
    );
}

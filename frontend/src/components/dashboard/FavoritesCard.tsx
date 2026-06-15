/**
 * FavoritesCard — Dashboard "Your favorites" widget (#596).
 *
 * Lists the learner's bookmarked lessons (newest first) via the
 * reusable shared/FavoritesList: clicking opens the lesson, the X
 * removes the bookmark. Always rendered (it carries the empty state) so
 * it doubles as the favorites view. Local-only + mode-agnostic via
 * useFavorites.
 */

import {useNavigate} from "react-router-dom";

import FavoritesList from "../../shared/FavoritesList";
import {useFavorites} from "../../hooks/useFavorites";
import {useI18n} from "../../hooks/useI18n";
import {favoriteId} from "../../lib/favorites/favorites";
import {lessonRoute} from "../../lib/content/continue-learning";

export interface FavoritesCardProps {
    userId: string;
}

export default function FavoritesCard({userId}: FavoritesCardProps) {
    const {t} = useI18n();
    const navigate = useNavigate();
    const {favorites, remove} = useFavorites(userId);

    const items = favorites.map((f) => ({
        id: favoriteId(f.setId, f.filename),
        title: f.title,
        subtitle: f.setTitle || undefined,
    }));

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
                    "No favorites yet — tap the star on a lesson to save it.",
                )}
                testId="favorites-list"
            />
        </article>
    );
}

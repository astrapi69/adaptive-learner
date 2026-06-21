/**
 * LessonFavoriteToggle — the favorite star for a single lesson (#596),
 * used in the lesson header and the lesson-complete summary.
 *
 * Wraps the presentational shared/FavoriteToggle with the favorites
 * store (useFavorites) + i18n labels. Renders nothing without a user.
 */

import FavoriteToggle from "../../../shared/media/FavoriteToggle";
import {useFavorites} from "../../../hooks/learning/useFavorites";
import {useI18n} from "../../../hooks/ui/useI18n";

export interface LessonFavoriteToggleProps {
    userId: string;
    source: string;
    setId: string;
    filename: string;
    title: string;
    setTitle: string;
    size?: number;
    testId?: string;
}

export default function LessonFavoriteToggle({
    userId,
    source,
    setId,
    filename,
    title,
    setTitle,
    size,
    testId,
}: LessonFavoriteToggleProps) {
    const {t} = useI18n();
    const {isFavorite, toggle} = useFavorites(userId || null);
    if (!userId) return null;
    return (
        <FavoriteToggle
            isFavorite={isFavorite(setId, filename)}
            onToggle={() =>
                toggle({source, setId, filename, title, setTitle})
            }
            addLabel={t("favorites.add", "Add to favorites")}
            removeLabel={t("favorites.remove", "Remove from favorites")}
            size={size}
            testId={testId ?? "lesson-favorite-toggle"}
        />
    );
}

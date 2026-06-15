/**
 * useFavorites — React glue around the per-user favorites store (#596).
 *
 * Returns the live favorites list plus ``isFavorite`` / ``toggle`` /
 * ``remove`` helpers bound to the active user, and re-reads on the
 * favorites change event so every open surface (toggles, the Dashboard
 * card) stays in sync.
 */

import {useCallback, useEffect, useState} from "react";

import {
    FAVORITES_CHANGE_EVENT,
    type FavoriteEntry,
    isFavorite as isFavoriteStore,
    listFavorites,
    removeFavorite,
    toggleFavorite,
} from "../lib/favorites/favorites";

export interface UseFavoritesResult {
    favorites: FavoriteEntry[];
    isFavorite: (setId: string, filename: string) => boolean;
    toggle: (entry: Omit<FavoriteEntry, "addedAt">) => boolean;
    remove: (setId: string, filename: string) => void;
}

export function useFavorites(userId: string | null): UseFavoritesResult {
    const [favorites, setFavorites] = useState<FavoriteEntry[]>(() =>
        userId ? listFavorites(userId) : [],
    );

    useEffect(() => {
        const refresh = () =>
            setFavorites(userId ? listFavorites(userId) : []);
        refresh();
        window.addEventListener(FAVORITES_CHANGE_EVENT, refresh);
        return () =>
            window.removeEventListener(FAVORITES_CHANGE_EVENT, refresh);
    }, [userId]);

    const isFavorite = useCallback(
        (setId: string, filename: string) =>
            userId ? isFavoriteStore(userId, setId, filename) : false,
        [userId],
    );
    const toggle = useCallback(
        (entry: Omit<FavoriteEntry, "addedAt">) =>
            userId ? toggleFavorite(userId, entry) : false,
        [userId],
    );
    const remove = useCallback(
        (setId: string, filename: string) => {
            if (userId) removeFavorite(userId, setId, filename);
        },
        [userId],
    );

    return {favorites, isFavorite, toggle, remove};
}

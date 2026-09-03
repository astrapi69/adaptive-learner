/**
 * Arcade mini-game catalog (#2887) - the two stage-A games of the
 * game mode's arcade, described with the shared unlockable vocabulary
 * (#2861): the learn-memory is free (it carries learning content),
 * the classic snake is the first XP-purchasable reward. The ticket
 * economy (#2889) plugs into the same ``unlock`` field later.
 */

import type {UnlockCondition} from "../gamification/unlockables";

export type ArcadeGameId = "memory" | "snake";

export interface ArcadeGame {
    id: ArcadeGameId;
    /** i18n key + fallback for the game name. */
    nameKey: string;
    nameFallback: string;
    /** i18n key + fallback for the one-line description. */
    descriptionKey: string;
    descriptionFallback: string;
    unlock: UnlockCondition;
}

/** XP price of the snake unlock (between the frame tiers 150/300). */
export const ARCADE_SNAKE_COST = 200;

export const ARCADE_GAMES: ArcadeGame[] = [
    {
        id: "memory",
        nameKey: "arcade.memory.name",
        nameFallback: "Learn Memory",
        descriptionKey: "arcade.memory.description",
        descriptionFallback:
            "Find the matching term and translation pairs from your lessons.",
        unlock: {kind: "default"},
    },
    {
        id: "snake",
        nameKey: "arcade.snake.name",
        nameFallback: "Snake",
        descriptionKey: "arcade.snake.description",
        descriptionFallback:
            "The classic: collect food, grow, do not bite yourself.",
        unlock: {kind: "xp", cost: ARCADE_SNAKE_COST},
    },
];

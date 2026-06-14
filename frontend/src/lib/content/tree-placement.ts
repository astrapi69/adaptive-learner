/**
 * Tree placement matcher (EXP-026 / UGC-01, #97).
 *
 * Decides which published content-set node a user-generated set
 * belongs to, so the Content Browser can fold the user's lessons in
 * next to the official content they extend (instead of only showing
 * them in a separate "My Lessons" section).
 *
 * Pure + deterministic — the single source of truth for "where does
 * this set go". Kept independent of ``buildContentTree`` so it can be
 * shared with the share-pipeline placement-engine later (EXP-026
 * Option B). It operates on ``ContentSetEntry`` metadata only; it never
 * loads lessons.
 *
 * Binding decisions (EXP-026 §Entscheidungen):
 *  - Match (language domain): ``baseLanguage(source)`` +
 *    ``baseLanguage(target)`` + normalized ``level``.
 *  - Match (knowledge domain, ``domain != "language"``): ``domain`` +
 *    exact set title (E3) — never a fuzzy title match.
 *  - Ambiguity (E1): more than one candidate → ``variationOf`` breaks
 *    the tie (it identifies the original set); without it → fallback.
 *  - Missing / malformed metadata → fallback (never guess).
 */

import type {ContentSetEntry} from "../../storage/types";
import {baseLanguage, domainOf} from "./content-tree";

/** Why a user-generated set could not be placed in the tree. */
export type PlacementFallbackReason =
    | "incomplete_metadata"
    | "same_language"
    | "no_matching_node"
    | "ambiguous";

/** Result of {@link resolveTreePlacement}. */
export type TreePlacement =
    | {matched: true; set: ContentSetEntry}
    | {matched: false; reason: PlacementFallbackReason};

/** The user-generated set metadata needed to place it. */
export interface UserSetPlacementInput {
    source_language: string;
    target_language: string;
    level: string;
    domain: string;
    title: string;
    /**
     * A representative ``variation_of`` from the set's lessons (the
     * original lesson/set id). Used ONLY to break ambiguity between
     * several candidate published sets (E1) — a fork (AUTH-06) carries
     * it pointing at the original it was derived from.
     */
    variationOf?: string | null;
}

/** Normalised level marker for matching ("A1" / " a1 " -> "a1"). */
function normLevel(level: string): string {
    return (level || "").trim().toLowerCase();
}

/** Normalised title for the knowledge-domain exact-title match. */
function normTitle(title: string): string {
    return (title || "").trim().toLowerCase();
}

/**
 * Does ``variationOf`` identify this published set? Matches the set id
 * exactly or as the prefix of a lesson id (``"<setId>-lesson-2"`` /
 * ``"<setId>/..."``) — the convention forks inherit.
 */
function variationPointsAt(variationOf: string, set: ContentSetEntry): boolean {
    return (
        variationOf === set.id ||
        variationOf.startsWith(`${set.id}-`) ||
        variationOf.startsWith(`${set.id}/`)
    );
}

/**
 * Resolve the published tree node a user-generated set folds into.
 *
 * @param userSet metadata of the user-generated set (pair / level /
 *   domain / title, plus an optional ``variationOf`` tie-breaker).
 * @param publishedSets the downloaded / official sets that form the
 *   tree (user-generated sets must be excluded by the caller).
 * @returns the matched published set, or a fallback with a reason so
 *   the caller keeps the set in the "My Lessons" section.
 *
 * @example
 * const placement = resolveTreePlacement(
 *   {source_language: "de", target_language: "es", level: "A1",
 *    domain: "language", title: "Mein Spanisch"},
 *   downloadedSets,
 * );
 * if (placement.matched) foldInto(placement.set);
 * else keepInMyLessons(placement.reason);
 */
export function resolveTreePlacement(
    userSet: UserSetPlacementInput,
    publishedSets: ContentSetEntry[],
): TreePlacement {
    const domain = (userSet.domain || "language").trim().toLowerCase();

    if (domain === "language") {
        const source = baseLanguage(userSet.source_language);
        const target = baseLanguage(userSet.target_language);
        const level = normLevel(userSet.level);
        if (!source || !target || !level) {
            return {matched: false, reason: "incomplete_metadata"};
        }
        // A "language" set that teaches its own language is malformed
        // (the real domain would be knowledge); never guess a node.
        if (source === target) {
            return {matched: false, reason: "same_language"};
        }
        const candidates = publishedSets.filter(
            (s) =>
                domainOf(s) === "language" &&
                baseLanguage(s.source_language) === source &&
                baseLanguage(s.target_language) === target &&
                normLevel(s.level) === level,
        );
        return pickCandidate(candidates, userSet.variationOf);
    }

    // Knowledge domain: domain match + exact title (E3).
    if (!domain || !normTitle(userSet.title)) {
        return {matched: false, reason: "incomplete_metadata"};
    }
    const candidates = publishedSets.filter(
        (s) =>
            domainOf(s) === domain &&
            normTitle(s.title) === normTitle(userSet.title),
    );
    return pickCandidate(candidates, userSet.variationOf);
}

/** Reduce a candidate list to a single placement, applying the E1
 *  ambiguity policy. */
function pickCandidate(
    candidates: ContentSetEntry[],
    variationOf: string | null | undefined,
): TreePlacement {
    if (candidates.length === 0) {
        return {matched: false, reason: "no_matching_node"};
    }
    if (candidates.length === 1) {
        return {matched: true, set: candidates[0]};
    }
    // Ambiguous: a variation_of tie-breaker must single out exactly one.
    if (variationOf) {
        const pinned = candidates.filter((s) => variationPointsAt(variationOf, s));
        if (pinned.length === 1) {
            return {matched: true, set: pinned[0]};
        }
    }
    return {matched: false, reason: "ambiguous"};
}

/**
 * Daily mission generator (EXP-010 / Phase 56C / P-157, P-162).
 *
 * Deterministic: the same user sees the same missions on the same
 * day across devices, because selection is driven by a PRNG seeded
 * from ``user_id + date``. Difficulty + category eligibility adapt
 * to the learner's history (new / active / veteran), and the same
 * mission is never assigned two days running.
 *
 * Pure - no storage access. The caller supplies the profile +
 * yesterday's template ids; the missions namespace persists the
 * result.
 */

import {getTemplates} from "./catalog";
import {isSupportedCheck} from "./checks";
import type {
    DifficultyMix,
    MissionDifficulty,
    MissionProfile,
    MissionTemplate,
} from "./types";

/** FNV-1a 32-bit hash → seed. */
function hashSeed(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** mulberry32 PRNG: deterministic, well-distributed, tiny. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const DIFFICULTY_SEQUENCES: Record<DifficultyMix, MissionDifficulty[]> = {
    balanced: ["easy", "medium", "hard"],
    easy: ["easy", "easy", "medium"],
    challenging: ["medium", "hard", "hard"],
};

/** Which categories a learner is eligible for, by history. */
export function eligibleCategories(profile: MissionProfile): Set<string> {
    // A brand-new user (no completed lessons) gets only the
    // gentle, always-doable categories.
    if (profile.lessonsCompleted === 0) {
        return new Set(["learning", "exploration"]);
    }
    const cats = new Set(["learning", "exploration", "streak"]);
    // Review + mastery only make sense once the learner has error
    // history to act on.
    if (profile.hasErrors) {
        cats.add("review");
        cats.add("mastery");
    }
    return cats;
}

/** Deterministic Fisher-Yates using the supplied rng. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

export interface AssignOptions {
    count?: number; // 1..3, default 3
    difficultyMix?: DifficultyMix; // default "balanced"
    /** Template ids assigned yesterday (never repeat back-to-back). */
    excludeIds?: readonly string[];
}

/**
 * Pick the day's missions for a user. Deterministic per
 * (userId, dateISO, profile, options).
 */
export function assignDailyMissions(
    userId: string,
    dateISO: string,
    profile: MissionProfile,
    options: AssignOptions = {},
): MissionTemplate[] {
    const count = Math.max(1, Math.min(3, options.count ?? 3));
    const mix = options.difficultyMix ?? "balanced";
    const exclude = new Set(options.excludeIds ?? []);
    const rng = mulberry32(hashSeed(`${userId}:${dateISO}:${mix}`));

    const cats = eligibleCategories(profile);
    const eligible = getTemplates().filter((t) => {
        // Only assign missions whose progress we can actually
        // track against existing data.
        if (!isSupportedCheck(t.check_function)) return false;
        if (!cats.has(t.category)) return false;
        if (exclude.has(t.id)) return false;
        // The weekend-learner mission is only offered on weekends.
        if (t.id === "weekend-learner" && !profile.isWeekend) return false;
        return true;
    });

    const sequence = DIFFICULTY_SEQUENCES[mix].slice(0, count);
    const picked: MissionTemplate[] = [];
    const pickedIds = new Set<string>();

    const pickFrom = (pool: MissionTemplate[]): MissionTemplate | null => {
        for (const t of pool) {
            if (!pickedIds.has(t.id)) return t;
        }
        return null;
    };

    for (const difficulty of sequence) {
        const order = shuffled(eligible, rng);
        // Prefer the requested difficulty; fall back to any
        // eligible template when that bucket is exhausted (small
        // catalogs / restricted new-user eligibility).
        const chosen =
            pickFrom(order.filter((t) => t.difficulty === difficulty)) ??
            pickFrom(order);
        if (chosen) {
            picked.push(chosen);
            pickedIds.add(chosen.id);
        }
    }

    return picked;
}

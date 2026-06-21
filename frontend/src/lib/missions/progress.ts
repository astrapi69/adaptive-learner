/**
 * Mission progress evaluation (EXP-010 / Phase 56C).
 *
 * Pure mapping from a template's ``check_function`` + a "today"
 * stats snapshot to {current, target, completed}. The snapshot is
 * gathered from storage (Dexie tables or the backend) by the
 * missions namespace; this module stays storage-agnostic so it is
 * trivially testable and identical in both modes.
 */

import type {MissionStats, MissionTemplate} from "./types";

export interface MissionProgress {
    current: number;
    target: number;
    completed: boolean;
}

/** Read the counter named by ``check_function`` from the snapshot.
 *  Unknown function names contribute 0 (never crash). */
export function readStat(
    checkFunction: string,
    stats: MissionStats,
): number {
    const value = (stats as unknown as Record<string, number>)[checkFunction];
    return typeof value === "number" ? value : 0;
}

/** Evaluate a mission template against today's stats snapshot,
 *  returning the clamped current value, target, and completion flag. */
export function evaluateProgress(
    template: MissionTemplate,
    stats: MissionStats,
): MissionProgress {
    const raw = readStat(template.check_function, stats);
    const current = Math.max(0, Math.min(raw, template.target_value));
    return {
        current,
        target: template.target_value,
        completed: raw >= template.target_value,
    };
}

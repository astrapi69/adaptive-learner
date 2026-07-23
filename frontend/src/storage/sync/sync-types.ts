/**
 * Sync conflict + outcome contracts (#1795 — extracted from
 * sync-engine.ts). Shared between the engine, the resolve dialog,
 * and the Settings panel.
 */

// ----- Conflict + resolution shapes -----------------------------------

export interface ConflictBundle {
    table: string;
    id: string;
    local: Record<string, unknown>;
    remote: Record<string, unknown>;
}

export type ConflictChoice = "local" | "remote" | "merged";

export interface ConflictResolution {
    table: string;
    id: string;
    chosen: ConflictChoice;
    merged_data?: Record<string, unknown>;
}

export interface SyncOutcome {
    pushed: number;
    pulled: number;
    conflictsResolved: number;
    summary: string;
}

/**
 * Optional callback the UI hooks in to resolve conflicts. The
 * SyncEngine fires it AFTER push reveals conflicts and BEFORE
 * the final resolve+pull. The callback returns one decision per
 * conflict.
 */
export type ConflictResolver = (
    conflicts: ConflictBundle[],
) => Promise<ConflictResolution[]>;

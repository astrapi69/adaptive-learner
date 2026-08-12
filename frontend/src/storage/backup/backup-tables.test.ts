/**
 * backup-tables (#1806).
 *
 * Structural pins for the declarative backup surface: the spec map
 * and the restore order must stay in lock-step (a table added to one
 * but not the other silently drops data - the BACKUP-API-RESTORE-01
 * failure class), FK parents must restore before their children, and
 * the api-key exclusion set must keep covering all three providers.
 */

import {describe, expect, it} from "vitest";

import {
    BACKUP_FORMAT,
    BACKUP_TABLES,
    BACKUP_VERSION,
    EXCLUDED_USER_SETTINGS_FIELDS,
    RESTORE_ORDER,
} from "./backup-tables";

describe("backup-tables parity", () => {
    it("RESTORE_ORDER and BACKUP_TABLES carry exactly the same tables", () => {
        expect([...RESTORE_ORDER].sort()).toEqual(
            Object.keys(BACKUP_TABLES).sort(),
        );
        expect(new Set(RESTORE_ORDER).size).toBe(RESTORE_ORDER.length);
    });

    it("restores FK parents before their children", () => {
        const position = (table: string) => RESTORE_ORDER.indexOf(table);
        expect(position("users")).toBe(0);
        expect(position("badges")).toBeLessThan(position("user_badges"));
        expect(position("learning_projects")).toBeLessThan(
            position("learning_sessions"),
        );
        expect(position("learning_sessions")).toBeLessThan(
            position("session_messages"),
        );
        expect(position("curriculums")).toBeLessThan(position("learning_topics"));
        expect(position("imported_conversations")).toBeLessThan(
            position("imported_messages"),
        );
    });

    it("every spec names a scope, timestamp field, and Dexie store", () => {
        for (const [table, spec] of Object.entries(BACKUP_TABLES)) {
            expect(spec.store, table).toBeTruthy();
            expect(spec.timestampField, table).toBeTruthy();
            expect(typeof spec.appendOnly, table).toBe("boolean");
        }
    });

    it("append-only history tables never claim the mutable merge path", () => {
        const appendOnly = Object.entries(BACKUP_TABLES)
            .filter(([, spec]) => spec.appendOnly)
            .map(([table]) => table)
            .sort();
        expect(appendOnly).toEqual([
            "imported_conversations",
            "imported_messages",
            "learning_sessions",
            "method_switches",
            "progress_commits",
            "project_subjects",
            "project_tags",
            "session_messages",
            "session_ratings",
            "step_evaluations",
        ]);
    });

    it("keeps the wire constants and the 3-provider key exclusion", () => {
        expect(BACKUP_FORMAT).toBe("adaptive-learner-backup");
        expect(BACKUP_VERSION).toBe("1.5.0");
        expect([...EXCLUDED_USER_SETTINGS_FIELDS].sort()).toEqual([
            "api_key_anthropic",
            "api_key_gemini",
            "api_key_openai",
        ]);
    });
});

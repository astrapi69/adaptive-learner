/**
 * backup-tables (#1806).
 *
 * Structural pins for the declarative backup surface: the spec map
 * and the restore order must stay in lock-step (a table added to one
 * but not the other silently drops data - the BACKUP-API-RESTORE-01
 * failure class), FK parents must restore before their children, and
 * the api-key exclusion set must cover every AI provider (#3367).
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {AI_PROVIDERS} from "../../lib/constants";

import {
    BACKUP_FORMAT,
    BACKUP_TABLES,
    BACKUP_VERSION,
    EXCLUDED_USER_SETTINGS_FIELDS,
    RESTORE_ORDER,
} from "./backup-tables";

describe("backup-tables parity", () => {
    it("carries speech_recordings - a Dexie table that silently rode with no backup coverage (#2824)", () => {
        // #2818/#2824: ext:al-speak-and-record (#2816) added the Dexie
        // `speechRecordings` store, but never registered it here - every
        // browser-mode export/import silently dropped every recording.
        expect(BACKUP_TABLES).toHaveProperty("speech_recordings");
        expect(BACKUP_TABLES.speech_recordings.store).toBe("speechRecordings");
        expect(RESTORE_ORDER).toContain("speech_recordings");
    });

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

    it("keeps the wire constants", () => {
        expect(BACKUP_FORMAT).toBe("adaptive-learner-backup");
        expect(BACKUP_VERSION).toBe("1.6.0");
    });
});

describe("api-key exclusion (#3367)", () => {
    it.each(AI_PROVIDERS)("excludes api_key_%s from user_settings", (provider) => {
        expect(EXCLUDED_USER_SETTINGS_FIELDS.has(`api_key_${provider}`)).toBe(true);
    });

    it("excludes exactly one field per provider", () => {
        expect(EXCLUDED_USER_SETTINGS_FIELDS.size).toBe(AI_PROVIDERS.length);
    });

    it("AI_PROVIDERS matches the backend AIProvider enum, which the backend exclusion derives from", () => {
        // The backend derives EXCLUDED_USER_SETTINGS_FIELDS from AIProvider
        // (backend/app/services/backup_export.py); this pin keeps the two
        // provider lists, and so both exclusion lists, in parity.
        const source = readFileSync(
            join(__dirname, "../../../../backend/app/schemas/__init__.py"),
            "utf-8",
        );
        const block = source.split("class AIProvider(str, Enum):")[1].split("\nclass ")[0];
        const backendProviders = [...block.matchAll(/^\s+[A-Z_]+ = "([a-z_]+)"$/gm)].map(
            (match) => match[1],
        );
        expect(backendProviders).toEqual([...AI_PROVIDERS]);
    });
});

describe("backup format version parity (#3363)", () => {
    it("matches the backend's BACKUP_VERSION, so one file format has one version", () => {
        const source = readFileSync(
            join(__dirname, "../../../../backend/app/services/backup_export.py"),
            "utf-8",
        );
        const match = source.match(/^BACKUP_VERSION = "([^"]+)"$/m);
        expect(match?.[1]).toBe(BACKUP_VERSION);
    });
});

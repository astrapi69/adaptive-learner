import {describe, expect, it} from "vitest";

import {
    MAX_BACKUP_BYTES,
    readBackupFile,
    validateBackupText,
} from "./validateBackupFile";

const validBackup = {
    format: "adaptive-learner-backup",
    version: "1.3.0",
    created_at: "2026-01-01T00:00:00.000Z",
    user_id: "user-1",
    storage_mode: "dexie",
    data: {users: [{id: "user-1"}]},
    stats: {total_records: 1, tables: {users: 1}},
};

describe("validateBackupText (#642)", () => {
    it("accepts a well-formed backup", () => {
        const r = validateBackupText(JSON.stringify(validBackup));
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.payload.user_id).toBe("user-1");
    });

    it.each<[string, string]>([
        ["invalid JSON", "{ not json"],
        ["truncated JSON", JSON.stringify(validBackup).slice(0, 40)],
        ["empty string (0-byte file)", ""],
        ["empty object", "{}"],
        ["array", "[]"],
        ["JSON string", '"hello"'],
        ["JSON number", "42"],
        ["JSON null", "null"],
        ["JSON true", "true"],
    ])("rejects %s as not_a_backup", (_label, text) => {
        const r = validateBackupText(text);
        expect(r).toEqual({ok: false, error: "not_a_backup"});
    });

    it("rejects a backup from another app (foreign format)", () => {
        const foreign = {...validBackup, format: "bibliogon-backup"};
        expect(validateBackupText(JSON.stringify(foreign))).toEqual({
            ok: false,
            error: "not_a_backup",
        });
    });

    it("rejects a missing version", () => {
        const {version: _v, ...noVersion} = validBackup;
        expect(validateBackupText(JSON.stringify(noVersion))).toEqual({
            ok: false,
            error: "not_a_backup",
        });
    });

    it("rejects an empty version", () => {
        expect(
            validateBackupText(JSON.stringify({...validBackup, version: ""})),
        ).toEqual({ok: false, error: "not_a_backup"});
    });

    it("rejects a non-string version", () => {
        expect(
            validateBackupText(JSON.stringify({...validBackup, version: 13})),
        ).toEqual({ok: false, error: "not_a_backup"});
    });

    it("rejects a missing data segment", () => {
        const {data: _d, ...noData} = validBackup;
        expect(validateBackupText(JSON.stringify(noData))).toEqual({
            ok: false,
            error: "not_a_backup",
        });
    });
});

function fileOf(content: string, name = "backup.json"): File {
    return new File([content], name, {type: "application/json"});
}

describe("readBackupFile (#642)", () => {
    it("reads + validates a real backup file", async () => {
        const r = await readBackupFile(fileOf(JSON.stringify(validBackup)));
        expect(r.ok).toBe(true);
    });

    it("rejects a non-JSON text file as not_a_backup", async () => {
        const r = await readBackupFile(
            new File(["just some notes"], "notes.txt", {type: "text/plain"}),
        );
        expect(r).toEqual({ok: false, error: "not_a_backup"});
    });

    it("rejects an empty (0-byte) file as not_a_backup", async () => {
        const r = await readBackupFile(fileOf(""));
        expect(r).toEqual({ok: false, error: "not_a_backup"});
    });

    it("rejects an over-large file by size, without reading it", async () => {
        const file = fileOf(JSON.stringify(validBackup));
        // Pretend the file is just over the limit; the guard must trip on
        // size before ``.text()`` is ever called.
        Object.defineProperty(file, "size", {value: MAX_BACKUP_BYTES + 1});
        let textCalled = false;
        Object.defineProperty(file, "text", {
            value: async () => {
                textCalled = true;
                return "";
            },
        });
        const r = await readBackupFile(file);
        expect(r).toEqual({ok: false, error: "too_large"});
        expect(textCalled).toBe(false);
    });

    it("accepts a file exactly at the size limit", async () => {
        const file = fileOf(JSON.stringify(validBackup));
        Object.defineProperty(file, "size", {value: MAX_BACKUP_BYTES});
        const r = await readBackupFile(file);
        expect(r.ok).toBe(true);
    });
});

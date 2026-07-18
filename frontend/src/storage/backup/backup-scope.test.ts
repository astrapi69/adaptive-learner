/**
 * backup-scope (#1806).
 *
 * Direct pins for the pure scoping helpers: all seven
 * ``rowsBelongToUser`` scopes, the defensive restore-side ownership
 * check, api-key stripping on both paths, and timestamp parsing for
 * the newer-side-wins merge.
 */

import {describe, expect, it} from "vitest";

import {
    dropApiKeyFields,
    parseTimestamp,
    recordBelongsToUser,
    rowsBelongToUser,
    stripExcludedFields,
    type ScopedIdSets,
} from "./backup-scope";
import {BACKUP_TABLES, type BackupTableSpec} from "./backup-tables";

const USER = "u-1";

const SCOPES: ScopedIdSets = {
    projectIds: new Set(["p-1"]),
    curriculumIds: new Set(["c-1"]),
    sessionIds: new Set(["s-1"]),
    conversationIds: new Set(["conv-1"]),
};

function spec(scope: BackupTableSpec["scope"]): BackupTableSpec {
    return {store: "users", timestampField: "updated_at", appendOnly: false, scope};
}

describe("rowsBelongToUser", () => {
    it("self: keeps only the row whose id IS the user", () => {
        const rows = [{id: USER}, {id: "u-2"}];
        expect(rowsBelongToUser(spec("self"), rows, USER, SCOPES)).toEqual([
            {id: USER},
        ]);
    });

    it("user: filters on user_id", () => {
        const rows = [
            {id: "a", user_id: USER},
            {id: "b", user_id: "u-2"},
        ];
        expect(rowsBelongToUser(spec("user"), rows, USER, SCOPES)).toEqual([
            {id: "a", user_id: USER},
        ]);
    });

    it("via_* scopes resolve through the id sets and drop non-strings", () => {
        expect(
            rowsBelongToUser(
                spec("via_project"),
                [{id: "a", project_id: "p-1"}, {id: "b", project_id: "p-9"}, {id: "c"}],
                USER,
                SCOPES,
            ),
        ).toEqual([{id: "a", project_id: "p-1"}]);
        expect(
            rowsBelongToUser(
                spec("via_curriculum"),
                [{id: "a", curriculum_id: "c-1"}, {id: "b", curriculum_id: "c-9"}],
                USER,
                SCOPES,
            ),
        ).toEqual([{id: "a", curriculum_id: "c-1"}]);
        expect(
            rowsBelongToUser(
                spec("via_session"),
                [{id: "a", session_id: "s-1"}, {id: "b", session_id: "s-9"}],
                USER,
                SCOPES,
            ),
        ).toEqual([{id: "a", session_id: "s-1"}]);
        expect(
            rowsBelongToUser(
                spec("via_conversation"),
                [{id: "a", conversation_id: "conv-1"}, {id: "b", conversation_id: "x"}],
                USER,
                SCOPES,
            ),
        ).toEqual([{id: "a", conversation_id: "conv-1"}]);
    });

    it("global: every row travels (subjects taxonomy)", () => {
        const rows = [{id: "a"}, {id: "b", user_id: "u-2"}];
        expect(rowsBelongToUser(spec("global"), rows, USER, SCOPES)).toEqual(rows);
    });
});

describe("recordBelongsToUser", () => {
    it("self scope compares the record id itself", () => {
        expect(recordBelongsToUser(spec("self"), {id: USER}, USER)).toBe(true);
        expect(recordBelongsToUser(spec("self"), {id: "u-2"}, USER)).toBe(false);
    });

    it("rejects a foreign user_id and accepts a missing one", () => {
        expect(
            recordBelongsToUser(spec("user"), {id: "a", user_id: "u-2"}, USER),
        ).toBe(false);
        expect(recordBelongsToUser(spec("user"), {id: "a"}, USER)).toBe(true);
        expect(
            recordBelongsToUser(spec("user"), {id: "a", user_id: null}, USER),
        ).toBe(true);
    });
});

describe("api-key stripping", () => {
    const ROW = {
        id: "st-1",
        user_id: USER,
        api_key_anthropic: "sk-ant-secret",
        api_key_openai: "sk-secret",
        api_key_gemini: "AI-secret",
        active_provider: "anthropic",
    };

    it("stripExcludedFields removes the keys only for user_settings", () => {
        const stripped = stripExcludedFields("user_settings", ROW);
        expect(Object.keys(stripped).sort()).toEqual([
            "active_provider",
            "id",
            "user_id",
        ]);
        expect(stripExcludedFields("users", ROW)).toBe(ROW);
    });

    it("dropApiKeyFields removes exactly the three provider keys", () => {
        const dropped = dropApiKeyFields(ROW);
        expect(dropped).toEqual({
            id: "st-1",
            user_id: USER,
            active_provider: "anthropic",
        });
    });
});

describe("parseTimestamp", () => {
    it("parses ISO strings and rejects empties / garbage / non-strings", () => {
        expect(parseTimestamp("2026-07-18T10:00:00Z")).toBe(
            Date.parse("2026-07-18T10:00:00Z"),
        );
        expect(parseTimestamp("")).toBeNull();
        expect(parseTimestamp("not-a-date")).toBeNull();
        expect(parseTimestamp(null)).toBeNull();
        expect(parseTimestamp(1234567890)).toBeNull();
    });
});

describe("spec sanity against the real table map", () => {
    it("the users table is the only self-scoped spec", () => {
        const selfScoped = Object.entries(BACKUP_TABLES)
            .filter(([, tableSpec]) => tableSpec.scope === "self")
            .map(([table]) => table);
        expect(selfScoped).toEqual(["users"]);
    });
});

import {describe, expect, it, vi} from "vitest";

import {isEmptyInstall, pickAdoptedIdentity} from "./firstRunRestore";
import type {IStorageService} from "../storage/types";
import type {BackupPayload} from "../types/domain";

function backup(
    overrides: Partial<BackupPayload> & {
        data?: Record<string, Record<string, unknown>[]>;
    } = {},
): BackupPayload {
    return {
        format: "adaptive-learner-backup",
        version: "1.3.0",
        created_at: "2026-06-09T00:00:00Z",
        user_id: "user-1",
        storage_mode: "dexie",
        data: {},
        stats: {total_records: 0, tables: {}},
        ...overrides,
    } as BackupPayload;
}

describe("pickAdoptedIdentity", () => {
    it("extracts user, active project, and language from a full payload", () => {
        const identity = pickAdoptedIdentity(
            backup({
                user_id: "user-1",
                data: {
                    users: [{id: "user-1", language: "de"}],
                    learning_projects: [
                        {id: "proj-old", user_id: "user-1", active: false},
                        {id: "proj-active", user_id: "user-1", active: true},
                    ],
                    user_settings: [{user_id: "user-1", language: "en"}],
                },
            }),
        );
        expect(identity).toEqual({
            userId: "user-1",
            projectId: "proj-active",
            language: "de",
        });
    });

    it("falls back to the first project when none is marked active", () => {
        const identity = pickAdoptedIdentity(
            backup({
                data: {
                    learning_projects: [
                        {id: "proj-a", user_id: "user-1"},
                        {id: "proj-b", user_id: "user-1"},
                    ],
                },
            }),
        );
        expect(identity.projectId).toBe("proj-a");
    });

    it("only considers projects owned by the adopted user", () => {
        const identity = pickAdoptedIdentity(
            backup({
                user_id: "user-1",
                data: {
                    learning_projects: [
                        {id: "proj-other", user_id: "user-2", active: true},
                        {id: "proj-mine", user_id: "user-1", active: true},
                    ],
                },
            }),
        );
        expect(identity.projectId).toBe("proj-mine");
    });

    it("falls back to the first users row when top-level user_id is missing", () => {
        const identity = pickAdoptedIdentity(
            backup({
                user_id: "" as unknown as string,
                data: {users: [{id: "user-from-row"}]},
            }),
        );
        expect(identity.userId).toBe("user-from-row");
    });

    it("falls back to user_settings language when the user row has none", () => {
        const identity = pickAdoptedIdentity(
            backup({
                data: {
                    users: [{id: "user-1"}],
                    user_settings: [{user_id: "user-1", language: "fr"}],
                },
            }),
        );
        expect(identity.language).toBe("fr");
    });

    it("returns an empty userId for a payload with no user", () => {
        const identity = pickAdoptedIdentity(
            backup({user_id: "" as unknown as string, data: {}}),
        );
        expect(identity).toEqual({userId: "", projectId: null, language: null});
    });
});

type EmptyInstallStorage = Pick<IStorageService, "users" | "lessonProgress">;

function storageMock(opts: {
    findMostRecent?: () => Promise<{userId: string} | null>;
    projects?: () => Promise<unknown[]>;
    progress?: () => Promise<unknown[]>;
}): EmptyInstallStorage {
    return {
        users: {
            findMostRecent:
                opts.findMostRecent ?? (() => Promise.resolve(null)),
            projects: {list: opts.projects ?? (() => Promise.resolve([]))},
        },
        lessonProgress: {
            list: opts.progress ?? (() => Promise.resolve([])),
        },
    } as unknown as EmptyInstallStorage;
}

describe("isEmptyInstall", () => {
    it("is empty when there is no persisted user and nothing to recover", async () => {
        const storage = storageMock({});
        expect(await isEmptyInstall(storage, null)).toBe(true);
    });

    it("is not empty when a recovered user has projects", async () => {
        const storage = storageMock({
            findMostRecent: () => Promise.resolve({userId: "user-1"}),
            projects: () => Promise.resolve([{id: "proj-1"}]),
        });
        expect(await isEmptyInstall(storage, null)).toBe(false);
    });

    it("is not empty when the persisted user has lesson progress", async () => {
        const storage = storageMock({
            projects: () => Promise.resolve([]),
            progress: () => Promise.resolve([{id: "lp-1"}]),
        });
        expect(await isEmptyInstall(storage, "user-1")).toBe(false);
    });

    it("is empty when the persisted user has no projects and no progress", async () => {
        const storage = storageMock({});
        expect(await isEmptyInstall(storage, "user-1")).toBe(true);
    });

    it("treats a findMostRecent failure as no recoverable user", async () => {
        const findMostRecent = vi.fn(() => Promise.reject(new Error("boom")));
        const storage = storageMock({findMostRecent});
        expect(await isEmptyInstall(storage, null)).toBe(true);
    });

    it("falls back to offering restore when a data query throws", async () => {
        const storage = storageMock({
            projects: () => Promise.reject(new Error("db down")),
        });
        expect(await isEmptyInstall(storage, "user-1")).toBe(true);
    });
});

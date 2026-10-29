/**
 * The client-side blocks of a restored backup (#3785): the device's active
 * learner never comes from the file, and values keyed by the backup's
 * learner move to the local one on a Settings import.
 */

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {restoreClientSnapshots} from "./portableBackup";
import type {BackupPayload} from "../../types/domain";

const FRAMES = "adaptive-learner.avatar.frames";

function payloadOf(owner: string): BackupPayload {
    return {
        user_id: owner,
        data: {},
        local_storage: {
            "adaptive-learner.user_id": owner,
            "adaptive-learner.project_id": `${owner}-project`,
            [FRAMES]: `{"${owner}":{"selected":"gold"}}`,
        },
    } as unknown as BackupPayload;
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("restoreClientSnapshots (#3785)", () => {
    it("Settings import: the active learner stays, keyed values move to it", async () => {
        localStorage.setItem("adaptive-learner.user_id", "u-a");
        localStorage.setItem("adaptive-learner.project_id", "u-a-project");
        await restoreClientSnapshots(payloadOf("u-b"), "u-a");
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-a");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe("u-a-project");
        expect(localStorage.getItem(FRAMES)).toBe('{"u-a":{"selected":"gold"}}');
    });

    it("first-run restore: the identity onboarding set beforehand survives the snapshot", async () => {
        // Onboarding adopts the backup's identity itself, then imports.
        localStorage.setItem("adaptive-learner.user_id", "u-b");
        localStorage.setItem("adaptive-learner.project_id", "u-b-active");
        await restoreClientSnapshots(payloadOf("u-b"));
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-b");
        expect(localStorage.getItem("adaptive-learner.project_id")).toBe("u-b-active");
        expect(localStorage.getItem(FRAMES)).toBe('{"u-b":{"selected":"gold"}}');
    });
});

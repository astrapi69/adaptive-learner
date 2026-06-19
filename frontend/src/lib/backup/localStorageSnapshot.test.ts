/**
 * P1 offline parity — localStorage snapshot capture/apply + secrets
 * exclusion + backward-compatibility.
 */

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
    applyLocalStorageSnapshot,
    captureLocalStorageSnapshot,
    isExcludedLocalStorageKey,
    withLocalStorageSnapshot,
} from "./localStorageSnapshot";
import {buildAlbBytes, parseAlbBytes} from "./albContainer";
import type {BackupPayload} from "../../types/domain";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("captureLocalStorageSnapshot", () => {
    it("captures namespaced user keys", () => {
        localStorage.setItem("adaptive-learner.theme", "ocean");
        localStorage.setItem("adaptive-learner.contributions", '[{"id":"x"}]');
        localStorage.setItem("adaptive-learner.voice.tts_enabled", "true");

        const snap = captureLocalStorageSnapshot();

        expect(snap["adaptive-learner.theme"]).toBe("ocean");
        expect(snap["adaptive-learner.contributions"]).toBe('[{"id":"x"}]');
        expect(snap["adaptive-learner.voice.tts_enabled"]).toBe("true");
    });

    it("excludes secret keys (tokens, api keys, passwords)", () => {
        localStorage.setItem("adaptive-learner.github_token", "ghp_secret");
        localStorage.setItem(
            "adaptive-learner.content_repo_token::owner/repo",
            "tok",
        );
        localStorage.setItem("adaptive-learner.some_api_key", "sk-secret");
        localStorage.setItem("adaptive-learner.theme", "dark");

        const snap = captureLocalStorageSnapshot();

        expect(snap).not.toHaveProperty("adaptive-learner.github_token");
        expect(snap).not.toHaveProperty(
            "adaptive-learner.content_repo_token::owner/repo",
        );
        expect(snap).not.toHaveProperty("adaptive-learner.some_api_key");
        expect(snap["adaptive-learner.theme"]).toBe("dark");
    });

    it("excludes the device-local storage_mode key", () => {
        localStorage.setItem("adaptive-learner.storage_mode", "dexie");
        expect(captureLocalStorageSnapshot()).not.toHaveProperty(
            "adaptive-learner.storage_mode",
        );
    });

    it("ignores non-namespaced (third-party) keys", () => {
        localStorage.setItem("some-other-app.token", "x");
        localStorage.setItem("adaptive-learner.language", "de");

        const snap = captureLocalStorageSnapshot();

        expect(snap).not.toHaveProperty("some-other-app.token");
        expect(snap["adaptive-learner.language"]).toBe("de");
    });
});

describe("applyLocalStorageSnapshot", () => {
    it("writes keys and overwrites existing values (backup is source of truth)", () => {
        localStorage.setItem("adaptive-learner.theme", "light");

        const applied = applyLocalStorageSnapshot({
            "adaptive-learner.theme": "forest",
            "adaptive-learner.feedback.intensity": "enthusiastic",
        });

        expect(applied).toBe(2);
        expect(localStorage.getItem("adaptive-learner.theme")).toBe("forest");
        expect(localStorage.getItem("adaptive-learner.feedback.intensity")).toBe(
            "enthusiastic",
        );
    });

    it("re-applies the exclusion filter (a smuggled secret is never written)", () => {
        const applied = applyLocalStorageSnapshot({
            "adaptive-learner.github_token": "ghp_injected",
            "adaptive-learner.theme": "sepia",
        });

        expect(applied).toBe(1);
        expect(localStorage.getItem("adaptive-learner.github_token")).toBeNull();
        expect(localStorage.getItem("adaptive-learner.theme")).toBe("sepia");
    });

    it("is a no-op for a legacy backup with no snapshot", () => {
        localStorage.setItem("adaptive-learner.theme", "dark");
        expect(applyLocalStorageSnapshot(undefined)).toBe(0);
        expect(applyLocalStorageSnapshot(null)).toBe(0);
        expect(localStorage.getItem("adaptive-learner.theme")).toBe("dark");
    });
});

describe("roundtrip", () => {
    it("capture -> clear -> apply restores every non-secret key", () => {
        localStorage.setItem("adaptive-learner.contributions", '[{"id":"a"}]');
        localStorage.setItem("adaptive-learner.contributor-name", "Aster");
        localStorage.setItem("adaptive-learner.custom-paths", '["p1"]');
        localStorage.setItem("adaptive-learner.github_token", "ghp_secret");

        const base: {format: string; local_storage?: Record<string, string>} = {
            format: "adaptive-learner-backup",
        };
        const payload = withLocalStorageSnapshot(base);
        localStorage.clear();

        const applied = applyLocalStorageSnapshot(payload.local_storage);

        expect(applied).toBe(3);
        expect(localStorage.getItem("adaptive-learner.contributions")).toBe(
            '[{"id":"a"}]',
        );
        expect(localStorage.getItem("adaptive-learner.contributor-name")).toBe(
            "Aster",
        );
        expect(localStorage.getItem("adaptive-learner.custom-paths")).toBe('["p1"]');
        // The secret never round-tripped.
        expect(localStorage.getItem("adaptive-learner.github_token")).toBeNull();
    });
});

describe(".alb container roundtrip", () => {
    it("preserves the local_storage block through buildAlbBytes/parseAlbBytes", () => {
        const payload: BackupPayload = {
            format: "adaptive-learner-backup",
            version: "1.4.0",
            created_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            storage_mode: "dexie",
            data: {users: [{id: "user-1"}]},
            local_storage: {
                "adaptive-learner.theme": "ocean",
                "adaptive-learner.contributions": '[{"id":"a"}]',
            },
            stats: {total_records: 1, tables: {users: 1}},
        };

        const parsed = parseAlbBytes(buildAlbBytes(payload), 100 * 1024 * 1024);

        expect(parsed.payload.local_storage).toEqual({
            "adaptive-learner.theme": "ocean",
            "adaptive-learner.contributions": '[{"id":"a"}]',
        });
    });
});

describe("isExcludedLocalStorageKey", () => {
    it.each([
        "adaptive-learner.github_token",
        "adaptive-learner.content_repo_token::a/b",
        "adaptive-learner.foo_api_key",
        "adaptive-learner.my_secret",
        "adaptive-learner.storage_mode",
    ])("excludes %s", (key) => {
        expect(isExcludedLocalStorageKey(key)).toBe(true);
    });

    it.each([
        "adaptive-learner.theme",
        "adaptive-learner.contributions",
        "adaptive-learner.voice.tts_enabled",
    ])("keeps %s", (key) => {
        expect(isExcludedLocalStorageKey(key)).toBe(false);
    });
});

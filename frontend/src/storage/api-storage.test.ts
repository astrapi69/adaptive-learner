/**
 * ApiStorage delegation tests (Phase 10A).
 *
 * Verifies that every IStorageService method routes to the
 * matching fetch call on the FastAPI backend. We don't re-test
 * the apiCall URL/error helpers (client.test.ts covers those);
 * here we just pin that the storage layer is a faithful
 * pass-through.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {apiStorage} from "./api-storage";

interface MockCall {
    url: string;
    method: string;
    body: unknown;
}

let calls: MockCall[];

beforeEach(() => {
    calls = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : (input as URL).toString();
        let body: unknown = undefined;
        if (typeof init?.body === "string") {
            try {
                body = JSON.parse(init.body);
            } catch {
                body = init.body;
            }
        }
        calls.push({
            url,
            method: (init?.method ?? "GET").toUpperCase(),
            body,
        });
        return new Response("{}", {status: 200});
    }) as unknown as typeof fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("ApiStorage delegation", () => {
    it("exposes mode 'api'", () => {
        expect(apiStorage.mode).toBe("api");
    });

    it("users.create POSTs to /api/users", async () => {
        await apiStorage.users.create({name: "Asterios"});
        expect(calls[0].url).toBe("/api/users");
        expect(calls[0].method).toBe("POST");
        expect(calls[0].body).toEqual({name: "Asterios"});
    });

    it("users.get fetches /api/users/{id}", async () => {
        await apiStorage.users.get("u1");
        expect(calls[0].url).toBe("/api/users/u1");
        expect(calls[0].method).toBe("GET");
    });

    it("users.projects.list and .create route correctly", async () => {
        await apiStorage.users.projects.list("u1");
        expect(calls[0].url).toBe("/api/users/u1/projects");
        expect(calls[0].method).toBe("GET");

        await apiStorage.users.projects.create("u1", {
            topic: "T",
            goal: "G",
            timeframe: "F",
            daily_minutes: 10,
        });
        expect(calls[1].url).toBe("/api/users/u1/projects");
        expect(calls[1].method).toBe("POST");
    });

    it("users.findMostRecent reads /api/identity and maps to RecoveryHint", async () => {
        // Phase 41B: identity.yaml -> RecoveryHint adapter.
        const responseBody = JSON.stringify({
            user_id: "u-restored",
            active_project_id: "p-restored",
            language: "de",
            last_seen: "2026-05-23T10:00:00Z",
        });
        global.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : (input as URL).toString();
            calls.push({url, method: "GET", body: undefined});
            return new Response(responseBody, {status: 200});
        }) as unknown as typeof fetch;

        const hint = await apiStorage.users.findMostRecent();
        expect(calls[0].url).toBe("/api/identity");
        expect(hint).toEqual({
            userId: "u-restored",
            projectId: "p-restored",
            language: "de",
        });
    });

    it("users.findMostRecent returns null on 404 (no identity.yaml)", async () => {
        global.fetch = vi.fn(async () => {
            return new Response(
                JSON.stringify({detail: "No persisted identity found."}),
                {status: 404},
            );
        }) as unknown as typeof fetch;
        const hint = await apiStorage.users.findMostRecent();
        expect(hint).toBeNull();
    });

    it("projects.get + update", async () => {
        await apiStorage.projects.get("p1");
        expect(calls[0].url).toBe("/api/projects/p1");
        await apiStorage.projects.update("p1", {topic: "T2"});
        expect(calls[1].method).toBe("PATCH");
    });

    it("settings.get + setApiKey + deleteApiKey", async () => {
        await apiStorage.settings.get("u1");
        expect(calls[0].url).toBe("/api/settings/u1");

        await apiStorage.settings.setApiKey("u1", {
            provider: "anthropic",
            key: "sk-x",
        });
        expect(calls[1].url).toBe("/api/settings/u1/api-key");
        expect(calls[1].method).toBe("POST");

        await apiStorage.settings.deleteApiKey("u1", "anthropic");
        expect(calls[2].url).toBe("/api/settings/u1/api-key/anthropic");
        expect(calls[2].method).toBe("DELETE");
    });

    it("settings.getApp returns an empty record without firing a network call", async () => {
        const config = await apiStorage.settings.getApp();
        expect(config).toEqual({});
        expect(calls).toHaveLength(0);
    });

    it("settings.getAvailableModels passes provider as a query parameter", async () => {
        await apiStorage.settings.getAvailableModels("u1", "openai");
        expect(calls[0].url).toBe("/api/settings/u1/available-models?provider=openai");
        expect(calls[0].method).toBe("GET");
    });

    it("assessment.questions encodes lang", async () => {
        await apiStorage.assessment.questions("de");
        expect(calls[0].url).toBe("/api/plugins/assessment/questions?lang=de");
    });

    it("session lifecycle routes", async () => {
        await apiStorage.session.start({project_id: "p1"});
        expect(calls[0].url).toBe("/api/plugins/session/start");

        await apiStorage.session.message("s1", {role: "user", content: "hi"});
        expect(calls[1].url).toBe("/api/plugins/session/s1/message");

        await apiStorage.session.rate("s1", {
            understanding: 4,
            stress: 2,
            method_fit: 5,
        });
        expect(calls[2].url).toBe("/api/plugins/session/s1/rate");

        await apiStorage.session.end("s1");
        expect(calls[3].url).toBe("/api/plugins/session/s1/end");

        await apiStorage.session.switchRecommendation("s1");
        expect(calls[4].url).toBe("/api/plugins/session/switch-recommendation/s1");

        await apiStorage.session.acceptSwitch("s1", {
            to_method: "dialogic",
            reason: "fit",
        });
        expect(calls[5].url).toBe("/api/plugins/session/s1/switch");
    });

    it("tracking + tools routes", async () => {
        await apiStorage.tracking.progress("p1");
        expect(calls[0].url).toBe("/api/plugins/tracking/progress/p1");

        await apiStorage.tracking.commits("p1");
        expect(calls[1].url).toBe("/api/plugins/tracking/commits/p1");

        await apiStorage.tools.recommendations("p1", "en");
        expect(calls[2].url).toBe("/api/plugins/tools/recommendations/p1?lang=en");

        await apiStorage.tools.spaced("p1", "en");
        expect(calls[3].url).toBe("/api/plugins/tools/spaced/p1?lang=en");
    });

    it("curricula CRUD + topics/lessons routes", async () => {
        await apiStorage.curricula.list("u1");
        expect(calls[0].url).toBe("/api/users/u1/curricula");

        await apiStorage.curricula.get("c1");
        expect(calls[1].url).toBe("/api/curricula/c1");

        await apiStorage.curricula.createTopic("c1", {title: "T"});
        expect(calls[2].url).toBe("/api/curricula/c1/topics");
        expect(calls[2].method).toBe("POST");

        await apiStorage.curricula.createLesson("c1", {title: "L"});
        expect(calls[3].url).toBe("/api/curricula/c1/lessons");

        await apiStorage.topics.update("t1", {title: "T2"});
        expect(calls[4].url).toBe("/api/topics/t1");
        expect(calls[4].method).toBe("PATCH");

        await apiStorage.lessons.remove("l1");
        expect(calls[5].url).toBe("/api/lessons/l1");
        expect(calls[5].method).toBe("DELETE");
    });
});

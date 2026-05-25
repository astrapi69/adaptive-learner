/** Vitest pins for the learning-repo + pluginSettings API helpers. */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {api} from "./client";

describe("api.learningRepo", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url.includes("/render/")) {
                return new Response(
                    JSON.stringify({
                        project_id: "p-1",
                        language: "en",
                        rendered_at: "2026-05-25T10:00:00Z",
                        files: {"README.md": "hello"},
                    }),
                    {status: 200, headers: {"content-type": "application/json"}},
                );
            }
            if (url.includes("/export-zip/")) {
                return new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
                    status: 200,
                    headers: {"content-type": "application/zip"},
                });
            }
            if (url.includes("/persist/")) {
                return new Response(
                    JSON.stringify({
                        project_id: "p-1",
                        language: "en",
                        rendered_at: "2026-05-25T10:00:00Z",
                        files_written: 4,
                        repo_path: "/tmp/p-1",
                        commit_sha: "a".repeat(40),
                        tag: null,
                    }),
                    {status: 200, headers: {"content-type": "application/json"}},
                );
            }
            return new Response("", {status: 404});
        });
        // @ts-expect-error globalThis.fetch overwrite for the test.
        globalThis.fetch = fetchSpy;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("render() GETs the render endpoint and returns the parsed body", async () => {
        const data = await api.learningRepo.render("p-1");
        expect(data.project_id).toBe("p-1");
        expect(data.files["README.md"]).toBe("hello");
        const url = fetchSpy.mock.calls[0][0] as string;
        expect(url).toContain("/plugins/learning-repo/render/p-1");
    });

    it("render() appends ?language= when supplied", async () => {
        await api.learningRepo.render("p-1", "de");
        const url = fetchSpy.mock.calls[0][0] as string;
        expect(url).toContain("language=de");
    });

    it("exportZip() POSTs and returns a Blob", async () => {
        const blob = await api.learningRepo.exportZip("p-1");
        expect(blob).toBeInstanceOf(Blob);
        const init = fetchSpy.mock.calls[0][1] as RequestInit;
        expect(init.method).toBe("POST");
    });

    it("exportZip() appends ?language= when supplied", async () => {
        await api.learningRepo.exportZip("p-1", "ja");
        const url = fetchSpy.mock.calls[0][0] as string;
        expect(url).toContain("language=ja");
    });

    it("persist() POSTs and returns the parsed body with commit_sha", async () => {
        const data = await api.learningRepo.persist("p-1");
        expect(data.commit_sha).toBe("a".repeat(40));
        expect(data.tag).toBeNull();
        const init = fetchSpy.mock.calls[0][1] as RequestInit;
        expect(init.method).toBe("POST");
    });
});

describe("api.pluginSettings", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchSpy = vi.fn(
            async (input: RequestInfo | URL, init?: RequestInit) =>
                new Response(
                    JSON.stringify({
                        plugin: "learning-repo",
                        settings:
                            init?.method === "PATCH"
                                ? JSON.parse(init.body as string).settings
                                : {enable_git: false, repos_dir: "/tmp"},
                    }),
                    {status: 200, headers: {"content-type": "application/json"}},
                ),
        );
        // @ts-expect-error globalThis.fetch overwrite for the test.
        globalThis.fetch = fetchSpy;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("get() returns the parsed settings payload", async () => {
        const body = await api.pluginSettings.get("learning-repo");
        expect(body.plugin).toBe("learning-repo");
        expect(body.settings.enable_git).toBe(false);
    });

    it("update() PATCHes the settings and echoes them back", async () => {
        const body = await api.pluginSettings.update("learning-repo", {
            settings: {enable_git: true, repos_dir: "/home/user/repos"},
        });
        expect(body.settings.enable_git).toBe(true);
        const init = fetchSpy.mock.calls[0][1] as RequestInit;
        expect(init.method).toBe("PATCH");
    });
});

/**
 * Tests for the GitHub repo-export client methods (#1017): ensureRepo
 * (reuse vs create) and pushFiles (single-commit Git Data API). Uses a
 * scripted mock fetch so no network is touched.
 */

import {describe, expect, it, vi} from "vitest";

import {GitHubApi} from "./github-api";

function jsonResponse(status: number, body: unknown): Response {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: new Headers(),
        json: async () => body,
    } as unknown as Response;
}

describe("GitHubApi.ensureRepo", () => {
    it("reuses an existing repo (no create call)", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, {default_branch: "main"}));
        const api = new GitHubApi("tok", {fetchImpl});
        const res = await api.ensureRepo("me/repo", {private: true});
        expect(res.defaultBranch).toBe("main");
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl.mock.calls[0][0]).toContain("/repos/me/repo");
    });

    it("creates the repo when it does not exist (404 → POST /user/repos)", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(404, {message: "Not Found"}))
            .mockResolvedValueOnce(jsonResponse(201, {default_branch: "main"}));
        const api = new GitHubApi("tok", {fetchImpl});
        const res = await api.ensureRepo("me/new-repo", {
            private: false,
            description: "d",
        });
        expect(res.defaultBranch).toBe("main");
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        const [url, init] = fetchImpl.mock.calls[1];
        expect(url).toContain("/user/repos");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body).auto_init).toBe(true);
    });
});

describe("GitHubApi.pushFiles", () => {
    it("commits all files in one commit via blobs → tree → commit → ref", async () => {
        const calls: Array<{url: string; method: string}> = [];
        const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
            const u = String(url);
            calls.push({url: u, method: (init?.method ?? "GET") as string});
            if (u.endsWith("/git/ref/heads/main")) {
                return jsonResponse(200, {object: {sha: "base"}});
            }
            if (u.includes("/git/commits/base")) {
                return jsonResponse(200, {tree: {sha: "basetree"}});
            }
            if (u.endsWith("/git/blobs")) {
                return jsonResponse(201, {sha: "blob"});
            }
            if (u.endsWith("/git/trees")) {
                return jsonResponse(201, {sha: "tree"});
            }
            if (u.endsWith("/git/commits")) {
                return jsonResponse(201, {
                    sha: "commit",
                    html_url: "https://github.com/me/repo/commit/commit",
                });
            }
            if (u.endsWith("/git/refs/heads/main")) {
                return jsonResponse(200, {});
            }
            throw new Error(`unexpected ${u}`);
        });
        const api = new GitHubApi("tok", {fetchImpl});
        const res = await api.pushFiles(
            "me/repo",
            "main",
            [
                {path: "manifest.yaml", content: "a"},
                {path: "lessons/01.json", content: "b"},
            ],
            "export",
        );
        expect(res.commitUrl).toContain("/commit/commit");
        // Two blobs (one per file), then a tree, a commit, and a ref update.
        const methods = calls.map((c) => c.method);
        expect(calls.filter((c) => c.url.endsWith("/git/blobs"))).toHaveLength(2);
        expect(methods).toContain("PATCH"); // ref update
    });
});

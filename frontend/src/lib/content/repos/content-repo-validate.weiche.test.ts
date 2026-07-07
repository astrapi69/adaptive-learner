/**
 * Add-repo validation → raw, never the throttled contents API (#1438).
 *
 * The rest of the #1429/#1430 fix: the content LOADER was moved onto the
 * raw-vs-contents weiche, but the code path that VALIDATES a newly-added repo
 * (the "Repository hinzufügen" flow) still forced ``api.github.com/contents``:
 *
 *  - ``validateUserRepo`` / ``listRepoManifestSets`` defaulted their token to
 *    ``readBrowserGitHubToken()`` (the raw shared PAT), bypassing the
 *    ``resolveRepoToken`` weiche entirely;
 *  - and ``resolveRepoToken`` itself fell the shared community-PR PAT onto any
 *    non-official user repo, so a PUBLIC user repo was forced onto the
 *    unauthenticated contents endpoint (60/h → 401/403, or 401 on an expired
 *    PAT) instead of the ungedrosselt ``raw`` host.
 *
 * These tests pin the validation path to the same weiche as the loader:
 *  - a public user repo (no per-repo token) validates from ``raw`` EVEN WITH a
 *    shared PAT set, and never calls the contents API;
 *  - a private/coach repo (its OWN per-repo token) still authenticates against
 *    the contents API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listRepoManifestSets, validateUserRepo } from "./content-repo-validate";
import { writeRepoToken } from "./repo-token";

const store = new Map<string, string>();
const SHARED_KEY = "adaptive-learner.github_token";

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function textRes(status: number, body = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

const PUBLIC_REF = { owner: "astrapi69", repo: "alc-die-waehrung-des-geistes", branch: "main" };

describe("add-repo validation → raw, never the contents API (#1438)", () => {
  it("validateUserRepo reads manifest.yaml from raw even with a shared PAT set", async () => {
    store.set(SHARED_KEY, "ghp_shared_expired");
    // Empty-sets manifest → validation returns early after the manifest fetch,
    // which is exactly the request that 401'd on the device.
    const fetchMock = vi.fn().mockResolvedValue(textRes(200, "schema_version: \"1.4\"\nsets: []\n"));
    vi.stubGlobal("fetch", fetchMock);

    await validateUserRepo(PUBLIC_REF);

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("raw.githubusercontent.com");
    expect(calledUrl).not.toContain("api.github.com");
    // No custom headers on the public path → no CORS preflight.
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
  });

  it("no fetch call touches the contents API across the whole validation", async () => {
    store.set(SHARED_KEY, "ghp_shared_expired");
    const fetchMock = vi.fn().mockResolvedValue(textRes(200, "schema_version: \"1.4\"\nsets: []\n"));
    vi.stubGlobal("fetch", fetchMock);

    await validateUserRepo(PUBLIC_REF);

    for (const call of fetchMock.mock.calls) {
      expect(call[0] as string).not.toContain("api.github.com");
    }
  });

  it("listRepoManifestSets reads from raw for a public repo with a shared PAT set", async () => {
    store.set(SHARED_KEY, "ghp_shared_expired");
    const fetchMock = vi.fn().mockResolvedValue(textRes(200, "sets: []\n"));
    vi.stubGlobal("fetch", fetchMock);

    await listRepoManifestSets(PUBLIC_REF);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("raw.githubusercontent.com");
    expect(calledUrl).not.toContain("api.github.com");
  });

  it("a private/coach repo (own per-repo token) still authenticates against the contents API", async () => {
    writeRepoToken("coach/private-content", "ghp_coach");
    const fetchMock = vi.fn().mockResolvedValue(textRes(200, "schema_version: \"1.4\"\nsets: []\n"));
    vi.stubGlobal("fetch", fetchMock);

    await validateUserRepo({ owner: "coach", repo: "private-content", branch: "main" });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("https://api.github.com/repos/coach/private-content/contents/");
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_coach");
  });
});

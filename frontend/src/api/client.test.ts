import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "./client";

// ----- fetch mock harness ------------------------------------------------

interface MockFetchCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string> | undefined;
}

let calls: MockFetchCall[];
let nextResponse: () => Response;

beforeEach(() => {
  calls = [];
  nextResponse = () => new Response("{}", { status: 200 });
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
      headers: init?.headers as Record<string, string> | undefined,
    });
    return nextResponse();
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(
  payload: unknown,
  init: ResponseInit = { status: 200 },
): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

// ----- URL + serialisation -----------------------------------------------

describe("apiCall URL building", () => {
  it("prefixes every path with /api by default", async () => {
    nextResponse = () =>
      jsonResponse({ status: "ok", version: "0.1.0", debug: false });
    await api.health();
    expect(calls[0].url).toBe("/api/health");
    expect(calls[0].method).toBe("GET");
  });

  it("URL-encodes path parameters", async () => {
    nextResponse = () => jsonResponse({ id: "u 1" });
    await api.users.get("u 1");
    expect(calls[0].url).toBe("/api/users/u%201");
  });

  it("appends query parameters with proper encoding", async () => {
    nextResponse = () => jsonResponse([]);
    await api.assessment.questions("de-DE");
    expect(calls[0].url).toBe("/api/plugins/assessment/questions?lang=de-DE");
  });

  it("omits undefined query parameters", async () => {
    nextResponse = () => jsonResponse([]);
    // Tools plugin recommendations require a non-undefined
    // lang param. Pass a real value and verify the URL.
    await api.tools.recommendations("p1", "en");
    expect(calls[0].url).toBe("/api/plugins/tools/recommendations/p1?lang=en");
  });
});

// ----- Body serialisation -------------------------------------------------

describe("apiCall body serialisation", () => {
  it("JSON-stringifies bodies and sets Content-Type", async () => {
    nextResponse = () =>
      jsonResponse({
        id: "u1",
        name: "Asterios",
        email: null,
        language: "de",
        created_at: "2026-05-18T00:00:00Z",
        updated_at: "2026-05-18T00:00:00Z",
      });
    await api.users.create({ name: "Asterios", language: "de" });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers).toMatchObject({
      "Content-Type": "application/json",
    });
    expect(calls[0].body).toEqual({ name: "Asterios", language: "de" });
  });

  it("does NOT send a body or Content-Type on GET", async () => {
    nextResponse = () => jsonResponse({});
    await api.users.get("u1");
    expect(calls[0].body).toBeUndefined();
    expect(calls[0].headers).toBeUndefined();
  });
});

// ----- Error mapping -----------------------------------------------------

describe("ApiError mapping", () => {
  it("wraps a string ``detail`` on a 404 response", async () => {
    nextResponse = () =>
      jsonResponse({ detail: "User x not found." }, { status: 404 });
    await expect(api.users.get("x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      detail: "User x not found.",
    });
  });

  it("flattens a Pydantic-style list ``detail``", async () => {
    nextResponse = () =>
      jsonResponse(
        {
          detail: [
            {
              loc: ["body", "topic"],
              msg: "field required",
              type: "value_error",
            },
            {
              loc: ["body", "daily_minutes"],
              msg: "greater than 0",
              type: "value_error",
            },
          ],
        },
        { status: 422 },
      );
    try {
      await api.users.projects.create("u1", {
        topic: "",
        goal: "g",
        timeframe: "2w",
        daily_minutes: 0,
      });
      throw new Error("expected rejection");
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr).toBeInstanceOf(ApiError);
      expect(apiErr.status).toBe(422);
      expect(apiErr.detail).toContain("topic: field required");
      expect(apiErr.detail).toContain("daily_minutes: greater than 0");
    }
  });

  it("preserves stacktrace from debug-mode 5xx responses", async () => {
    nextResponse = () =>
      jsonResponse(
        { detail: "boom", stacktrace: "Traceback ...\nError: x" },
        { status: 500 },
      );
    try {
      await api.health();
      throw new Error("expected rejection");
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.isServerError).toBe(true);
      expect(apiErr.stacktrace).toContain("Traceback");
    }
  });

  it("handles non-JSON error bodies without throwing", async () => {
    nextResponse = () => new Response("not json", { status: 502 });
    const promise = api.health();
    await expect(promise).rejects.toMatchObject({
      status: 502,
      detail: "HTTP 502",
    });
  });

  it("exposes typed accessors for common status classes", () => {
    expect(new ApiError(404, "x").isNotFound).toBe(true);
    expect(new ApiError(400, "x").isValidation).toBe(true);
    expect(new ApiError(422, "x").isValidation).toBe(true);
    expect(new ApiError(409, "x").isConflict).toBe(true);
    expect(new ApiError(503, "x").isServerError).toBe(true);
  });
});

// ----- Per-namespace smoke tests -----------------------------------------

describe("api.assessment", () => {
  it("posts the evaluate body verbatim", async () => {
    nextResponse = () =>
      jsonResponse({
        id: "lp1",
        user_id: "u1",
        project_id: "p1",
        deductive: 0.5,
        inductive: 0.2,
        error_based: 0.1,
        dialogic: 0.05,
        contextual: 0.1,
        ai_adaptive: 0.05,
        assessed_at: "2026-05-18T00:00:00Z",
        version: 1,
        dominant_method: "deductive",
      });
    const profile = await api.assessment.evaluate({
      project_id: "p1",
      answers: [{ question_id: "q01", answer_id: "a" }],
    });
    expect(profile.dominant_method).toBe("deductive");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("/api/plugins/assessment/evaluate");
    expect(calls[0].body).toEqual({
      project_id: "p1",
      answers: [{ question_id: "q01", answer_id: "a" }],
    });
  });
});

describe("api.session", () => {
  it("start posts the body and returns the typed result", async () => {
    nextResponse = () =>
      jsonResponse({
        session: {
          id: "s1",
          project_id: "p1",
          method: "deductive",
          started_at: "2026-05-18T00:00:00Z",
          ended_at: null,
          cycle_step: 1,
          status: "active",
        },
        system_prompt: "Du bist...",
      });
    const out = await api.session.start({ project_id: "p1", lang: "de" });
    expect(out.session.id).toBe("s1");
    expect(out.system_prompt).toContain("Du");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toMatchObject({ project_id: "p1", lang: "de" });
  });

  it("end posts to the right route without a body", async () => {
    nextResponse = () =>
      jsonResponse({
        session: {
          id: "s1",
          project_id: "p1",
          method: "deductive",
          started_at: "2026-05-18T00:00:00Z",
          ended_at: "2026-05-18T00:30:00Z",
          cycle_step: 7,
          status: "completed",
        },
      });
    const out = await api.session.end("s1");
    expect(out.session.status).toBe("completed");
    expect(calls[0].url).toBe("/api/plugins/session/s1/end");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toBeUndefined();
  });
});

describe("api.tracking", () => {
  it("returns the typed shallow-merged summary", async () => {
    nextResponse = () =>
      jsonResponse({
        tracking: {
          total_sessions: 3,
          sessions_per_method: { deductive: 2, dialogic: 1 },
          recent_understanding: [0.4, 0.5, 0.6],
          recent_stress: [0.5, 0.4, 0.3],
          mean_understanding: 0.5,
          mean_stress: 0.4,
        },
      });
    const summary = await api.tracking.progress("p1");
    expect(summary.tracking?.total_sessions).toBe(3);
    expect(summary.tracking?.sessions_per_method.deductive).toBe(2);
  });
});

describe("api.tools", () => {
  it("returns a typed recommendation list", async () => {
    nextResponse = () =>
      jsonResponse([
        {
          name: "Anki",
          url: "https://apps.ankiweb.net/",
          why: "Spaced-Repetition-Karteikarten ...",
          weight_keys: ["deductive", "error_based"],
          score: 0.42,
        },
      ]);
    const recs = await api.tools.recommendations("p1", "de");
    expect(recs).toHaveLength(1);
    expect(recs[0].name).toBe("Anki");
    expect(recs[0].weight_keys).toContain("deductive");
  });
});

describe("api.settings", () => {
  it("setApiKey posts encrypted-write body to the api-key endpoint", async () => {
    nextResponse = () =>
      jsonResponse({
        id: "us1",
        user_id: "u1",
        language: "de",
        active_provider: "anthropic",
        has_anthropic_key: true,
        has_openai_key: false,
        has_gemini_key: false,
        model_override_anthropic: null,
        model_override_openai: null,
        model_override_gemini: null,
        created_at: "2026-05-18T00:00:00Z",
        updated_at: "2026-05-18T00:00:00Z",
      });
    const out = await api.settings.setApiKey("u1", {
      provider: "anthropic",
      key: "sk-xxx",
    });
    expect(out.has_anthropic_key).toBe(true);
    expect(calls[0].url).toBe("/api/settings/u1/api-key");
    expect(calls[0].body).toEqual({ provider: "anthropic", key: "sk-xxx" });
  });

  it("deleteApiKey uses the per-provider DELETE route", async () => {
    nextResponse = () =>
      jsonResponse({
        id: "us1",
        user_id: "u1",
        language: "de",
        active_provider: "anthropic",
        has_anthropic_key: false,
        has_openai_key: false,
        has_gemini_key: false,
        model_override_anthropic: null,
        model_override_openai: null,
        model_override_gemini: null,
        created_at: "2026-05-18T00:00:00Z",
        updated_at: "2026-05-18T00:00:00Z",
      });
    await api.settings.deleteApiKey("u1", "anthropic");
    expect(calls[0].url).toBe("/api/settings/u1/api-key/anthropic");
    expect(calls[0].method).toBe("DELETE");
  });
});

// ----- Phase 37: eventRecorder hooks -------------------------------------

describe("apiCall + eventRecorder integration", () => {
  /** The recorder is a module-singleton; clear it before each
   *  test so per-test assertions only see the events the test
   *  itself produced. Dynamic import to avoid surfacing the
   *  recorder dependency at the top of the file (matches the
   *  api/client.ts production path). */
  async function clearRecorder() {
    const { eventRecorder } = await import("../utils/eventRecorder");
    eventRecorder.clear();
    return eventRecorder;
  }

  it("records an api_call event on every successful request", async () => {
    const recorder = await clearRecorder();
    nextResponse = () =>
      jsonResponse({ status: "ok", version: "x", debug: false });
    await api.health();
    // Allow the dynamic import inside apiCall to flush.
    await new Promise((r) => setTimeout(r, 5));
    const events = recorder.getAll();
    const apiCallEvent = events.find((e) => e.type === "api_call");
    expect(apiCallEvent).toBeDefined();
    expect(apiCallEvent?.method).toBe("GET");
    expect(apiCallEvent?.endpoint).toBe("/health");
    expect(apiCallEvent?.status).toBe(200);
    expect(typeof apiCallEvent?.durationMs).toBe("number");
  });

  it("records an api_call event with the non-2xx status when the request fails", async () => {
    const recorder = await clearRecorder();
    nextResponse = () =>
      new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    await expect(api.users.get("missing")).rejects.toBeInstanceOf(ApiError);
    await new Promise((r) => setTimeout(r, 5));
    const events = recorder.getAll();
    const apiCallEvent = events.find((e) => e.type === "api_call");
    expect(apiCallEvent).toBeDefined();
    expect(apiCallEvent?.status).toBe(404);
    expect(apiCallEvent?.endpoint).toBe("/users/missing");
  });

  it("records an api_error event on network failures", async () => {
    const recorder = await clearRecorder();
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(api.health()).rejects.toThrow("Failed to fetch");
    await new Promise((r) => setTimeout(r, 5));
    const events = recorder.getAll();
    const apiErrorEvent = events.find((e) => e.type === "api_error");
    expect(apiErrorEvent).toBeDefined();
    expect(apiErrorEvent?.endpoint).toBe("/health");
    expect(apiErrorEvent?.method).toBe("GET");
    expect(apiErrorEvent?.message).toContain("Failed to fetch");
  });

  it("strips URL query params from the recorded endpoint (sanitizer)", async () => {
    const recorder = await clearRecorder();
    nextResponse = () => jsonResponse([]);
    await api.assessment.questions("de-DE");
    await new Promise((r) => setTimeout(r, 5));
    const events = recorder.getAll();
    const apiCallEvent = events.find((e) => e.type === "api_call");
    // The sanitizer drops the ?lang=de-DE part before storing.
    expect(apiCallEvent?.endpoint).toBe("/plugins/assessment/questions");
  });
});

// ----- Phase 37: ApiError shape -----------------------------------------

describe("ApiError", () => {
  it("auto-fills the timestamp on construction (ISO 8601)", () => {
    const before = Date.now();
    const err = new ApiError(500, "Boom", "/x", "GET");
    const after = Date.now();
    const ts = Date.parse(err.timestamp);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("captures the structured extra context (Phase 36 compat)", () => {
    const err = new ApiError(409, "Duplicate", "/imports", "POST", undefined, {
      existing_id: "abc-123",
    });
    expect(err.extra).toEqual({ existing_id: "abc-123" });
    expect(err.isConflict).toBe(true);
  });
});

// ----- PLUGINFORGE-LIFECYCLE-UI-01: plugin inspect ----------------------

describe("api.plugins.inspect", () => {
  it("calls GET /api/plugins/inspect/{name} and returns the lifecycle metadata", async () => {
    nextResponse = () =>
      jsonResponse({
        name: "anki",
        version: "1.0.0",
        target_application: "adaptive_learner",
        state: {
          activated: true,
          activated_at: "2026-05-23T18:00:00",
          last_config_change: null,
          source: "entry_point",
          filter_reason: null,
          load_error: null,
        },
      });

    const inspection = await api.plugins.inspect("anki");

    expect(calls[0].url).toBe("/api/plugins/inspect/anki");
    expect(calls[0].method).toBe("GET");
    expect(inspection.name).toBe("anki");
    expect(inspection.state.activated).toBe(true);
    expect(inspection.state.source).toBe("entry_point");
    expect(inspection.state.activated_at).toBe("2026-05-23T18:00:00");
  });

  it("URL-encodes plugin names", async () => {
    nextResponse = () =>
      jsonResponse({
        name: "weird name",
        version: "0.0.1",
        target_application: null,
        state: {
          activated: false,
          activated_at: null,
          last_config_change: null,
          source: null,
          filter_reason: "not_enabled",
          load_error: null,
        },
      });

    await api.plugins.inspect("weird name");
    expect(calls[0].url).toBe("/api/plugins/inspect/weird%20name");
  });
});

// ----- content-loader saveUserSet body serialisation (Phase 59B) ---------

describe("api.contentLoader.saveUserSet", () => {
  it("sends the body as a JSON object, not a double-stringified string", async () => {
    nextResponse = () => jsonResponse({ source: "user-generated", id: "x" });
    await api.contentLoader.saveUserSet({
      set_id: "analysis-conv-1",
      title: "Spanish travel",
      language: "es",
      level: "beginner",
      origin: "analysis",
      description: null,
      lessons: [
        {
          id: "analysis-conv-1",
          title: "Spanish travel",
          description: null,
          estimated_minutes: 5,
          cards: [],
          steps: [{ id: "theory-overview", type: "theory", body: "hi" }],
        },
      ],
    });
    const call = calls.at(-1)!;
    expect(call.method).toBe("POST");
    expect(call.url).toBe("/api/plugins/content-loader/user-sets");
    // Regression: a double-stringified body parses back to a STRING.
    // The body must be a real object the backend can extract fields from.
    expect(typeof call.body).toBe("object");
    expect(call.body).toMatchObject({
      set_id: "analysis-conv-1",
      origin: "analysis",
    });
    expect(Array.isArray((call.body as { lessons: unknown[] }).lessons)).toBe(
      true,
    );
    expect(call.headers?.["Content-Type"]).toBe("application/json");
  });
});

describe("api.sync.generatePairToken (Phase 61 C2)", () => {
  it("POSTs the user id to /api/sync/pair/generate and returns the token", async () => {
    nextResponse = () =>
      jsonResponse({ token: "tok-1", user_id: "u1", expires_at: "2026-05-30T12:00:00Z" });
    const out = await api.sync.generatePairToken("u1");
    expect(calls[0].url).toBe("/api/sync/pair/generate");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ user_id: "u1" });
    expect(out.token).toBe("tok-1");
  });

  it("throws ApiError (not a bare Error) on a failure response", async () => {
    nextResponse = () => jsonResponse({ detail: "pairing disabled" }, { status: 409 });
    await expect(api.sync.generatePairToken("u1")).rejects.toBeInstanceOf(ApiError);
  });
});

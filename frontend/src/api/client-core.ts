/**
 * HTTP core for the Adaptive Learner API client (#394).
 *
 * The shared foundation the per-domain ``client-*`` namespace modules
 * build on: the :class:`ApiError` error type, the single ``apiCall``
 * helper (URL building, body serialisation, event recording, error
 * wrapping), and the response-shape interfaces a few namespaces return.
 *
 * Every fetch on the frontend MUST go through ``apiCall`` (via one of
 * the ``api.*`` namespaces) — components never call ``fetch`` directly.
 */

import { API_BASE } from "../lib/constants";

// --- Error class --------------------------------------------------------

export class ApiError extends Error {
  /** Phase 37 — ISO 8601 capture time. The ErrorReportDialog
   *  embeds it in the GitHub issue body so developers can
   *  correlate against backend logs. Auto-set by the constructor;
   *  callers don't pass it.
   */
  public readonly timestamp: string;

  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly endpoint?: string,
    public readonly method?: string,
    public readonly stacktrace?: string,
    /**
     * Phase 36 — structured context fields the backend's
     * ``AdaptiveLearnerError.extra`` attaches to the JSON
     * response alongside ``detail``. Example: a 409 duplicate
     * import surfaces ``{existing_id: "<uuid>"}`` here so the
     * caller can navigate to the existing record.
     */
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(detail);
    this.name = "ApiError";
    this.timestamp = new Date().toISOString();
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

// --- Core helper --------------------------------------------------------

interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

/**
 * Make a typed HTTP call against the backend. Caller passes the
 * typed result shape; the helper handles URL building, body
 * serialisation, and error wrapping.
 */
export async function apiCall<T>(path: string, opts: CallOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const url = buildUrl(path, opts.query);
  const init: RequestInit = { method };
  if (opts.body !== undefined && opts.body !== null) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  // Phase 37 — record every API call (success + error + network
  // failure) into the in-memory ring buffer. The recorder
  // sanitizes the endpoint (strips query) and never sees the
  // body. Dynamic import keeps the dependency graph one-way at
  // module evaluation time.
  const startTime = performance.now();
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (networkError) {
    try {
      const { eventRecorder } = await import("../utils/eventRecorder");
      eventRecorder.add({
        type: "api_error",
        timestamp: startTime,
        method,
        endpoint: path,
        message: String(networkError).substring(0, 200),
      });
    } catch {
      /* recorder not available */
    }
    throw networkError;
  }
  const durationMs = Math.round(performance.now() - startTime);
  try {
    const { eventRecorder } = await import("../utils/eventRecorder");
    eventRecorder.add({
      type: "api_call",
      timestamp: startTime,
      method,
      endpoint: path,
      status: response.status,
      durationMs,
    });
  } catch {
    /* recorder not available */
  }
  if (!response.ok) {
    throw await buildApiError(response, path, method);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Build an ApiError from a failed response: flattens Pydantic
 * validation lists into a legible detail string, pulls the optional
 * stacktrace, and carries any extra backend fields
 * (``AdaptiveLearnerError.extra``) minus the keys handled above. A
 * non-JSON error body falls back to a generic ``HTTP {status}`` detail.
 */
async function buildApiError(
  response: Response,
  path: string,
  method: string,
): Promise<ApiError> {
  let detail = `HTTP ${response.status}`;
  let stacktrace: string | undefined;
  const extra: Record<string, unknown> = {};
  try {
    const errBody = await response.json();
    if (typeof errBody?.detail === "string") {
      detail = errBody.detail;
    } else if (Array.isArray(errBody?.detail)) {
      detail = errBody.detail
        .map((e: { loc?: unknown[]; msg?: string }) => {
          const where = (e.loc ?? []).slice(1).join(".");
          return where ? `${where}: ${e.msg ?? ""}` : (e.msg ?? "");
        })
        .filter(Boolean)
        .join("; ");
    }
    if (typeof errBody?.stacktrace === "string") {
      stacktrace = errBody.stacktrace;
    }
    if (errBody && typeof errBody === "object") {
      for (const [key, value] of Object.entries(errBody)) {
        if (key === "detail" || key === "stacktrace") continue;
        extra[key] = value;
      }
    }
  } catch {
    /* non-JSON error body — keep generic detail */
  }
  return new ApiError(response.status, detail, path, method, stacktrace, extra);
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const base = `${API_BASE}${path}`;
  if (!query) return base;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${base}?${qs}` : base;
}

// --- Response payload shapes -------------------------------------------

/**
 * Wire shape of GET /api/identity (Phase 41A). Mirrors backend's
 * ``IdentityOut`` schema. ``user_id`` is always present; the other
 * three fields are nullable because the identity file is written
 * BEFORE the user creates their first project (so active_project_id
 * may be null) and ``last_seen`` is auto-set on every write.
 */
export interface IdentityPayload {
  user_id: string;
  active_project_id: string | null;
  language: string | null;
  last_seen: string | null;
}

/**
 * Wire shape of GET /api/identity/status (Phase 41D). Diagnostic
 * surface for the Settings > About > Identity panel. Always returns
 * 200 (even when the file does not exist) so the UI can show a
 * "Not found" badge with the path the file would live at.
 */
export interface IdentityStatusPayload {
  exists: boolean;
  path: string;
  last_seen: string | null;
}

export interface AvailableModelResponse {
  id: string;
  name: string;
  context_window: number | null;
  description: string | null;
}

/**
 * PLUGINFORGE-LIFECYCLE-UI-01: lifecycle metadata for one plugin,
 * mirroring the backend ``/api/plugins/inspect/{name}`` response.
 * ``state.activated_at`` and ``state.last_config_change`` are
 * ISO-8601 strings (or null when never set). ``state.source`` is
 * ``"entry_point"`` for installed plugins, ``"direct_register"``
 * for programmatically-registered ones.
 */
export interface PluginInspection {
  name: string;
  version: string;
  target_application: string | null;
  state: {
    activated: boolean;
    activated_at: string | null;
    last_config_change: string | null;
    source: "entry_point" | "direct_register" | null;
    filter_reason: string | null;
    load_error: string | null;
  };
}

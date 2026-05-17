/**
 * Adaptive Learner API client.
 *
 * Skeleton state (Phase 1A). The Bibliogon api.{books,articles,chapters,
 * assets,publications,authors,bisac,templates,ai,audiobook,editor,
 * plugins,licenses,import,backup,comments,bulk,trash,covers} namespaces
 * are gone with the routers that backed them. What remains:
 *
 * - ApiError class and shared apiCall<T> helper (every layer above
 *   funnels through here, so error semantics stay consistent as new
 *   namespaces land).
 * - api.health / api.i18n / api.plugins.* / a placeholder
 *   api.settings.getApp — the endpoints the skeleton main.py still
 *   exposes (settings/app lands in Phase 1C; the helper exists now
 *   so the I18n provider can stay in shape).
 *
 * New namespaces (api.users, api.projects, api.assessment, api.session,
 * api.tracking, api.tools) land alongside their routers in Phase 1C+.
 */

const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public endpoint?: string,
    public method?: string,
    public stacktrace?: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    let stacktrace: string | undefined;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
      if (typeof body?.stacktrace === "string") stacktrace = body.stacktrace;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail, path, method, stacktrace);
  }
  if (response.status === 204) return undefined as unknown as T;
  return (await response.json()) as T;
}

export const api = {
  health: () => apiCall<{status: string; version: string; debug: boolean}>("/health"),
  i18n: {
    get: (lang: string) => apiCall<Record<string, unknown>>(`/i18n/${lang}`),
  },
  settings: {
    /**
     * Placeholder until the settings router lands in Phase 1C. Right
     * now there is no ``GET /api/settings/app`` endpoint, so this
     * returns an empty config and any caller (e.g. the I18n provider)
     * silently falls back to its hardcoded default language. The
     * shape stays untyped on purpose; Phase 1C defines the typed
     * slices once the new domain settings are known.
     */
    getApp: async (): Promise<Record<string, unknown>> => ({}),
  },
  plugins: {
    manifests: () => apiCall<Record<string, unknown>>("/plugins/manifests"),
    health: () => apiCall<Record<string, unknown>>("/plugins/health"),
    errors: () => apiCall<Record<string, string>>("/plugins/errors"),
  },
};

/**
 * Adaptive Learner API client — plugins, system, export, backup, notebooklm, pluginSettings, learningRepo namespaces.
 *
 * Namespace bodies extracted verbatim from client.ts (#394) and
 * composed into ``api`` by the client.ts barrel via spread.
 */

import { ApiError, apiCall } from "./client-core";
import type { PluginInspection } from "./client-core";
import { API_BASE } from "../lib/constants";

export const platformApi = {
  // --- Plugin discovery / health --------------------------------------

  plugins: {
    manifests: () => apiCall<Record<string, unknown>>("/plugins/manifests"),
    health: () => apiCall<Record<string, unknown>>("/plugins/health"),
    errors: () => apiCall<Record<string, string>>("/plugins/errors"),
    // PLUGINFORGE-LIFECYCLE-UI-01: surfaces the v0.9.0 lifecycle
    // metadata for one plugin. Used by the (future) Settings →
    // Plugins panel; backend endpoint shipped first so the panel
    // can be built on top of a typed contract.
    inspect: (name: string) =>
      apiCall<PluginInspection>(`/plugins/inspect/${encodeURIComponent(name)}`),
  },

  // --- System info (v1.1.0 / Phase 14A) -------------------------------

  system: {
    info: () => apiCall<import("../types/domain").SystemInfo>("/system/info"),
  },

  // --- Export (v1.3.0 / Phase 16A) -------------------------------------

  export: {
    /**
     * Aggregate the user's full learning journey into a
     * structured payload ready for Markdown / PDF rendering.
     */
    progress: (userId: string, lang: string) =>
      apiCall<import("../storage/backup/export-types").ProgressReport>(
        `/export/progress?user_id=${encodeURIComponent(userId)}` +
          `&lang=${encodeURIComponent(lang)}`,
      ),
    session: (sessionId: string, lang: string) =>
      apiCall<import("../storage/backup/export-types").SessionDetail>(
        `/export/session/${encodeURIComponent(sessionId)}` + `?lang=${encodeURIComponent(lang)}`,
      ),
    curriculum: (curriculumId: string, lang: string) =>
      apiCall<import("../storage/backup/export-types").CurriculumOverview>(
        `/export/curriculum/${encodeURIComponent(curriculumId)}` +
          `?lang=${encodeURIComponent(lang)}`,
      ),
  },

  // --- Backup / restore (v1.2.0 / Phase 15A) --------------------------

  backup: {
    /**
     * Trigger the JSON download endpoint and return the
     * parsed payload. The endpoint sets a
     * ``Content-Disposition: attachment`` header so the
     * browser also offers a save dialog when the caller is
     * a page navigation rather than this fetch.
     */
    export: (userId: string) =>
      apiCall<import("../types/domain").BackupPayload>(
        `/backup/export?user_id=${encodeURIComponent(userId)}`,
      ),
    stats: (userId: string) =>
      apiCall<import("../types/domain").BackupStats & { user_id: string }>(
        `/backup/stats?user_id=${encodeURIComponent(userId)}`,
      ),
    import: (userId: string, payload: import("../types/domain").BackupPayload) =>
      apiCall<import("../types/domain").RestoreSummary>(
        `/backup/import?user_id=${encodeURIComponent(userId)}`,
        { method: "POST", body: payload },
      ),
  },

  // --- NotebookLM plugin (v1.19.0 / Phase 32) -------------------------

  notebooklm: {
    listQuestions: (
      userId: string,
      filters?: import("../storage/types").StudyQuestionListFilters,
    ) => {
      const query: Record<string, string> = {};
      if (filters?.projectId) query.project_id = filters.projectId;
      if (filters?.difficulty) query.difficulty = filters.difficulty;
      if (filters?.topic) query.topic = filters.topic;
      return apiCall<import("../storage/types").StudyQuestion[]>(
        `/plugins/notebooklm/questions/${encodeURIComponent(userId)}`,
        Object.keys(query).length > 0 ? { query } : undefined,
      );
    },
    createQuestion: (userId: string, body: import("../storage/types").StudyQuestionCreateBody) =>
      apiCall<import("../storage/types").StudyQuestion>(
        `/plugins/notebooklm/questions?user_id=${encodeURIComponent(userId)}`,
        { method: "POST", body },
      ),
    updateQuestion: (
      questionId: string,
      body: import("../storage/types").StudyQuestionUpdateBody,
    ) =>
      apiCall<import("../storage/types").StudyQuestion>(
        `/plugins/notebooklm/questions/${encodeURIComponent(questionId)}`,
        { method: "PATCH", body },
      ),
    deleteQuestion: (questionId: string) =>
      apiCall<{ deleted: string }>(
        `/plugins/notebooklm/questions/${encodeURIComponent(questionId)}`,
        { method: "DELETE" },
      ),
    generateFromSession: (sessionId: string) =>
      apiCall<import("../storage/types").StudyQuestion[]>(
        `/plugins/notebooklm/questions/generate/session/${encodeURIComponent(sessionId)}`,
        { method: "POST", body: {} },
      ),
    generateFromProject: (projectId: string) =>
      apiCall<import("../storage/types").StudyQuestion[]>(
        `/plugins/notebooklm/questions/generate/project/${encodeURIComponent(projectId)}`,
        { method: "POST", body: {} },
      ),
    studyGuide: async (projectId: string) => {
      // Returns text/markdown — bypass apiCall (which
      // parses JSON) and call fetch directly.
      const res = await fetch(
        `${API_BASE}/plugins/notebooklm/study-guide/${encodeURIComponent(projectId)}`,
        { method: "POST", body: "" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "" }));
        throw new ApiError(res.status, body.detail || `Study guide failed (HTTP ${res.status})`);
      }
      return await res.text();
    },
  },

  // --- Plugin settings round-trip (v1.26.0 / generic) -----------------

  pluginSettings: {
    /** GET /api/plugin-settings/{plugin_name} */
    get: (pluginName: string) =>
      apiCall<{ plugin: string; settings: Record<string, unknown> }>(
        `/plugin-settings/${encodeURIComponent(pluginName)}`,
      ),
    /** PATCH /api/plugin-settings/{plugin_name} */
    update: (pluginName: string, body: { settings: Record<string, unknown> }) =>
      apiCall<{ plugin: string; settings: Record<string, unknown> }>(
        `/plugin-settings/${encodeURIComponent(pluginName)}`,
        { method: "PATCH", body },
      ),
  },

  // --- Learning Repository plugin (v1.26.0 / Phase 42 / BL-30) -------

  learningRepo: {
    /** GET /api/plugins/learning-repo/render/{project_id} */
    render: (projectId: string, language?: string) => {
      const query: Record<string, string> = {};
      if (language) query.language = language;
      return apiCall<{
        project_id: string;
        language: string;
        rendered_at: string;
        files: Record<string, string>;
      }>(
        `/plugins/learning-repo/render/${encodeURIComponent(projectId)}`,
        Object.keys(query).length > 0 ? { query } : undefined,
      );
    },
    /** POST /api/plugins/learning-repo/export-zip/{project_id}
     *  Returns the raw zip Blob — caller usually pipes it into
     *  a download anchor. */
    exportZip: async (projectId: string, language?: string): Promise<Blob> => {
      const qs = language ? `?language=${encodeURIComponent(language)}` : "";
      const res = await fetch(
        `${API_BASE}/plugins/learning-repo/export-zip/${encodeURIComponent(projectId)}${qs}`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "" }));
        throw new ApiError(res.status, body.detail || `Export-zip failed (HTTP ${res.status})`);
      }
      return await res.blob();
    },
    /** POST /api/plugins/learning-repo/persist/{project_id} */
    persist: (projectId: string, language?: string) => {
      const qs = language ? `?language=${encodeURIComponent(language)}` : "";
      return apiCall<{
        project_id: string;
        language: string;
        rendered_at: string;
        files_written: number;
        repo_path: string;
        commit_sha: string;
        tag: string | null;
      }>(`/plugins/learning-repo/persist/${encodeURIComponent(projectId)}${qs}`, {
        method: "POST",
      });
    },
  },
};

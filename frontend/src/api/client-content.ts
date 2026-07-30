/**
 * Adaptive Learner API client — lessonProgress, elementErrors, missions, contentLoader namespaces.
 *
 * Namespace bodies extracted verbatim from client.ts (#394) and
 * composed into ``api`` by the client.ts barrel via spread.
 */

import { ApiError, apiCall } from "./client-core";

export const contentApi = {
  // --- Lesson Progress (Phase 44 / EXP-002 / P-109) ------------------

  // --- Learner-data maintenance (#1821, API half of #1445 Part B) ----

  learningData: {
    /** POST /api/users/{user_id}/learning-data/delete */
    delete: (
      userId: string,
      body: {
        lesson_progress_ids: string[];
        set_ids: string[];
        lesson_cards?: {set_id: string; lesson_id: string}[];
      },
    ) =>
      apiCall<{lessons_deleted: number; cards_deleted: number}>(
        `/users/${encodeURIComponent(userId)}/learning-data/delete`,
        {method: "POST", body},
      ),
  },

  lessonProgress: {
    /** GET /api/users/{user_id}/lesson-progress */
    list: (userId: string) =>
      apiCall<import("../storage/types").LessonProgress[]>(
        `/users/${encodeURIComponent(userId)}/lesson-progress`,
      ),
    /** GET /api/users/{user_id}/lesson-progress/{src}/{set}/{lesson}
     *  Translates the 404 into a ``null`` return so callers
     *  treat "never started" as a fresh-start case, not an
     *  error. */
    get: async (
      userId: string,
      source: string,
      setId: string,
      lessonFilename: string,
    ): Promise<import("../storage/types").LessonProgress | null> => {
      const slug = source.replace(/\//g, "--");
      try {
        return await apiCall<import("../storage/types").LessonProgress>(
          `/users/${encodeURIComponent(userId)}/lesson-progress/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/${encodeURIComponent(lessonFilename)}`,
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    /** POST /api/users/{user_id}/lesson-progress */
    upsert: (userId: string, body: import("../storage/types").LessonProgressUpsertBody) =>
      apiCall<import("../storage/types").LessonProgress>(
        `/users/${encodeURIComponent(userId)}/lesson-progress`,
        { method: "POST", body },
      ),
  },

  // --- Element Errors (Phase 46B / EXP-007 / P-129) ------------------

  elementErrors: {
    /** GET /api/users/{user_id}/element-errors */
    list: (userId: string, opts: { setId?: string; includeMastered?: boolean } = {}) => {
      const params = new URLSearchParams();
      if (opts.setId !== undefined) params.set("set_id", opts.setId);
      if (opts.includeMastered === false) {
        params.set("include_mastered", "false");
      }
      const qs = params.toString();
      const path = qs
        ? `/users/${encodeURIComponent(userId)}/element-errors?${qs}`
        : `/users/${encodeURIComponent(userId)}/element-errors`;
      return apiCall<import("../storage/types").ElementError[]>(path);
    },
    /** POST /api/users/{user_id}/element-errors */
    recordBulk: (userId: string, attempts: readonly import("../storage/types").ElementAttempt[]) =>
      apiCall<import("../storage/types").ElementError[]>(
        `/users/${encodeURIComponent(userId)}/element-errors`,
        { method: "POST", body: { attempts } },
      ),
    /** POST /api/users/{user_id}/element-errors/remap (#2161 one-off recovery) */
    remap: (
      userId: string,
      remaps: readonly import("../storage/types").ElementKeyRemap[],
    ) =>
      apiCall<{ applied: number; skipped: number }>(
        `/users/${encodeURIComponent(userId)}/element-errors/remap`,
        { method: "POST", body: { remaps } },
      ),
    /** GET /api/users/{user_id}/element-errors/review-queue */
    reviewQueue: (
      userId: string,
      opts: { setId?: string; limit?: number } = {},
    ) => {
      const params = new URLSearchParams();
      if (opts.setId !== undefined) params.set("set_id", opts.setId);
      if (opts.limit !== undefined) params.set("limit", String(opts.limit));
      const qs = params.toString();
      const path = qs
        ? `/users/${encodeURIComponent(userId)}/element-errors/review-queue?${qs}`
        : `/users/${encodeURIComponent(userId)}/element-errors/review-queue`;
      return apiCall<import("../storage/types").ReviewQueueItem[]>(path);
    },
  },

  // --- Missions plugin (EXP-010 / Phase 56) ---------------------------

  missions: {
    getDaily: (userId: string, opts: import("../storage/types").MissionDailyOptions = {}) => {
      const params = new URLSearchParams();
      if (opts.count !== undefined) params.set("count", String(opts.count));
      if (opts.difficultyMix !== undefined) {
        params.set("difficulty_mix", opts.difficultyMix);
      }
      if (opts.todayIso !== undefined) params.set("today", opts.todayIso);
      const qs = params.toString();
      const path = qs
        ? `/plugins/missions/today/${encodeURIComponent(userId)}?${qs}`
        : `/plugins/missions/today/${encodeURIComponent(userId)}`;
      return apiCall<import("../storage/types").MissionDailyResultWire>(path);
    },
    regenerate: (userId: string, opts: import("../storage/types").MissionDailyOptions = {}) => {
      const params = new URLSearchParams();
      if (opts.count !== undefined) params.set("count", String(opts.count));
      if (opts.difficultyMix !== undefined) {
        params.set("difficulty_mix", opts.difficultyMix);
      }
      if (opts.todayIso !== undefined) params.set("today", opts.todayIso);
      const qs = params.toString();
      const path = qs
        ? `/plugins/missions/regenerate/${encodeURIComponent(userId)}?${qs}`
        : `/plugins/missions/regenerate/${encodeURIComponent(userId)}`;
      return apiCall<import("../storage/types").MissionDailyResultWire>(path, {
        method: "POST",
      });
    },
  },

  // --- Content-Loader plugin (Phase 43 / EXP-002) ---------------------

  contentLoader: {
    /** GET /api/plugins/content-loader/sets */
    listSets: () =>
      apiCall<import("../storage/types").ContentSetsList>("/plugins/content-loader/sets"),
    /** POST /api/plugins/content-loader/sets/{src}/{id}/download */
    downloadSet: (source: string, setId: string) => {
      const slug = source.replace(/\//g, "--");
      return apiCall<import("../storage/types").ContentSetEntry>(
        `/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/download`,
        { method: "POST" },
      );
    },
    /** GET /api/plugins/content-loader/sets/{src}/{id}/lessons */
    listLessons: (source: string, setId: string) => {
      const slug = source.replace(/\//g, "--");
      return apiCall<import("../storage/types").ContentLessonList>(
        `/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/lessons`,
      );
    },
    /** GET /api/plugins/content-loader/sets/{src}/{id}/lessons/{filename} */
    getLesson: (source: string, setId: string, filename: string) => {
      const slug = source.replace(/\//g, "--");
      return apiCall<import("../storage/types").ContentLesson>(
        `/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/lessons/${encodeURIComponent(filename)}`,
      );
    },
    /** GET /api/plugins/content-loader/sets/{src}/{id}/assets/{asset_path}
     *
     *  Phase 54 / v1.37.0 — returns the raw asset bytes as a
     *  Blob, OR ``null`` on 404 so the caller can fall back
     *  to a placeholder. The endpoint is added in Phase 54F;
     *  ApiStorage.contentLoader.getAsset delegates here. */
    getAsset: async (source: string, setId: string, assetPath: string): Promise<Blob | null> => {
      const slug = source.replace(/\//g, "--");
      // assetPath contains forward slashes (e.g. "img/x.png")
      // and we want them preserved in the URL — encode each
      // segment individually so a literal "/" stays as "/".
      const encodedAssetPath = assetPath.split("/").map(encodeURIComponent).join("/");
      const url = `/api/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/assets/${encodedAssetPath}`;
      try {
        const response = await fetch(url);
        if (response.status === 404) return null;
        if (!response.ok) {
          throw new Error(`Asset fetch failed: ${response.status} ${response.statusText}`);
        }
        return await response.blob();
      } catch (err) {
        // Network failure mirrors the 404 surface — the
        // resolver hook falls back to placeholder /
        // text-only so a flaky connection doesn't break
        // PictureChoice exercises.
        console.warn("getAsset failed", url, err);
        return null;
      }
    },
    /** POST /api/plugins/content-loader/user-sets — Phase 59B /
     *  v1.42.0. Persists a user-generated set into the filesystem
     *  cache (same place as downloaded sets). */
    saveUserSet: (input: import("../storage/types").SaveUserSetInput) =>
      apiCall<import("../storage/types").ContentSetEntry>(
        "/plugins/content-loader/user-sets",
        // apiCall JSON.stringifies the body itself — pass the raw
        // object (double-stringify would 422 the Pydantic body).
        { method: "POST", body: input },
      ),
    /** DELETE /api/plugins/content-loader/sets/{src}/{id} —
     *  Phase 59C / v1.42.0. */
    deleteSet: (source: string, setId: string) => {
      const slug = source.replace(/\//g, "--");
      return apiCall<void>(
        `/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}`,
        { method: "DELETE" },
      );
    },
    /** POST /api/content/validate-lesson — Phase 60 / v1.44.0.
     *  Opt-in AI content review; the backend resolves the AI key
     *  server-side and returns the structured result. */
    aiValidate: (input: import("../storage/types").AiValidateInput) =>
      apiCall<import("../lib/content/validation/content-validation-types").AiValidationResult>(
        "/content/validate-lesson",
        {
          method: "POST",
          body: input,
        },
      ),
  },
};

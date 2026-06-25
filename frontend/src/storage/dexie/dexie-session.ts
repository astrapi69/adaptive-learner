/**
 * Dexie implementation of the assessment / session / tracking / tools namespaces (#354).
 *
 * Extracted verbatim from ``dexie-storage.ts``; shared row
 * mappers/helpers come from ``./dexie-rows``.
 */

import { getDb, newId, nowIso } from "./db";
import { requireRow, rowToProfile } from "./dexie-rows";
import { calculateProfile, questionsForLang } from "../services/assessment";
import { sendMessage, sendMessageStream, startSession } from "../ai/session-flow";
import { aggregateProgress, buildCommitFromSession, rowToCommit } from "../services/tracking";
import { buildSpacedRecommendations, rankTools, recencyFromCommits } from "../services/tools";
import { awardXPForSession } from "../gamification/gamification";
import { evaluateBadgesForUser } from "../gamification/badges";
import { updateStreakState } from "../gamification/streaks";
import { maybeRunAutoBackup, recordCompletedSession } from "../backup/auto-backup";
import { ApiError } from "../../api/client";
import type { LearningProfileRow, LearningSessionRow, MethodSwitchRow, SessionRatingRow } from "./db";
import type { LearningMethod } from "../../lib/constants";
import type { SessionMessageBody, SessionRatingBody, SessionStartBody } from "../../api/client";
import type {
  AssessmentEvaluatePayload,
  AssessmentQuestion,
  LearningProfile,
  LearningSession,
  ProgressCommit,
  ProgressSummary,
  SessionEndResult,
  SessionMessage,
  SessionMessageExchangeResult,
  SessionRating,
  SessionStartResult,
  SpacedRecommendation,
  SwitchRecommendation,
  ToolRecommendation,
} from "../../types/domain";
import type { IStorageService } from "../types";

export const dexieAssessment: IStorageService["assessment"] = {
    questions: async (lang: string): Promise<AssessmentQuestion[]> =>
      questionsForLang(lang),
    async evaluate(body: AssessmentEvaluatePayload): Promise<LearningProfile> {
      const db = getDb();
      const project = await requireRow(
        db.learningProjects,
        body.project_id,
        "Project",
      );
      const weights = calculateProfile(body.answers);
      const ts = nowIso();
      // One-profile-per-project: replace any existing row so
      // re-running the assessment overwrites cleanly. Bump
      // ``version`` so consumers can detect rewrites.
      const existing = await db.learningProfiles
        .where("project_id")
        .equals(body.project_id)
        .first();
      const row: LearningProfileRow = {
        id: existing ? existing.id : newId(),
        user_id: project.user_id,
        project_id: project.id,
        ...weights,
        assessed_at: ts,
        version: existing ? existing.version + 1 : 1,
      };
      await db.learningProfiles.put(row);
      return rowToProfile(row);
    },
    async profile(projectId: string): Promise<LearningProfile> {
      const db = getDb();
      const row = await db.learningProfiles
        .where("project_id")
        .equals(projectId)
        .first();
      if (!row) {
        throw new ApiError(404, `Profile for project ${projectId} not found`);
      }
      return rowToProfile(row);
    },

};

export const dexieSession: IStorageService["session"] = {
    async start(body: SessionStartBody): Promise<SessionStartResult> {
      return startSession({
        projectId: body.project_id,
        method: body.method,
        cycleStep: body.cycle_step,
        lang: body.lang,
        importedConversationId: body.imported_conversation_id ?? null,
      });
    },
    /**
     * Phase 36 Bug 4 — find the most recent active session
     * started from this conversation. ImportDetail uses the
     * result to flip "Start session" into "Continue session".
     */
    async getActiveForConversation(
      conversationId: string,
    ): Promise<LearningSession | null> {
      const db = getDb();
      const rows = await db.learningSessions
        .where("imported_conversation_id")
        .equals(conversationId)
        .filter((row) => row.status === "active")
        .sortBy("started_at");
      if (rows.length === 0) return null;
      // sortBy is ascending; pick the latest.
      const latest = rows[rows.length - 1];
      return {
        id: latest.id,
        project_id: latest.project_id,
        method: latest.method,
        started_at: latest.started_at,
        ended_at: latest.ended_at,
        cycle_step: latest.cycle_step,
        status: latest.status,
        imported_conversation_id: latest.imported_conversation_id ?? null,
      };
    },
    async message(
      sessionId: string,
      body: SessionMessageBody,
    ): Promise<SessionMessageExchangeResult> {
      return sendMessage({
        sessionId,
        role: body.role,
        content: body.content,
      });
    },
    async streamMessage(
      sessionId: string,
      body: SessionMessageBody,
      handlers: {
        onStart?: (userMessage: SessionMessage) => void;
        onChunk: (delta: string) => void;
        onDone: (result: SessionMessageExchangeResult) => void;
        signal?: AbortSignal;
      },
    ): Promise<void> {
      // v1.6.0 / Phase 19B-2 — browser-direct streaming via
      // the provider's SDK SSE wire (Anthropic
      // /v1/messages?stream=true, OpenAI /chat/completions
      // ?stream=true, Gemini :streamGenerateContent?alt=sse).
      // ``sendMessageStream`` accumulates the full text
      // internally + emits each delta through ``onChunk``,
      // so the SessionChat bubble fills incrementally while
      // we still get the full ``SendMessageResult`` to hand
      // to ``onDone``.
      const result = await sendMessageStream({
        sessionId,
        role: body.role,
        content: body.content,
        onStart: handlers.onStart,
        onChunk: handlers.onChunk,
        signal: handlers.signal,
      });
      handlers.onDone(result);
    },
    async rate(
      sessionId: string,
      body: SessionRatingBody,
    ): Promise<SessionRating> {
      const db = getDb();
      const sess = await db.learningSessions.get(sessionId);
      if (!sess) {
        throw new ApiError(404, `Session ${sessionId} not found`);
      }
      const row: SessionRatingRow = {
        id: newId(),
        session_id: sessionId,
        understanding: body.understanding,
        stress: body.stress,
        method_fit: body.method_fit,
        notes: body.notes ?? null,
        created_at: nowIso(),
      };
      await db.sessionRatings.add(row);
      return {
        id: row.id,
        session_id: row.session_id,
        understanding: row.understanding,
        stress: row.stress,
        method_fit: row.method_fit,
        notes: row.notes,
        created_at: row.created_at,
      };
    },
    async end(sessionId: string): Promise<SessionEndResult> {
      const db = getDb();
      const ts = nowIso();
      // #390 Class A: a double-click (or the auto-loop) fires two
      // concurrent end() calls. Atomically flip the session to
      // "completed" and capture whether THIS call performed the
      // transition; only the winner writes the ProgressCommit and
      // runs the gamification fan-out, so XP / streak / badges /
      // commits / the auto-backup counter can't double-count. The
      // gamification engines (persistXP / updateStreakState /
      // evaluateBadges) are each atomic now, so they stay OUTSIDE
      // this transaction — keeping the tx scope to the three tables
      // it actually touches.
      let didComplete = false;
      let fresh: LearningSessionRow | undefined;
      await db.transaction(
        "rw",
        [db.learningSessions, db.sessionRatings, db.progressCommits],
        async () => {
          const sess = await db.learningSessions.get(sessionId);
          if (!sess) {
            throw new ApiError(404, `Session ${sessionId} not found`);
          }
          if (sess.status !== "completed") {
            await db.learningSessions.update(sessionId, {
              status: "completed",
              ended_at: ts,
            });
            didComplete = true;
          }
          fresh = await db.learningSessions.get(sessionId);
          // Mirror the backend's ``on_session_complete`` fan-out:
          // pull the latest SessionRating and write a ProgressCommit
          // so tracking aggregates pick it up. Only on the real
          // transition, and no-op when the user ended without rating.
          if (didComplete && fresh) {
            const ratings = await db.sessionRatings
              .where("session_id")
              .equals(sessionId)
              .toArray();
            ratings.sort((a, b) => a.created_at.localeCompare(b.created_at));
            const latestRating =
              ratings.length > 0 ? ratings[ratings.length - 1] : null;
            const commit = buildCommitFromSession(fresh, latestRating);
            if (commit) {
              await db.progressCommits.add(commit);
            }
          }
        },
      );
      if (!fresh) {
        throw new ApiError(500, "Session disappeared after end");
      }
      if (didComplete) {
        // v1.16.0 / Phase 29A — gamification ``on_session_complete``
        // fan-out. Errors MUST NOT break session end — log + continue.
        const projectForXP = await db.learningProjects.get(fresh.project_id);
        if (projectForXP) {
          try {
            await awardXPForSession({
              userId: projectForXP.user_id,
              sessionId: fresh.id,
              method: fresh.method,
              cycleStep: fresh.cycle_step,
              cycleCount: 1,
            });
            // 29C — refresh persisted streak state so the dashboard
            // widget + the streak-milestone badges see the new value.
            await updateStreakState(projectForXP.user_id);
            // 29B — evaluate badges after the XP + streak update so
            // level-/streak-/method-gated badges fire.
            await evaluateBadgesForUser(projectForXP.user_id);
          } catch (err) {
            console.warn("gamification (session-end) failed", err);
          }
        }
        // Auto-backup: bump the session counter and, if the threshold
        // is crossed, fire-and-forget a backup into the auto-backup
        // ring. Failures MUST NOT break session end.
        const trigger = recordCompletedSession();
        if (trigger !== null && projectForXP !== undefined) {
          maybeRunAutoBackup(projectForXP.user_id, __APP_VERSION__, trigger);
        }
      }
      return {
        session: {
          id: fresh.id,
          project_id: fresh.project_id,
          method: fresh.method,
          started_at: fresh.started_at,
          ended_at: fresh.ended_at,
          cycle_step: fresh.cycle_step,
          status: fresh.status,
        },
      };
    },
    async switchRecommendation(
      _sessionId: string,
    ): Promise<SwitchRecommendation> {
      // Stagnation-based method-switch recommendation is
      // deferred. Dexie mode returns "no recommendation"
      // until enough rating data accumulates for a
      // server-style heuristic to fire.
      return { recommended: false, to_method: null, reason: null };
    },
    async acceptSwitch(
      sessionId: string,
      body: { to_method: LearningMethod; reason: string },
    ): Promise<LearningSession> {
      const db = getDb();
      const sess = await db.learningSessions.get(sessionId);
      if (!sess) {
        throw new ApiError(404, `Session ${sessionId} not found`);
      }
      const from = sess.method;
      await db.learningSessions.update(sessionId, { method: body.to_method });
      const switchRow: MethodSwitchRow = {
        id: newId(),
        project_id: sess.project_id,
        session_id: sessionId,
        from_method: from,
        to_method: body.to_method,
        reason: body.reason,
        switched_at: nowIso(),
      };
      await db.methodSwitches.add(switchRow);
      const fresh = await db.learningSessions.get(sessionId);
      if (!fresh) {
        throw new ApiError(500, "Session disappeared after switch");
      }
      return {
        id: fresh.id,
        project_id: fresh.project_id,
        method: fresh.method,
        started_at: fresh.started_at,
        ended_at: fresh.ended_at,
        cycle_step: fresh.cycle_step,
        status: fresh.status,
      };
    },
    /**
     * Phase 38 Bug 7 — fetch a session record by ID for
     * the resume path. ImportDetail navigates to
     * ``/session?session=<id>`` and Session.tsx reads
     * the existing record + messages via these two
     * methods instead of calling ``start()``.
     */
    async get(sessionId: string): Promise<LearningSession> {
      const db = getDb();
      const row = await db.learningSessions.get(sessionId);
      if (!row) {
        throw new ApiError(404, `Session ${sessionId} not found`);
      }
      return {
        id: row.id,
        project_id: row.project_id,
        method: row.method,
        started_at: row.started_at,
        ended_at: row.ended_at,
        cycle_step: row.cycle_step,
        status: row.status,
        // #1143/#1141 — without this the resume DTO loses the FK, so the
        // session header topic + imported-chat intro/clean never trigger.
        imported_conversation_id: row.imported_conversation_id ?? null,
      };
    },
    /**
     * Phase 38 Bug 7 — list the chat history for a
     * session, oldest-first. Mirrors the backend's
     * ``GET /plugins/session/{id}/messages`` shape.
     */
    async getMessages(sessionId: string): Promise<SessionMessage[]> {
      const db = getDb();
      await db.learningSessions.get(sessionId).then((sess) => {
        if (!sess) {
          throw new ApiError(404, `Session ${sessionId} not found`);
        }
      });
      const rows = await db.sessionMessages
        .where("session_id")
        .equals(sessionId)
        .toArray();
      rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return rows.map((r) => ({
        id: r.id,
        session_id: r.session_id,
        role: r.role,
        content: r.content,
        created_at: r.created_at,
      }));
    },

};

export const dexieTracking: IStorageService["tracking"] = {
    async progress(projectId: string): Promise<ProgressSummary> {
      const db = getDb();
      const commits = await db.progressCommits
        .where("project_id")
        .equals(projectId)
        .toArray();
      commits.sort((a, b) => a.committed_at.localeCompare(b.committed_at));
      const trackingSlice = aggregateProgress(commits);
      return { tracking: trackingSlice };
    },
    async commits(projectId: string): Promise<ProgressCommit[]> {
      const db = getDb();
      const rows = await db.progressCommits
        .where("project_id")
        .equals(projectId)
        .toArray();
      rows.sort((a, b) => a.committed_at.localeCompare(b.committed_at));
      // v1.14.0 / Phase 27B — join each commit with its
      // session's rating notes. Mirrors the backend route's
      // LEFT JOIN so both storage modes return the same
      // wire shape. Sessions without a rating row produce
      // ``notes: null``.
      const sessionIds = rows.map((r) => r.session_id);
      const ratings = await db.sessionRatings
        .where("session_id")
        .anyOf(sessionIds)
        .toArray();
      const notesBySession = new Map<string, string | null>(
        ratings.map((r) => [r.session_id, r.notes ?? null]),
      );
      return rows.map((row) =>
        rowToCommit(row, notesBySession.get(row.session_id) ?? null),
      );
    },

};

export const dexieTools: IStorageService["tools"] = {
    async recommendations(
      projectId: string,
      lang: string,
    ): Promise<ToolRecommendation[]> {
      const db = getDb();
      const profile = await db.learningProfiles
        .where("project_id")
        .equals(projectId)
        .first();
      const weights = profile
        ? {
            deductive: profile.deductive,
            inductive: profile.inductive,
            error_based: profile.error_based,
            dialogic: profile.dialogic,
            contextual: profile.contextual,
            ai_adaptive: profile.ai_adaptive,
          }
        : {};
      return rankTools(weights, lang);
    },
    async spaced(
      projectId: string,
      lang: string,
    ): Promise<SpacedRecommendation[]> {
      const db = getDb();
      const profile = await db.learningProfiles
        .where("project_id")
        .equals(projectId)
        .first();
      if (!profile) return [];
      const commits = await db.progressCommits
        .where("project_id")
        .equals(projectId)
        .toArray();
      commits.sort((a, b) => a.committed_at.localeCompare(b.committed_at));
      const recency = recencyFromCommits(commits);
      const weights = {
        deductive: profile.deductive,
        inductive: profile.inductive,
        error_based: profile.error_based,
        dialogic: profile.dialogic,
        contextual: profile.contextual,
        ai_adaptive: profile.ai_adaptive,
      };
      return buildSpacedRecommendations(weights, recency, lang);
    },

};

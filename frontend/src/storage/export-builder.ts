/**
 * Browser-side export data aggregator (Phase 16A, Dexie mode).
 *
 * Mirrors ``backend/app/services/export_service.py`` so a user
 * exports the same payload shape regardless of storage mode. The
 * Markdown / PDF renderers in ``lib/export`` consume this shape
 * without branching on mode.
 *
 * The three top-level functions:
 *
 *   - ``buildProgressReport(db, userId, lang)`` — the learner's
 *     overall journey (profile, projects, sessions, method
 *     distribution, step-evaluation insights, extractions).
 *   - ``buildSessionDetail(db, sessionId, lang)`` — one session
 *     with full transcript + ratings + step-evaluation timeline.
 *   - ``buildCurriculumOverview(db, curriculumId, lang)`` — a
 *     curriculum with its topic tree and lessons.
 *
 * Field-name reconciliation: the Dexie schema has
 * ``StepEvaluationRow.to_step`` + ``evaluated_at`` (renamed in
 * v1.8.0 / Phase 21A for sync-surface parity); the older
 * ``suggested_step`` + ``created_at`` Dexie column names while the
 * backend uses ``to_step`` + ``evaluated_at``. This module emits
 * the backend-style names so renderers see the same shape from
 * either source.
 */

import type {
  AdaptiveLearnerDB,
  ImportedConversationRow,
  LearningProfileRow,
  LearningProjectRow,
  LearningSessionRow,
  LearningTopicRow,
  MethodSwitchRow,
  ProgressCommitRow,
  SessionRatingRow,
  StepEvaluationRow,
} from "./db";

export const EXPORT_FORMAT = "adaptive-learner-export";
export const EXPORT_VERSION = "1.3.0";

const METHODS = [
  "deductive",
  "inductive",
  "error_based",
  "dialogic",
  "contextual",
  "ai_adaptive",
] as const;

// #252 — report-type shapes live in ./export-types (pure, no ./db import)
// so storage/types + api/client can name them without pulling this
// implementation module into a cycle. Imported for local use + re-
// exported so existing `from "./export-builder"` type imports keep working.
import type {
  ExportEnvelope,
  ProgressReport,
  ProgressProfile,
  ProgressProject,
  MethodDistributionEntry,
  MethodSwitchSummary,
  ProgressRecentSession,
  SessionRatingSummary,
  StepEvaluationInsight,
  ExtractionSummary,
  SessionDetail,
  StepEvaluationDetail,
  CurriculumOverview,
  CurriculumTopic,
} from "./export-types";
export type {
  ExportEnvelope,
  ProgressReport,
  ProgressProfile,
  ProgressProject,
  MethodDistributionEntry,
  MethodSwitchSummary,
  ProgressRecentSession,
  SessionRatingSummary,
  StepEvaluationInsight,
  ExtractionSummary,
  SessionDetail,
  StepEvaluationDetail,
  CurriculumOverview,
  CurriculumTopic,
} from "./export-types";

function envelope(type: string): ExportEnvelope {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    type,
    generated_at: new Date().toISOString(),
    app_version: __APP_VERSION__,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function durationMinutes(startIso: string, endIso: string | null): number {
  if (!endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 60000));
}

function ratingDict(r: SessionRatingRow | undefined): SessionRatingSummary | null {
  if (!r) return null;
  return {
    understanding: r.understanding,
    stress: r.stress,
    method_fit: r.method_fit,
    notes: r.notes,
    created_at: r.created_at,
  };
}

function dominantMethod(profile: LearningProfileRow): string {
  const weights: Record<string, number> = {
    deductive: profile.deductive,
    inductive: profile.inductive,
    error_based: profile.error_based,
    dialogic: profile.dialogic,
    contextual: profile.contextual,
    ai_adaptive: profile.ai_adaptive,
  };
  return Object.keys(weights)
    .sort()
    .reduce((best, key) => (weights[key] > weights[best] ? key : best));
}

function profileToOut(p: LearningProfileRow | undefined): ProgressProfile | null {
  if (!p) return null;
  return {
    deductive: p.deductive,
    inductive: p.inductive,
    error_based: p.error_based,
    dialogic: p.dialogic,
    contextual: p.contextual,
    ai_adaptive: p.ai_adaptive,
    dominant_method: dominantMethod(p),
    assessed_at: p.assessed_at,
    version: p.version,
  };
}

async function latestProfile(
  db: AdaptiveLearnerDB,
  userId: string,
): Promise<LearningProfileRow | undefined> {
  const rows = await db.learningProfiles.where("user_id").equals(userId).toArray();
  if (rows.length === 0) return undefined;
  rows.sort((a, b) => b.assessed_at.localeCompare(a.assessed_at));
  return rows[0];
}

function methodDistribution(commits: ProgressCommitRow[]): MethodDistributionEntry[] {
  const counts: Record<string, number> = {};
  for (const m of METHODS) counts[m] = 0;
  for (const c of commits) {
    if (c.method in counts) counts[c.method] += 1;
  }
  const total = commits.length;
  return METHODS.map((m) => ({
    method: m,
    count: counts[m],
    percentage: total > 0 ? Math.round((counts[m] * 100) / total) : 0,
  }));
}

function summariseProject(
  project: LearningProjectRow,
  commits: ProgressCommitRow[],
  switches: MethodSwitchRow[],
): ProgressProject {
  const sessionCount = commits.length;
  const totalMinutes = commits.reduce((sum, c) => sum + c.duration_minutes, 0);
  const meanUnderstanding = sessionCount
    ? commits.reduce((s, c) => s + c.understanding, 0) / sessionCount
    : 0;
  const meanStress = sessionCount ? commits.reduce((s, c) => s + c.stress, 0) / sessionCount : 0;
  const sortedSwitches = [...switches].sort((a, b) => a.switched_at.localeCompare(b.switched_at));
  return {
    id: project.id,
    topic: project.topic,
    goal: project.goal,
    timeframe: project.timeframe,
    daily_minutes: project.daily_minutes,
    current_problem: project.current_problem,
    active: project.active,
    created_at: project.created_at,
    session_count: sessionCount,
    total_minutes: totalMinutes,
    mean_understanding: round4(meanUnderstanding),
    mean_stress: round4(meanStress),
    method_distribution: methodDistribution(commits),
    method_switches: sortedSwitches.map((s) => ({
      from_method: s.from_method,
      to_method: s.to_method,
      reason: s.reason,
      switched_at: s.switched_at,
    })),
  };
}

async function recentSessions(
  db: AdaptiveLearnerDB,
  projects: LearningProjectRow[],
  limit: number,
): Promise<ProgressRecentSession[]> {
  if (projects.length === 0) return [];
  const projectIds = new Set(projects.map((p) => p.id));
  const topicById = new Map(projects.map((p) => [p.id, p.topic]));
  const allSessions = await db.learningSessions.toArray();
  const filtered = allSessions.filter((s) => projectIds.has(s.project_id));
  filtered.sort((a, b) => b.started_at.localeCompare(a.started_at));
  const sliced = filtered.slice(0, limit);
  const out: ProgressRecentSession[] = [];
  for (const s of sliced) {
    const ratings = await db.sessionRatings.where("session_id").equals(s.id).toArray();
    ratings.sort((a, b) => b.created_at.localeCompare(a.created_at));
    out.push({
      id: s.id,
      project_id: s.project_id,
      project_topic: topicById.get(s.project_id) ?? "",
      method: s.method,
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration_minutes: durationMinutes(s.started_at, s.ended_at),
      cycle_step: s.cycle_step,
      status: s.status,
      rating: ratingDict(ratings[0]),
    });
  }
  return out;
}

/**
 * Project a Dexie StepEvaluationRow onto the export schema.
 * Since v1.8.0 / Phase 21A the Dexie column names align with
 * the backend, so this is a straight pass-through; the
 * function is kept as the boundary between the storage row
 * shape and the export-payload shape (so a future schema
 * divergence has exactly one place to translate).
 */
function normaliseStepEvaluation(row: StepEvaluationRow): StepEvaluationDetail {
  return {
    from_step: row.from_step,
    to_step: row.to_step,
    advance: row.advance,
    confidence: row.confidence,
    applied: row.applied,
    fallback_used: row.fallback_used,
    reason: row.reason,
    evaluated_at: row.evaluated_at,
  };
}

async function stepEvaluationInsights(
  db: AdaptiveLearnerDB,
  projects: LearningProjectRow[],
): Promise<StepEvaluationInsight[] | null> {
  if (projects.length === 0) return null;
  const projectIds = new Set(projects.map((p) => p.id));
  const sessions = await db.learningSessions.toArray();
  const sessionIds = new Set(sessions.filter((s) => projectIds.has(s.project_id)).map((s) => s.id));
  if (sessionIds.size === 0) return null;
  const evaluations = await db.stepEvaluations.toArray();
  const relevant = evaluations.filter((e) => sessionIds.has(e.session_id));
  if (relevant.length === 0) return null;
  const perStep: Record<number, StepEvaluationRow[]> = {};
  for (const e of relevant) {
    (perStep[e.from_step] ??= []).push(e);
  }
  const result: StepEvaluationInsight[] = [];
  for (const stepKey of Object.keys(perStep)
    .map(Number)
    .sort((a, b) => a - b)) {
    const entries = perStep[stepKey];
    const count = entries.length;
    const advances = entries.filter((e) => e.applied && e.to_step > e.from_step).length;
    const repeats = entries.filter((e) => e.applied && e.to_step <= e.from_step).length;
    const deferred = entries.filter((e) => !e.applied).length;
    const meanConf = entries.reduce((s, e) => s + e.confidence, 0) / count;
    result.push({
      step: stepKey,
      count,
      advance_count: advances,
      repeat_count: repeats,
      deferred_count: deferred,
      advance_rate: round4(advances / count),
      mean_confidence: round4(meanConf),
    });
  }
  return result;
}

async function extractionSummaries(
  db: AdaptiveLearnerDB,
  userId: string,
): Promise<ExtractionSummary[]> {
  const rows = await db.importedConversations.where("user_id").equals(userId).toArray();
  const analyzed = rows.filter((r: ImportedConversationRow) => r.analyzed);
  analyzed.sort((a, b) => b.imported_at.localeCompare(a.imported_at));
  return analyzed.map((r) => ({
    id: r.id,
    title: r.title,
    source: r.source,
    message_count: r.message_count,
    imported_at: r.imported_at,
    project_id: r.project_id,
    topic_tag: r.topic_tag,
    analysis:
      r.analysis_result && typeof r.analysis_result === "object"
        ? (r.analysis_result as Record<string, unknown>)
        : {},
  }));
}

export async function buildProgressReport(
  db: AdaptiveLearnerDB,
  userId: string,
  lang = "de",
): Promise<ProgressReport> {
  const user = await db.users.get(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  const projects = await db.learningProjects.where("user_id").equals(userId).toArray();
  projects.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const projectsData: ProgressProject[] = [];
  for (const p of projects) {
    const commits = await db.progressCommits.where("project_id").equals(p.id).toArray();
    commits.sort((a, b) => a.committed_at.localeCompare(b.committed_at));
    const switches = await db.methodSwitches.where("project_id").equals(p.id).toArray();
    projectsData.push(summariseProject(p, commits, switches));
  }

  const profile = profileToOut(await latestProfile(db, userId));
  const recent = await recentSessions(db, projects, 10);
  const insights = await stepEvaluationInsights(db, projects);
  const extractions = await extractionSummaries(db, userId);

  return {
    ...envelope("progress_report"),
    type: "progress_report",
    lang,
    user: { id: user.id, name: user.name, language: user.language },
    profile,
    projects: projectsData,
    recent_sessions: recent,
    step_evaluation_insights: insights,
    extractions,
  };
}

export async function buildSessionDetail(
  db: AdaptiveLearnerDB,
  sessionId: string,
  lang = "de",
): Promise<SessionDetail> {
  const session: LearningSessionRow | undefined = await db.learningSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const project = await db.learningProjects.get(session.project_id);
  const messages = await db.sessionMessages.where("session_id").equals(sessionId).toArray();
  messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const ratings = await db.sessionRatings.where("session_id").equals(sessionId).toArray();
  ratings.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const evaluations = await db.stepEvaluations.where("session_id").equals(sessionId).toArray();
  evaluations.sort((a, b) => a.evaluated_at.localeCompare(b.evaluated_at));

  return {
    ...envelope("session_detail"),
    type: "session_detail",
    lang,
    session: {
      id: session.id,
      project_id: session.project_id,
      method: session.method,
      started_at: session.started_at,
      ended_at: session.ended_at,
      duration_minutes: durationMinutes(session.started_at, session.ended_at),
      cycle_step: session.cycle_step,
      status: session.status,
    },
    project: project
      ? {
          id: project.id,
          topic: project.topic,
          goal: project.goal,
          timeframe: project.timeframe,
        }
      : null,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    })),
    rating: ratingDict(ratings[0]),
    step_evaluations: evaluations.map(normaliseStepEvaluation),
  };
}

function flattenTopicTree(topics: LearningTopicRow[]): CurriculumTopic[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const childrenOf = new Map<string | null, LearningTopicRow[]>();
  for (const t of topics) {
    const parentKey: string | null = t.parent_id && byId.has(t.parent_id) ? t.parent_id : null;
    const list = childrenOf.get(parentKey) ?? [];
    list.push(t);
    childrenOf.set(parentKey, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.order_index - b.order_index || a.created_at.localeCompare(b.created_at));
  }
  const out: CurriculumTopic[] = [];
  const walk = (parentId: string | null, depth: number): void => {
    for (const t of childrenOf.get(parentId) ?? []) {
      out.push({
        id: t.id,
        parent_id: t.parent_id,
        title: t.title,
        description: t.description,
        order_index: t.order_index,
        depth,
      });
      walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export async function buildCurriculumOverview(
  db: AdaptiveLearnerDB,
  curriculumId: string,
  lang = "de",
): Promise<CurriculumOverview> {
  const curriculum = await db.curricula.get(curriculumId);
  if (!curriculum) {
    throw new Error(`Curriculum ${curriculumId} not found`);
  }
  const topics = await db.learningTopics.where("curriculum_id").equals(curriculumId).toArray();
  const lessons = await db.lessons.where("curriculum_id").equals(curriculumId).toArray();
  lessons.sort((a, b) => a.order_index - b.order_index || a.created_at.localeCompare(b.created_at));

  return {
    ...envelope("curriculum_overview"),
    type: "curriculum_overview",
    lang,
    curriculum: {
      id: curriculum.id,
      title: curriculum.title,
      description: curriculum.description,
      language: curriculum.language,
      created_at: curriculum.created_at,
      updated_at: curriculum.updated_at,
    },
    topics: flattenTopicTree(topics),
    lessons: lessons.map((l) => ({
      id: l.id,
      title: l.title,
      content: l.content,
      order_index: l.order_index,
    })),
  };
}

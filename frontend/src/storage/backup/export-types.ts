/**
 * Pure type shapes for the export reports (#252).
 *
 * Extracted from ``export-builder.ts`` so type-only consumers — the
 * IStorageService contract in ``storage/types.ts`` and ``api/client.ts`` —
 * can name ``ProgressReport`` / ``SessionDetail`` / ``CurriculumOverview``
 * (and the shapes they nest) WITHOUT importing the builder implementation,
 * which imports ``./db`` and closed the cycle
 *   (api/client ->) storage/export-builder -> storage/db -> storage/types
 *   (-> back to export-builder / api/client).
 * This module has no imports of its own, so it can never join a cycle.
 */

export type ExportEnvelope = {
  format: string;
  version: string;
  type: string;
  generated_at: string;
  app_version: string;
};

export interface ProgressReport extends ExportEnvelope {
  type: "progress_report";
  lang: string;
  user: { id: string; name: string; language: string };
  profile: ProgressProfile | null;
  projects: ProgressProject[];
  recent_sessions: ProgressRecentSession[];
  step_evaluation_insights: StepEvaluationInsight[] | null;
  extractions: ExtractionSummary[];
}

export interface ProgressProfile {
  deductive: number;
  inductive: number;
  error_based: number;
  dialogic: number;
  contextual: number;
  ai_adaptive: number;
  dominant_method: string;
  assessed_at: string;
  version: number;
}

export interface ProgressProject {
  id: string;
  topic: string;
  goal: string;
  timeframe: string;
  daily_minutes: number;
  current_problem: string | null;
  active: boolean;
  created_at: string;
  session_count: number;
  total_minutes: number;
  mean_understanding: number;
  mean_stress: number;
  method_distribution: MethodDistributionEntry[];
  method_switches: MethodSwitchSummary[];
}

export interface MethodDistributionEntry {
  method: string;
  count: number;
  percentage: number;
}

export interface MethodSwitchSummary {
  from_method: string;
  to_method: string;
  reason: string;
  switched_at: string;
}

export interface ProgressRecentSession {
  id: string;
  project_id: string;
  project_topic: string;
  method: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  cycle_step: number;
  status: string;
  rating: SessionRatingSummary | null;
}

export interface SessionRatingSummary {
  understanding: number;
  stress: number;
  method_fit: number;
  notes: string | null;
  created_at: string;
}

export interface StepEvaluationInsight {
  step: number;
  count: number;
  advance_count: number;
  repeat_count: number;
  deferred_count: number;
  advance_rate: number;
  mean_confidence: number;
}

export interface ExtractionSummary {
  id: string;
  title: string;
  source: string;
  message_count: number;
  imported_at: string;
  project_id: string | null;
  topic_tag: string | null;
  analysis: Record<string, unknown>;
}

export interface SessionDetail extends ExportEnvelope {
  type: "session_detail";
  lang: string;
  session: {
    id: string;
    project_id: string;
    method: string;
    started_at: string;
    ended_at: string | null;
    duration_minutes: number;
    cycle_step: number;
    status: string;
  };
  project: {
    id: string;
    topic: string;
    goal: string;
    timeframe: string;
  } | null;
  messages: {
    role: string;
    content: string;
    created_at: string;
  }[];
  rating: SessionRatingSummary | null;
  step_evaluations: StepEvaluationDetail[];
}

export interface StepEvaluationDetail {
  from_step: number;
  to_step: number;
  advance: boolean;
  confidence: number;
  applied: boolean;
  fallback_used: boolean;
  reason: string;
  evaluated_at: string;
}

export interface CurriculumOverview extends ExportEnvelope {
  type: "curriculum_overview";
  lang: string;
  curriculum: {
    id: string;
    title: string;
    description: string | null;
    language: string;
    created_at: string;
    updated_at: string;
  };
  topics: CurriculumTopic[];
  lessons: {
    id: string;
    title: string;
    content: string;
    order_index: number;
  }[];
}

export interface CurriculumTopic {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  order_index: number;
  depth: number;
}

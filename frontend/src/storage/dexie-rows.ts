/**
 * Shared Dexie row <-> wire mappers + row helpers (#354).
 *
 * Extracted from ``dexie-storage.ts`` so the per-domain namespace
 * modules (``dexie-imports.ts``, ...) and the root storage object can
 * share one set of converters between the IndexedDB row shapes
 * (``./db``) and the wire/domain types the pages consume.
 */

import type { EntityTable } from "dexie";

import { ApiError } from "../api/client";
import {
  newId,
  nowIso,
  type AdaptiveLearnerDB,
  type CurriculumRow,
  type ImportedConversationRow,
  type ImportedMessageRow,
  type LearningProfileRow,
  type LearningProjectRow,
  type LearningTopicRow,
  type LessonRow,
  type UserRow,
  type UserSettingsRow,
} from "./db";
import type {
  ConversationAnalysisResult,
  Curriculum,
  ImportedConversation,
  ImportedConversationSource,
  ImportedMessage,
  LearningProfile,
  LearningProject,
  LearningTopic,
  Lesson,
  User,
  UserSettings,
} from "../types/domain";

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    language: row.language,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToProject(row: LearningProjectRow): LearningProject {
  // v1.31.0 / Phase 46F: back-fill kind for pre-migration
  // rows. Dexie-mode users never create a "content"
  // pseudo-project (the unification path runs server-side
  // only), so every row in Dexie storage is "standard" by
  // construction — but the type contract requires the
  // field, so we default.
  const kind = (row.kind ?? "standard") as LearningProject["kind"];
  return {
    id: row.id,
    user_id: row.user_id,
    topic: row.topic,
    goal: row.goal,
    timeframe: row.timeframe,
    daily_minutes: row.daily_minutes,
    current_problem: row.current_problem,
    active: row.active,
    kind,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToSettings(row: UserSettingsRow): UserSettings {
  // Phase 34 (v1.20.0) — Dexie mode is desktop-only via PWA;
  // there is no filesystem access from the browser sandbox, so
  // ``secrets.yaml`` never applies here. Every key source
  // collapses to either "settings" (when present in IndexedDB)
  // or "none" (when absent). The UI renders identical
  // affordances in both modes; in Dexie mode the user never
  // sees the externally-managed warning because they can't
  // hit that state.
  return {
    id: row.id,
    user_id: row.user_id,
    language: row.language,
    active_provider: row.active_provider,
    has_anthropic_key: !!row.api_key_anthropic,
    has_openai_key: !!row.api_key_openai,
    has_gemini_key: !!row.api_key_gemini,
    model_override_anthropic: row.model_override_anthropic,
    model_override_openai: row.model_override_openai,
    model_override_gemini: row.model_override_gemini,
    key_source_anthropic: row.api_key_anthropic ? "settings" : "none",
    key_source_openai: row.api_key_openai ? "settings" : "none",
    key_source_gemini: row.api_key_gemini ? "settings" : "none",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToCurriculum(row: CurriculumRow): Curriculum {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    language: row.language,
    created_at: row.created_at,
    updated_at: row.updated_at,
    imported_conversation_id: row.imported_conversation_id ?? null,
  };
}

export function rowToTopic(row: LearningTopicRow): LearningTopic {
  return {
    id: row.id,
    curriculum_id: row.curriculum_id,
    parent_id: row.parent_id,
    title: row.title,
    description: row.description,
    order_index: row.order_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToProfile(row: LearningProfileRow): LearningProfile {
  const weights = {
    deductive: row.deductive,
    inductive: row.inductive,
    error_based: row.error_based,
    dialogic: row.dialogic,
    contextual: row.contextual,
    ai_adaptive: row.ai_adaptive,
  };
  // Alphabetical tie-break, matches LearningProfile.dominant_method on backend.
  const sortedKeys = (Object.keys(weights) as (keyof typeof weights)[]).sort();
  let dominant = sortedKeys[0];
  let bestVal = -Infinity;
  for (const k of sortedKeys) {
    if (weights[k] > bestVal) {
      dominant = k;
      bestVal = weights[k];
    }
  }
  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    deductive: row.deductive,
    inductive: row.inductive,
    error_based: row.error_based,
    dialogic: row.dialogic,
    contextual: row.contextual,
    ai_adaptive: row.ai_adaptive,
    assessed_at: row.assessed_at,
    version: row.version,
    dominant_method: dominant,
  };
}

export function rowToLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    curriculum_id: row.curriculum_id,
    title: row.title,
    content: row.content,
    order_index: row.order_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToImportedConversation(
  row: ImportedConversationRow,
): ImportedConversation {
  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    source: row.source as ImportedConversationSource,
    title: row.title,
    message_count: row.message_count,
    imported_at: row.imported_at,
    analyzed: row.analyzed,
    topic_tag: row.topic_tag,
    model: row.model,
    source_created_at: row.source_created_at,
    analysis_result: row.analysis_result as ConversationAnalysisResult | null,
    content_hash: row.content_hash ?? null,
    source_language: row.source_language ?? null,
    target_language: row.target_language ?? null,
  };
}

export function rowToImportedMessage(row: ImportedMessageRow): ImportedMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    order_index: row.order_index,
  };
}

export async function requireRow<T extends { id: string }>(
  table: EntityTable<T, "id">,
  id: string,
  label: string,
): Promise<T> {
  // Dexie's IDType<T, "id"> is a conditional type that doesn't
  // reduce to ``string`` even when the row's id field IS a
  // string. Cast at this single boundary so the call sites
  // stay legible.
  const row = await table.get(id as unknown as Parameters<typeof table.get>[0]);
  if (!row) {
    throw new ApiError(404, `${label} ${id} not found`);
  }
  return row;
}

/**
 * Ensure a UserSettings row exists for ``userId``. Used by every
 * settings.* method so a fresh-install browser doesn't 404 on the
 * first read.
 */
export async function ensureSettings(
  db: AdaptiveLearnerDB,
  userId: string,
  language: string,
): Promise<UserSettingsRow> {
  const existing = await db.userSettings
    .where("user_id")
    .equals(userId)
    .first();
  if (existing) return existing;
  const ts = nowIso();
  const row: UserSettingsRow = {
    id: newId(),
    user_id: userId,
    language,
    active_provider: "anthropic",
    api_key_anthropic: null,
    api_key_openai: null,
    api_key_gemini: null,
    model_override_anthropic: null,
    model_override_openai: null,
    model_override_gemini: null,
    created_at: ts,
    updated_at: ts,
  };
  await db.userSettings.add(row);
  return row;
}

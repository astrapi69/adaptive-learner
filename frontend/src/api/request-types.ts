/**
 * Request-body DTOs for the typed API client (#252).
 *
 * Extracted from ``api/client.ts`` so type-only consumers — notably the
 * IStorageService contract in ``storage/types.ts`` — can name these request
 * shapes without importing the client implementation, which deeply imports
 * ``storage/types`` for its return types. That mutual import was a 2-node
 * cycle (api/client <-> storage/types). This module imports only
 * ``lib/constants`` (pure), so it cannot join a cycle.
 */

import type { AIProvider, LearningMethod, MessageRole } from "../lib/constants";

export interface UserCreateBody {
  name: string;
  email?: string | null;
  language?: string;
}

export interface UserUpdateBody {
  name?: string;
  email?: string | null;
  language?: string;
}

export interface LearningProjectCreateBody {
  topic: string;
  goal: string;
  timeframe: string;
  daily_minutes: number;
  current_problem?: string | null;
  active?: boolean;
}

export interface LearningProjectUpdateBody {
  topic?: string;
  goal?: string;
  timeframe?: string;
  daily_minutes?: number;
  current_problem?: string | null;
  active?: boolean;
}

export interface SettingsPatchBody {
  active_provider?: AIProvider;
  language?: string;
  // v0.4.0 — per-provider model override. ``""`` (empty string)
  // clears the override; a non-empty string sets it; field
  // omitted leaves the existing column alone.
  model_override_anthropic?: string;
  model_override_openai?: string;
  model_override_gemini?: string;
}

export interface ApiKeySetBody {
  provider: AIProvider;
  key: string;
}

export interface SessionStartBody {
  project_id: string;
  method?: LearningMethod;
  cycle_step?: number;
  lang?: string;
  /**
   * Phase 36 Bug 4 — optional FK back to the imported
   * conversation that started this session. The backend resumes
   * an existing active session for the same conversation
   * instead of creating a new one when this is set.
   */
  imported_conversation_id?: string | null;
}

export interface SessionMessageBody {
  role: MessageRole;
  content: string;
}

export interface SessionRatingBody {
  understanding: number;
  stress: number;
  method_fit: number;
  notes?: string | null;
}

export interface CurriculumCreateBody {
  title: string;
  description?: string | null;
  language?: string;
  /**
   * Phase 36 Bug 3 — optional FK back to the imported conversation
   * this curriculum was generated from. Lets ImportDetail flip
   * the "Create curriculum" CTA into a "Go to curriculum"
   * navigation so users do not generate duplicates.
   */
  imported_conversation_id?: string | null;
}

export interface CurriculumUpdateBody {
  title?: string;
  description?: string | null;
  language?: string;
}

export interface TopicCreateBody {
  title: string;
  description?: string | null;
  parent_id?: string | null;
  order_index?: number;
}

export interface TopicUpdateBody {
  title?: string;
  description?: string | null;
  parent_id?: string | null;
  order_index?: number;
}

export interface LessonCreateBody {
  title: string;
  content?: string;
  order_index?: number;
}

export interface LessonUpdateBody {
  title?: string;
  content?: string;
  order_index?: number;
}

export interface SubjectCreateBody {
  name: string;
  parent_id?: string | null;
  description?: string | null;
  icon?: string | null;
}

export interface SubjectUpdateBody {
  name?: string;
  parent_id?: string | null;
  description?: string | null;
  icon?: string | null;
}

export interface TagCreateBody {
  name: string;
  color?: string | null;
}

export interface TagUpdateBody {
  name?: string;
  color?: string | null;
}

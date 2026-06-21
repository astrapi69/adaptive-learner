/**
 * Anki card suggestion shapes + namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */


export interface AnkiCardSuggestion {
  id: string;
  user_id: string;
  session_id: string | null;
  conversation_id: string | null;
  project_id: string | null;
  card_type: "basic" | "cloze";
  front: string;
  back: string;
  tags: string[];
  accepted: boolean;
  rejected: boolean;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnkiCardCreateBody {
  session_id?: string | null;
  conversation_id?: string | null;
  project_id?: string | null;
  card_type?: "basic" | "cloze";
  front: string;
  back: string;
  tags?: string[];
  accepted?: boolean;
}

export interface AnkiCardUpdateBody {
  card_type?: "basic" | "cloze";
  front?: string;
  back?: string;
  tags?: string[];
  accepted?: boolean;
  rejected?: boolean;
}

export interface AnkiCardListFilters {
  projectId?: string;
  acceptedOnly?: boolean;
  includeRejected?: boolean;
}

/**
 * Study question (Phase 32B / v1.19.0) — AI-generated active-
 * recall flashcard candidate. User reviews, edits, deletes.
 */

/**
 * Pronunciation + anki namespaces.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type {
  AnkiCardCreateBody,
  AnkiCardListFilters,
  AnkiCardSuggestion,
  AnkiCardUpdateBody,
} from "../anki";

export interface PronunciationVerdict {
  matches: boolean;
  score: number;
  feedback: string;
  missed_sounds: string[];
}

export interface IPronunciationNamespace {
  eligibility(projectId: string): Promise<{ eligible: boolean }>;
  phrase(args: {
    project_id: string;
    language: string;
    level?: string;
    focus?: string;
    previous?: string[];
  }): Promise<{ phrase: string; language: string }>;
  judge(args: {
    project_id: string;
    target: string;
    actual: string;
    language: string;
  }): Promise<PronunciationVerdict>;
}

export interface IAnkiNamespace {
  list(userId: string, filters?: AnkiCardListFilters): Promise<AnkiCardSuggestion[]>;
  create(userId: string, body: AnkiCardCreateBody): Promise<AnkiCardSuggestion>;
  update(cardId: string, body: AnkiCardUpdateBody): Promise<AnkiCardSuggestion>;
  remove(cardId: string): Promise<void>;
  extractFromSession(sessionId: string): Promise<AnkiCardSuggestion[]>;
  extractFromConversation(conversationId: string): Promise<AnkiCardSuggestion[]>;
  markExported(cardIds: string[]): Promise<{ updated: number }>;
}

/**
 * Per-user XP / level state (Phase 29A / v1.16.0).
 *
 * ``state`` returns the current ``UserXP`` row plus derived
 * ``xp_into_level`` + ``xp_to_next_level`` so the dashboard
 * progress bar doesn't have to recompute the threshold curve.
 *
 * ``awardSession`` is invoked from session-end in Dexie mode
 * only — in API mode the gamification plugin's hook handles
 * the award server-side. Returns the breakdown so the floating
 * "+50 XP" animation can render without a follow-up roundtrip.
 *
 * ``awardAssessment`` / ``awardImport`` are flat earns from
 * the assessment + import flows; both modes call them.
 */

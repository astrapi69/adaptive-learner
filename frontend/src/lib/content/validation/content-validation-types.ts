/**
 * Pure type shapes for AI content validation (#252).
 *
 * Extracted from ``ai-content-validator.ts`` so that type-only
 * consumers — ``storage/types.ts`` (the IStorageService contract) and
 * ``api/client.ts`` — can reference ``AiValidationResult`` WITHOUT
 * importing the validator's implementation module. That implementation
 * import was the back-edge of two import cycles:
 *   api/client -> ai-content-validator -> content-validator -> storage/types
 *   ai-content-validator -> content-validator -> storage/types (-> ai-content-validator)
 * Both close because ``storage/types`` (and ``api/client``) only needed
 * these TYPES, not the validator code. This module has no imports of its
 * own, so it can never participate in a cycle.
 */

export interface AiTranslationIssue {
  card_id: string;
  issue: string;
  suggestion: string;
}
export interface AiDistractorIssue {
  exercise_id: string;
  issue: string;
  suggestion: string;
}
export interface AiGrammarIssue {
  step_id: string;
  issue: string;
  correction: string;
}
export interface AiLevelIssue {
  item: string;
  issue: string;
  suggestion: string;
}

export interface AiValidationResult {
  overall: "pass" | "review_needed";
  translation_issues: AiTranslationIssue[];
  distractor_issues: AiDistractorIssue[];
  grammar_issues: AiGrammarIssue[];
  level_issues: AiLevelIssue[];
  cultural_flags: string[];
  quality_score: number;
}

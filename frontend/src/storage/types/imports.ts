/**
 * Chat-import namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type {
  ImportedConversation,
  ImportedConversationAnalysis,
  ImportedConversationCreateBody,
  ImportedConversationDetail,
  ImportedConversationUpdateBody,
} from "../../types/domain";

export interface IImportsNamespace {
  list(userId: string): Promise<ImportedConversation[]>;
  create(userId: string, body: ImportedConversationCreateBody): Promise<ImportedConversation>;
  get(conversationId: string): Promise<ImportedConversationDetail>;
  update(
    conversationId: string,
    body: ImportedConversationUpdateBody,
  ): Promise<ImportedConversation>;
  remove(conversationId: string): Promise<void>;
  saveAnalysis(
    conversationId: string,
    analysis: ImportedConversationAnalysis,
  ): Promise<ImportedConversationDetail>;
  /**
   * Server-side analyze. API mode dispatches the analysis call
   * server-side because the user's cleartext API key never
   * leaves the backend. Dexie mode keeps the browser-direct
   * path (the cleartext key lives in the local Dexie row), so
   * this method throws there — callers must branch on
   * ``storage.mode``.
   */
  analyze(conversationId: string): Promise<ImportedConversationDetail>;
}

/**
 * Marker for the backing store. Pages don't typically need to
 * branch on this, but Settings (and a few tests) do.
 */

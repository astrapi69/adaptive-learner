/**
 * Dexie implementation of ``IStorageService.imports`` (#354).
 *
 * Extracted from ``dexie-storage.ts``: chat-import conversations +
 * messages, the Phase 36 per-user duplicate check (same SHA-256 the
 * backend computes), and the analysis persistence path. Browser-side
 * analysis itself stays with the caller (Import.tsx) because the
 * cleartext API key lives in the local Dexie row — ``analyze`` is
 * API-mode only by design.
 */

import { ApiError } from "../../api/client";
import { computeContentHash } from "../../chat_import/content-hash";
import { getDb, newId, nowIso } from "../db/db";
import type { ImportedConversationRow, ImportedMessageRow } from "../db/db";
import {
  rowToImportedConversation,
  rowToImportedMessage,
} from "../db/dexie-rows";
import type {
  ImportedConversation,
  ImportedConversationAnalysis,
  ImportedConversationCreateBody,
  ImportedConversationDetail,
  ImportedConversationUpdateBody,
} from "../../types/domain";
import type { IStorageService } from "../types";

export const dexieImports: IStorageService["imports"] = {
  async list(userId: string): Promise<ImportedConversation[]> {
    const db = getDb();
    const rows = await db.importedConversations
      .where("user_id")
      .equals(userId)
      .toArray();
    rows.sort((a, b) =>
      a.imported_at < b.imported_at
        ? 1
        : a.imported_at > b.imported_at
          ? -1
          : 0,
    );
    return rows.map(rowToImportedConversation);
  },
  async create(
    userId: string,
    body: ImportedConversationCreateBody,
  ): Promise<ImportedConversation> {
    if (!body.messages || body.messages.length === 0) {
      throw new ApiError(
        422,
        "ImportedConversation requires at least one message",
        "/users/.../imports",
        "POST",
      );
    }
    const db = getDb();
    const user = await db.users.get(userId);
    if (!user) {
      throw new ApiError(
        404,
        `User ${userId} not found.`,
        "/users/.../imports",
        "POST",
      );
    }
    if (body.project_id) {
      const project = await db.learningProjects.get(body.project_id);
      if (!project) {
        throw new ApiError(
          404,
          `LearningProject ${body.project_id} not found.`,
          "/users/.../imports",
          "POST",
        );
      }
      if (project.user_id !== userId) {
        throw new ApiError(
          400,
          `Project ${body.project_id} does not belong to user ${userId}.`,
          "/users/.../imports",
          "POST",
        );
      }
    }
    // Phase 36 Bug 1 — compute the same SHA-256 the
    // backend computes (see content-hash.ts) so the per-
    // user duplicate check matches the API path's 409.
    const contentHash = await computeContentHash(body.messages);
    const existing = await db.importedConversations
      .where("content_hash")
      .equals(contentHash)
      .filter((row) => row.user_id === userId)
      .first();
    if (existing) {
      const err = new ApiError(
        409,
        "Conversation already imported with the same content.",
        "/users/.../imports",
        "POST",
        undefined,
        { existing_id: existing.id },
      );
      throw err;
    }
    const conversationId = newId();
    const now = nowIso();
    const conv: ImportedConversationRow = {
      id: conversationId,
      user_id: userId,
      project_id: body.project_id ?? null,
      source: body.source,
      title: body.title,
      message_count: body.messages.length,
      imported_at: now,
      analyzed: false,
      analysis_result: null,
      topic_tag: body.topic_tag ?? null,
      model: body.model ?? null,
      source_created_at: body.source_created_at ?? null,
      content_hash: contentHash,
      source_language: body.source_language ?? null,
      target_language: body.target_language ?? null,
    };
    await db.importedConversations.put(conv);
    // v1.8.0 / Phase 21D — every imported message now
    // carries ``created_at`` for sync timestamp filtering.
    // We use the parent's ``imported_at`` so every
    // message of a single import shares the same wall-
    // clock moment (matches the backend's Alembic 0007
    // back-fill).
    const messageRows: ImportedMessageRow[] = body.messages.map(
      (msg, idx) => ({
        id: newId(),
        conversation_id: conversationId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ?? null,
        order_index: idx,
        created_at: conv.imported_at,
      }),
    );
    await db.importedMessages.bulkPut(messageRows);
    return rowToImportedConversation(conv);
  },
  async get(conversationId: string): Promise<ImportedConversationDetail> {
    const db = getDb();
    const conv = await db.importedConversations.get(conversationId);
    if (!conv) {
      throw new ApiError(
        404,
        `ImportedConversation ${conversationId} not found.`,
        `/imports/${conversationId}`,
        "GET",
      );
    }
    const messages = await db.importedMessages
      .where("conversation_id")
      .equals(conversationId)
      .sortBy("order_index");
    return {
      ...rowToImportedConversation(conv),
      messages: messages.map(rowToImportedMessage),
    };
  },
  async update(
    conversationId: string,
    body: ImportedConversationUpdateBody,
  ): Promise<ImportedConversation> {
    const db = getDb();
    // #390 Phase 3: existence + project-ownership reads and the put run
    // in one rw transaction so a concurrent edit isn't lost.
    let updated: ImportedConversationRow | null = null;
    await db.transaction(
      "rw",
      [db.importedConversations, db.learningProjects],
      async () => {
        const conv = await db.importedConversations.get(conversationId);
        if (!conv) {
          throw new ApiError(
            404,
            `ImportedConversation ${conversationId} not found.`,
            `/imports/${conversationId}`,
            "PATCH",
          );
        }
        if (body.project_id !== undefined && body.project_id !== null) {
          const project = await db.learningProjects.get(body.project_id);
          if (!project) {
            throw new ApiError(
              404,
              `LearningProject ${body.project_id} not found.`,
              `/imports/${conversationId}`,
              "PATCH",
            );
          }
          if (project.user_id !== conv.user_id) {
            throw new ApiError(
              400,
              `Project ${body.project_id} does not belong to user ${conv.user_id}.`,
              `/imports/${conversationId}`,
              "PATCH",
            );
          }
        }
        updated = {
          ...conv,
          project_id:
            body.project_id !== undefined ? body.project_id : conv.project_id,
          topic_tag:
            body.topic_tag !== undefined ? body.topic_tag : conv.topic_tag,
          title: body.title ?? conv.title,
          source_language:
            body.source_language !== undefined
              ? body.source_language
              : conv.source_language,
          target_language:
            body.target_language !== undefined
              ? body.target_language
              : conv.target_language,
        };
        await db.importedConversations.put(updated);
      },
    );
    return rowToImportedConversation(updated as unknown as ImportedConversationRow);
  },
  async remove(conversationId: string): Promise<void> {
    const db = getDb();
    await db.importedMessages
      .where("conversation_id")
      .equals(conversationId)
      .delete();
    await db.importedConversations.delete(conversationId);
  },
  async saveAnalysis(
    conversationId: string,
    analysis: ImportedConversationAnalysis,
  ): Promise<ImportedConversationDetail> {
    const db = getDb();
    // #390 Phase 3: atomic get+spread+put for the analysis stamp.
    let updated: ImportedConversationRow | null = null;
    await db.transaction("rw", db.importedConversations, async () => {
      const conv = await db.importedConversations.get(conversationId);
      if (!conv) {
        throw new ApiError(
          404,
          `ImportedConversation ${conversationId} not found.`,
          `/imports/${conversationId}/analysis`,
          "POST",
        );
      }
      updated = {
        ...conv,
        analyzed: true,
        analysis_result: analysis.analysis_result as Record<string, unknown>,
      };
      await db.importedConversations.put(updated);
    });
    const messages = await db.importedMessages
      .where("conversation_id")
      .equals(conversationId)
      .sortBy("order_index");
    return {
      ...rowToImportedConversation(updated as unknown as ImportedConversationRow),
      messages: messages.map(rowToImportedMessage),
    };
  },
  async analyze(conversationId: string): Promise<ImportedConversationDetail> {
    // Dexie mode runs the analysis browser-side because the
    // cleartext API key lives in the local Dexie row. The
    // caller (Import.tsx) branches on storage.mode and uses
    // ``analyzeConversation`` + ``saveAnalysis`` instead;
    // calling this method in Dexie mode is a wiring bug.
    throw new ApiError(
      501,
      "Server-side analyze is API-mode only. Use the browser-direct path in Dexie mode.",
      `/imports/${conversationId}/analyze`,
      "POST",
    );
  },
};

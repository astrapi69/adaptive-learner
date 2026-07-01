/**
 * Build the AI chat messages for the lesson "Ask AI" / "Vertiefen" feature
 * (#1321): the learner reads ONE theory block or exercise and asks a follow-up
 * question about exactly that block.
 *
 * Pure + library-grade: no app/storage/i18n imports. The caller passes the
 * block context + the user's question; this returns the {@link ChatMessage}
 * array to hand to the existing browser-direct ``aiComplete`` path — no second
 * AI integration.
 *
 * Data-sparse by design: only the current block's text is sent as context, not
 * the whole set. The system prompt scopes the model to THIS block (explain,
 * deepen, give an example) and asks it to reply in the learner's UI language.
 */

import type { ChatMessage } from "../../../storage/ai/ai-providers";

/** Which lesson block the learner is asking about. */
export type AskBlockKind = "theory" | "exercise";

export interface AskAiContext {
  /** The block the button sits on. */
  kind: AskBlockKind;
  /** The block's text (theory Markdown, or the exercise prompt/instruction). */
  blockText: string;
  /** BCP-47 code the lesson teaches (target language), if known. */
  targetLanguage?: string | null;
  /** BCP-47 code the learner speaks (source language), if known. */
  sourceLanguage?: string | null;
  /** Content domain (``language`` / ``programming`` / …), if known. */
  domain?: string | null;
  /** The learner's UI language code, so the answer comes back in it. */
  uiLanguage: string;
}

/** Cap the context we send so a huge theory block can't blow the token budget
 *  (data-sparse). Generous enough for any real block. */
const MAX_CONTEXT_CHARS = 4000;

/** Trim + clamp the block text to the context budget. */
function clampContext(text: string): string {
  const trimmed = (text ?? "").trim();
  return trimmed.length > MAX_CONTEXT_CHARS
    ? `${trimmed.slice(0, MAX_CONTEXT_CHARS)}…`
    : trimmed;
}

/**
 * Compose the system + user messages for an "Ask AI about this block" turn.
 *
 * @param context - The current block + language/domain hints + UI language.
 * @param question - The learner's free-text question.
 * @param history - Prior turns in this mini-conversation (for follow-ups).
 * @returns Messages for ``aiComplete`` / ``aiStream``.
 */
export function buildAskAiMessages(
  context: AskAiContext,
  question: string,
  history: ChatMessage[] = [],
): ChatMessage[] {
  const blockLabel = context.kind === "theory" ? "theory block" : "exercise";
  const subject =
    context.domain && context.domain !== "language"
      ? `the topic "${context.domain}"`
      : context.targetLanguage
        ? `${context.targetLanguage}${
            context.sourceLanguage ? ` (explained in ${context.sourceLanguage})` : ""
          }`
        : "this lesson";

  const system: ChatMessage = {
    role: "system",
    content: [
      `You are a helpful, concise tutor inside a learning app. The learner is studying ${subject}.`,
      `They are reading the following ${blockLabel} and want to go deeper — explain it, clarify, or give a concrete example.`,
      `Answer ONLY about this ${blockLabel}; do not invent unrelated content. If the question is off-topic for it, say so briefly.`,
      `Reply in the learner's UI language (BCP-47 code: ${context.uiLanguage}). Keep it focused and short.`,
      "",
      `--- ${blockLabel.toUpperCase()} START ---`,
      clampContext(context.blockText),
      `--- ${blockLabel.toUpperCase()} END ---`,
    ].join("\n"),
  };

  return [
    system,
    ...history,
    { role: "user", content: (question ?? "").trim() },
  ];
}

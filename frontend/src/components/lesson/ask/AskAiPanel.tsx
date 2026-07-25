/**
 * AskAiPanel — "KI fragen" / "Vertiefen" for a single lesson block (#1321).
 *
 * Sits under a theory block or an exercise. The "Ask AI" button is ALWAYS
 * visible so the feature is discoverable. When the active AI provider has a
 * key (BYOK), it opens a small ask panel: the learner types a question and
 * gets an answer scoped to THIS block (explain / deepen / example), with
 * follow-ups. Without a key the SAME button renders greyed-out
 * (``aria-disabled``, NOT the ``disabled`` attribute, because a ``disabled``
 * button receives no touch events, so the hint would be a dead tap-target on
 * iPhone/iPad). Tapping, hovering or focusing it reveals a small popover with
 * a BYOK hint and a link to the AI settings, never blocking the reading flow
 * (#1443).
 *
 * The popover reuses the project's Radix ``HoverCard`` primitive (the same one
 * ``HelpTooltip`` uses): hover on desktop, tap/focus on touch, and it can host
 * the interactive settings link. Library-first, no new tooltip dependency.
 *
 * Reuses the existing browser-direct AI path (``resolveActiveAiProvider`` +
 * ``aiComplete``, the same one the exercise-generation feature uses) — no
 * second integration. Data-sparse: only the current block goes as context
 * ({@link buildAskAiMessages}). Token-backed Tailwind only.
 */

import * as HoverCard from "@radix-ui/react-hover-card";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useApiKeyStatus } from "../../../hooks/settings/useApiKeyStatus";
import { useI18n } from "../../../hooks/ui/useI18n";
import {
  buildAskAiMessages,
  type AskAiContext,
} from "../../../lib/ai/ask/build-ask-prompt";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { resolveActiveAiProvider } from "../../../lib/ai/providers/resolve-provider";
import { aiComplete, type ChatMessage } from "../../../storage/ai/ai-providers";

export interface AskAiPanelProps {
  /** The block context (kind + text + language/domain hints). ``uiLanguage``
   *  is filled in from the active UI language, so callers omit it. */
  context: Omit<AskAiContext, "uiLanguage">;
  /** Test id prefix. */
  testId?: string;
}

/** One completed question→answer turn, kept for follow-up context. */
interface Turn {
  question: string;
  answer: string;
}

export default function AskAiPanel({
  context,
  testId = "ask-ai",
}: AskAiPanelProps) {
  const { t, lang } = useI18n();
  const { ready, hasKey } = useApiKeyStatus();
  const [open, setOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Still resolving the key status — render nothing to avoid a flash.
  if (!ready) return null;

  // No AI key: the SAME "Ask AI" button, rendered greyed-out. It stays
  // focusable and tappable (aria-disabled, not the disabled attribute) so a
  // tap/hover/focus reveals the BYOK hint popover instead of a dead
  // tap-target. Clicking it never fires an AI request.
  if (!hasKey) {
    const hintId = `${testId}-hint`;
    return (
      <div className="mt-3">
        <HoverCard.Root
          open={hintOpen}
          onOpenChange={setHintOpen}
          openDelay={120}
          closeDelay={150}
        >
          <HoverCard.Trigger asChild>
            <button
              type="button"
              aria-disabled="true"
              aria-describedby={hintId}
              onClick={(event) => event.preventDefault()}
              className="inline-flex min-h-11 cursor-help items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-muted hover:bg-muted"
              data-testid={`${testId}-disabled`}
            >
              <Sparkles size={16} aria-hidden="true" />
              {t("lesson.ask_ai.button", "Ask AI")}
            </button>
          </HoverCard.Trigger>
          <HoverCard.Portal forceMount>
            <HoverCard.Content
              forceMount
              hidden={!hintOpen}
              id={hintId}
              sideOffset={6}
              align="start"
              className="z-[1100] max-w-xs rounded-md border border-border bg-[var(--bg-surface)] p-3 text-sm shadow-[var(--shadow-elevated)]"
              data-testid={`${testId}-no-key`}
            >
              <p className="m-0 text-fg-primary">
                {t(
                  "lesson.ask_ai.no_key",
                  "AI questions need your own AI key (BYOK). Optional, the app works fine without it.",
                )}
              </p>
              <Link
                to="/settings?tab=ai"
                className="mt-2 inline-block font-medium text-accent underline hover:opacity-90"
                data-testid={`${testId}-settings-link`}
              >
                {t("lesson.ask_ai.open_settings", "AI settings")}
              </Link>
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard.Root>
      </div>
    );
  }

  async function handleAsk() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { userId } = readLearnerState();
      const resolved = userId ? await resolveActiveAiProvider(userId) : null;
      if (!resolved) {
        setError(
          t(
            "lesson.ask_ai.no_key",
            "AI questions need your own AI key (BYOK). Optional, the app works fine without it.",
          ),
        );
        return;
      }
      const history: ChatMessage[] = turns.flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer },
      ]);
      const messages = buildAskAiMessages(
        { ...context, uiLanguage: lang },
        q,
        history,
      );
      const answer = await aiComplete({
        provider: resolved.provider,
        model: resolved.model,
        apiKey: resolved.apiKey,
        messages,
        maxTokens: 1024,
      });
      setTurns((prev) => [...prev, { question: q, answer }]);
      setQuestion("");
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("lesson.ask_ai.error", "The AI request failed. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted"
        data-testid={`${testId}-open`}
      >
        <Sparkles size={16} aria-hidden="true" />
        {t("lesson.ask_ai.button", "Ask AI")}
      </button>
    );
  }

  return (
    <section
      className="mt-3 rounded-md border border-border bg-[var(--bg-surface)] p-3"
      data-testid={`${testId}-panel`}
    >
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg-primary">
        <Bot size={16} aria-hidden="true" />
        {t("lesson.ask_ai.title", "Ask AI about this")}
      </div>

      {turns.length > 0 && (
        <ul className="mb-2 flex list-none flex-col gap-2 p-0">
          {turns.map((turn, i) => (
            <li key={i} className="flex flex-col gap-1">
              <p className="m-0 text-sm font-medium text-fg-secondary">
                {turn.question}
              </p>
              <p
                className="m-0 whitespace-pre-wrap text-sm text-fg-primary"
                data-testid={`${testId}-answer`}
              >
                {turn.answer}
              </p>
            </li>
          ))}
        </ul>
      )}

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={2}
        placeholder={t(
          "lesson.ask_ai.placeholder",
          "e.g. Explain this with an example",
        )}
        className="w-full resize-y rounded-md border border-border bg-[var(--bg-elevated)] p-2 text-sm text-fg-primary"
        data-testid={`${testId}-input`}
      />

      {error && (
        <p
          className="mt-1 text-sm text-[var(--danger)]"
          role="status"
          aria-live="polite"
          data-testid={`${testId}-error`}
        >
          {error}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleAsk}
          disabled={busy || !question.trim()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-60"
          data-testid={`${testId}-submit`}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={16} aria-hidden="true" />
          )}
          {busy
            ? t("lesson.ask_ai.asking", "Asking…")
            : t("lesson.ask_ai.ask", "Ask")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-fg-muted hover:text-fg-secondary"
          data-testid={`${testId}-close`}
        >
          {t("common.close", "Close")}
        </button>
      </div>
    </section>
  );
}

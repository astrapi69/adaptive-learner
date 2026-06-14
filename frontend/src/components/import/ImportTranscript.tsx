/**
 * Collapsible raw-transcript section for the import-detail page
 * (extracted from ImportDetail for the complexity burn-down #419).
 *
 * Markup, testids, and role labels preserved verbatim.
 */

import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ImportedConversationDetail } from "../../types/domain";

interface ImportTranscriptProps {
  messages: ImportedConversationDetail["messages"];
  messageCount: number;
  open: boolean;
  onToggle: () => void;
  t: (key: string, fallback?: string) => string;
}

/** The "Show raw transcript" toggle + the message list when open. */
export default function ImportTranscript({
  messages,
  messageCount,
  open,
  onToggle,
  t,
}: ImportTranscriptProps) {
  return (
    <section data-testid="conversation-transcript">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5"
        aria-expanded={open}
        aria-controls="conversation-transcript-list"
        onClick={onToggle}
        data-testid="transcript-toggle"
      >
        {open ? (
          <ChevronDown aria-hidden="true" />
        ) : (
          <ChevronRight aria-hidden="true" />
        )}
        {t("import.show_transcript", "Show raw transcript")}
        <span className="text-muted-foreground">({messageCount})</span>
      </Button>
      {open && (
        <ol
          id="conversation-transcript-list"
          className="list-none p-0 mt-3 mb-0 flex flex-col gap-3"
        >
          {messages.map((m) => (
            <li
              key={m.id}
              data-testid={`msg-${m.order_index}`}
              className={cn(
                "border border-border rounded-app px-4 py-3",
                m.role === "user" ? "bg-card" : "bg-background",
              )}
            >
              <div
                className={cn(
                  "font-semibold mb-1",
                  m.role === "user" ? "text-accent" : "text-foreground",
                )}
              >
                {m.role === "user"
                  ? t("import.role_user", "You")
                  : m.role === "assistant"
                    ? t("import.role_assistant", "AI")
                    : t("import.role_system", "System")}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

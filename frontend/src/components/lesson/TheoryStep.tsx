/**
 * One theory step of the lesson viewer (extracted from Lesson.tsx,
 * #404).
 *
 * Renders the theory body as Markdown (same react-markdown pipeline as
 * the help drawer / Learning-Repo), with a per-step read-aloud button
 * driving the shared lesson TTS engine, fenced code via {@link CodeBlock},
 * step-anchor links routed back to the viewer, and an optional external
 * example link (schema v1.4 / #139).
 */

import { useMemo } from "react";
import Markdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { ExternalLink, Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import CodeBlock from "../content/CodeBlock";
import { useI18n } from "../../hooks/useI18n";
import type { ReadAloudController } from "../../hooks/useReadAloud";
import { parseStepAnchor } from "../../lib/lesson-anchors";
import { markdownToSpeech } from "../../lib/lesson/tts-text";

interface TheoryStepProps {
  body: string;
  /** Stable id of this theory step (keys the engine's active read). */
  stepId: string;
  /** TTS feature C2 — lesson target language for read-aloud. */
  ttsLang?: string | null;
  /** TTS feature C5 — the shared lesson read-aloud engine, so the
   *  theory button drives it (manual + auto both emit boundaries)
   *  and the follow-along highlight can track the spoken word. */
  tts: ReadAloudController;
  lessonRewriteFn: (body: string) => string;
  onAnchorClick: (stepId: string) => void;
  /** Schema v1.4 (#139) — optional external example link. */
  exampleUrl?: string | null;
  exampleLabel?: string | null;
}

export default function TheoryStep({
  body,
  stepId,
  ttsLang = null,
  tts,
  lessonRewriteFn,
  onAnchorClick,
  exampleUrl = null,
  exampleLabel = null,
}: TheoryStepProps) {
  const { t } = useI18n();
  const rewritten = useMemo(
    () => lessonRewriteFn(body),
    [body, lessonRewriteFn],
  );
  // Plain-text projection of the body for read-aloud (markdown
  // syntax + code blocks stripped).
  const speechText = useMemo(() => markdownToSpeech(body), [body]);
  const utteranceId = `theory-${stepId}`;
  const isReading = tts.speaking && tts.activeId === utteranceId;
  const canRead = tts.enabled && !!ttsLang && speechText.length > 0;
  const readLabel = isReading
    ? t("lesson.tts.stop", "Stop")
    : t("lesson.tts.read_aloud", "Read aloud");
  return (
    <div
      className="lesson-theory markdown-body"
      data-testid="lesson-theory-body"
    >
      {canRead && (
        <div className="lesson-theory-tts">
          <button
            type="button"
            className={`read-aloud-button${isReading ? " is-speaking" : ""}`}
            data-testid="read-aloud-theory"
            data-speaking={isReading ? "true" : "false"}
            aria-label={readLabel}
            onClick={() =>
              isReading
                ? tts.stop()
                : tts.speak(speechText, {
                    lang: ttsLang ?? undefined,
                    id: utteranceId,
                  })
            }
          >
            <span className="read-aloud-button__icon" aria-hidden="true">
              {isReading ? <Square size={14} /> : <Volume2 size={14} />}
            </span>
            <span className="read-aloud-button__label">{readLabel}</span>
          </button>
        </div>
      )}
      {/* #147 — read-aloud only plays audio; the panel keeps its
                rendered Markdown formatting. It used to swap to a
                plain-text follow-along while speaking, which dropped
                headings / lists / bold / code and visibly reflowed the
                panel. The spoken-word position still drives continuous
                reading via tts.boundaryIndex, just without re-rendering
                the body. */}
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeAutolinkHeadings]}
        components={{
          // Fenced code blocks (```python ...) render via the
          // syntax-highlighted CodeBlock (schema v1.3). Inline
          // `code` stays a plain <code>. ``pre`` is collapsed to
          // its children so CodeBlock's own <pre> isn't nested.
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const match = /language-([\w-]+)/.exec(className ?? "");
            if (match) {
              return (
                <CodeBlock code={String(children ?? "")} language={match[1]} />
              );
            }
            return <code className={className}>{children}</code>;
          },
          a: ({ href, children, ...rest }) => {
            const stepId = href !== undefined ? parseStepAnchor(href) : null;
            if (stepId !== null) {
              return (
                <a
                  {...rest}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    onAnchorClick(stepId);
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a {...rest} href={href}>
                {children}
              </a>
            );
          },
        }}
      >
        {rewritten}
      </Markdown>
      {/* #139 — optional external example link under the theory
                content. Rendered only when the author supplied one
                (rule: a function not available is not offered). */}
      {exampleUrl ? (
        <div className="mt-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5"
          >
            <a
              href={exampleUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="theory-example-link"
            >
              <ExternalLink aria-hidden="true" />
              {exampleLabel?.trim()
                ? exampleLabel
                : t("lesson.theory.view_example", "Beispiel ansehen")}
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

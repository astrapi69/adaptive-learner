/**
 * Conversation-analysis results panel (extracted from ImportDetail for
 * the complexity burn-down #419).
 *
 * Renders the analysis heading, the fallback notice, the summary, and
 * the structured result grid (topic / method / strengths / weaknesses /
 * error patterns / subtopics / suggested curriculum). Returns ``null``
 * when there is no analysis yet. Markup + testids preserved verbatim.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import HelpLink from "../help/HelpLink";
import type { ConversationAnalysisResult } from "../../types/domain";

interface AnalysisResultsSectionProps {
  analysis: ConversationAnalysisResult | null | undefined;
  t: (key: string, fallback?: string) => string;
}

/** The structured analysis results section; null until analyzed. */
export default function AnalysisResultsSection({
  analysis,
  t,
}: AnalysisResultsSectionProps) {
  if (!analysis) return null;

  return (
    <section className="analysis-results-fade-in mb-8" data-testid="analysis-results">
      <h2>
        {t("import.analysis_title", "Analysis")}
        <HelpLink glossaryKey="feature_conversation_analysis" />
      </h2>
      {analysis.fallback_used && (
        <p
          className="bg-[var(--warning-bg)] text-warning px-3 py-2 rounded"
          data-testid="analysis-fallback-notice"
        >
          {t(
            "import.analysis_fallback_long",
            "The AI response was not parseable as structured JSON. The summary below is a fallback.",
          )}
        </p>
      )}
      {analysis.summary && (
        <p data-testid="analysis-summary" className="italic text-fg-secondary">
          {analysis.summary}
        </p>
      )}
      <AnalysisGrid result={analysis} t={t} />
    </section>
  );
}

function AnalysisGrid({
  result,
  t,
}: {
  result: ConversationAnalysisResult;
  t: (k: string, fb?: string) => string;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3 mt-4">
      {result.topic && (
        <Card title={t("import.field_topic", "Topic")} tone="default">
          {result.topic}
          {result.user_level && (
            <span className="ml-2 px-2 py-0.5 rounded-sm bg-accent text-accent-foreground text-xs uppercase">
              {result.user_level}
            </span>
          )}
        </Card>
      )}
      {result.recommended_method && (
        <Card title={t("import.field_method", "Recommended method")} tone="default">
          {result.recommended_method}
          {result.recommended_focus && (
            <p className="mt-1 mb-0 text-sm text-fg-muted">{result.recommended_focus}</p>
          )}
        </Card>
      )}
      {result.strengths && result.strengths.length > 0 && (
        <Card title={t("import.field_strengths", "Strengths")} tone="ok">
          <ul className="m-0 pl-5">
            {result.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
      {result.weaknesses && result.weaknesses.length > 0 && (
        <Card title={t("import.field_weaknesses", "Weaknesses")} tone="bad">
          <ul className="m-0 pl-5">
            {result.weaknesses.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
      {result.error_patterns && result.error_patterns.length > 0 && (
        <Card title={t("import.field_errors", "Error patterns")} tone="warn">
          <ul className="m-0 pl-5">
            {result.error_patterns.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
      {result.subtopics && result.subtopics.length > 0 && (
        <Card title={t("import.field_subtopics", "Subtopics")} tone="default">
          {result.subtopics.join(" · ")}
        </Card>
      )}
      {result.suggested_curriculum && result.suggested_curriculum.length > 0 && (
        <Card title={t("import.field_curriculum", "Suggested curriculum")} tone="default" wide>
          <ol className="m-0 pl-5">
            {result.suggested_curriculum.map((l, i) => (
              <li key={i} data-testid={`lesson-${i}`} className="mb-2">
                <strong>{l.title}</strong>{" "}
                <small className="text-fg-muted">
                  ({t("import.priority", "priority")} {l.priority})
                </small>
                {l.description && <p className="mt-0.5 mb-0 text-fg-muted">{l.description}</p>}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function Card({
  title,
  tone,
  wide,
  children,
}: {
  title: string;
  tone: "ok" | "bad" | "warn" | "default";
  wide?: boolean;
  children: ReactNode;
}) {
  const toneBorder: Record<typeof tone, string> = {
    ok: "border-success",
    bad: "border-destructive",
    warn: "border-warning",
    default: "border-border",
  };
  return (
    <div
      className={cn(
        "border rounded-app px-4 py-3 bg-card",
        toneBorder[tone],
        wide && "col-span-full",
      )}
    >
      <h3 className="mt-0 mb-2 text-base">{title}</h3>
      {children}
    </div>
  );
}

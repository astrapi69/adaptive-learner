/**
 * Inline worked examples for a theory step or an exercise (schema v1.5,
 * #1326).
 *
 * Shared by {@link TheoryStep} (examples under the theory body) and the
 * exercise flow (examples shown before the answer controls). Each example
 * is a plain-text sample or, when ``language`` is set, a syntax-highlighted
 * code snippet rendered via the existing {@link CodeBlock} (Library-First:
 * no second highlighter). Presentational — takes its data via props, holds
 * no lesson state.
 */

import CodeBlock from "../../content/browser/CodeBlock";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentLessonExample } from "../../../storage/types";

interface StepExamplesProps {
  examples: ContentLessonExample[];
  /** Distinguishes the render context for the test id ("theory" | "exercise"). */
  context: "theory" | "exercise";
}

/** Renders a lesson step's inline examples as a set of clearly-marked blocks. */
export default function StepExamples({ examples, context }: StepExamplesProps) {
  const { t } = useI18n();
  if (!examples.length) return null;
  return (
    <div
      className="mt-4 flex flex-col gap-3"
      data-testid={`step-examples-${context}`}
    >
      {examples.map((example, index) => (
        <figure
          key={index}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
          data-testid="step-example"
        >
          <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-secondary)]">
            {t("lesson.example.label", "Example")}
            {example.title ? `: ${example.title}` : ""}
          </figcaption>
          {example.language ? (
            <CodeBlock code={example.content} language={example.language} />
          ) : (
            <p className="whitespace-pre-wrap text-[var(--fg-primary)]">
              {example.content}
            </p>
          )}
        </figure>
      ))}
    </div>
  );
}

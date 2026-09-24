/**
 * The content of one theory step, without any lesson chrome (#3224).
 *
 * The Markdown body (same react-markdown pipeline as the help drawer /
 * Learning-Repo), fenced code via {@link CodeBlock}, wide tables in a
 * horizontal-scroll wrapper (#632), the optional inline worked examples
 * (#1326) and the optional external example link (#139). Everything a
 * step's author wrote, nothing a particular page adds around it.
 *
 * Two renderers compose it: ``TheoryStep`` (the lesson, which adds the
 * read-aloud button in ``leading`` and the Ask-AI panel in ``trailing``,
 * and resolves ``theory.md#step`` anchors against its own lesson) and the
 * runner shell's ``RunnerStep`` (a borrowed theory step of a run, no
 * extras, no anchor navigation: the run has no lesson to jump inside).
 *
 * @example
 * <TheoryBody
 *   testId="adaptive-lesson-theory-body"
 *   body={step.body ?? ""}
 *   exampleUrl={step.example_url}
 *   exampleLabel={step.example_label}
 *   examples={step.examples}
 * />
 */

import { useMemo, type ReactNode } from "react";
import Markdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

import CodeBlock from "../../content/browser/CodeBlock";
import StepExamples from "./StepExamples";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentLessonExample } from "../../../storage/types";
import { parseStepAnchor } from "../../../lib/lesson/lesson-anchors";

export interface TheoryBodyProps {
  /** The Markdown body the author wrote. */
  body: string;
  /** The body container's testid (``lesson-theory-body`` in the lesson). */
  testId: string;
  /** Rewrites the body before rendering (the lesson's anchor resolver). */
  rewrite?: (body: string) => string;
  /** Navigates to an in-lesson step anchor; without it anchors stay plain links. */
  onAnchorClick?: (stepId: string) => void;
  /** Schema v1.4 (#139): optional external example link. */
  exampleUrl?: string | null;
  exampleLabel?: string | null;
  /** Schema v1.5 (#1326): optional inline worked examples under the body. */
  examples?: ContentLessonExample[] | null;
  /** Rendered first inside the container (the lesson's read-aloud button). */
  leading?: ReactNode;
  /** Rendered last inside the container (the lesson's Ask-AI panel). */
  trailing?: ReactNode;
}

type MarkdownComponents = NonNullable<Parameters<typeof Markdown>[0]["components"]>;

/** The react-markdown element overrides: code blocks, table wrapper, step anchors. */
function markdownComponents(onAnchorClick?: (stepId: string) => void): MarkdownComponents {
  return {
    // Fenced code blocks (```python ...) render via the syntax-highlighted
    // CodeBlock (schema v1.3). Inline `code` stays a plain <code>. ``pre``
    // is collapsed to its children so CodeBlock's own <pre> isn't nested.
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
      const match = /language-([\w-]+)/.exec(className ?? "");
      if (match) {
        return <CodeBlock code={String(children ?? "")} language={match[1]} />;
      }
      return <code className={className}>{children}</code>;
    },
    // #632 - wrap markdown tables in a horizontal-scroll container so a
    // wide comparison table scrolls instead of overflowing at narrow
    // viewports. Styling lives in `.lesson-theory table`.
    table: ({ node: _node, ...tableProps }) => (
      <div className="lesson-theory-table-wrapper">
        <table {...tableProps} />
      </div>
    ),
    a: ({ href, children, ...rest }) => {
      const stepId = href === undefined ? null : parseStepAnchor(href);
      if (stepId !== null && onAnchorClick !== undefined) {
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
  };
}

/** The #139 external example link, rendered only when the author supplied one. */
function TheoryExampleLink({ url, label }: { url: string; label: string | null }) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      <Button asChild variant="outline" size="sm" className="min-h-11 gap-1.5">
        <a href={url} target="_blank" rel="noopener noreferrer" data-testid="theory-example-link">
          <ExternalLink aria-hidden="true" />
          {label?.trim() ? label : t("lesson.theory.view_example", "Beispiel ansehen")}
        </a>
      </Button>
    </div>
  );
}

/** One theory step's authored content inside the ``.lesson-theory`` container. */
export default function TheoryBody({
  body,
  testId,
  rewrite,
  onAnchorClick,
  exampleUrl = null,
  exampleLabel = null,
  examples = null,
  leading,
  trailing,
}: TheoryBodyProps) {
  const rendered = useMemo(() => (rewrite ? rewrite(body) : body), [body, rewrite]);
  return (
    <div className="lesson-theory markdown-body" data-testid={testId}>
      {leading}
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeAutolinkHeadings]}
        components={markdownComponents(onAnchorClick)}
      >
        {rendered}
      </Markdown>
      {examples && examples.length > 0 ? (
        <StepExamples examples={examples} context="theory" />
      ) : null}
      {exampleUrl ? <TheoryExampleLink url={exampleUrl} label={exampleLabel} /> : null}
      {trailing}
    </div>
  );
}

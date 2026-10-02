/**
 * BlockMarkdown - render a multi-line, author-provided text (a reading
 * passage, a code excerpt) as BLOCK Markdown.
 *
 * The counterpart to ``InlineMarkdown``: that one flattens everything to a
 * single inline run for one-line prompts, which destroys a passage - a fenced
 * code block loses its ``<pre>`` and collapses onto one line, paragraphs run
 * together (#3217). Here:
 *
 * - Fenced / indented code renders as ``<pre><code>`` with lines and
 *   indentation intact, horizontally scrollable instead of wrapping.
 * - Paragraphs stay separate, and a single author line break inside a
 *   paragraph stays visible (``white-space: pre-line``), so an unfenced
 *   multi-line snippet or a verse is not joined into one line either.
 * - GFM (tables, strikethrough) via ``remark-gfm``, same as the theory body.
 * - Raw HTML is NOT rendered (no ``rehype-raw``): ``react-markdown`` escapes
 *   it, so the output is XSS-safe by construction.
 *
 * Props-driven + app-agnostic (no app imports); colors come from tokens.
 *
 * @example
 * <div className="passage">
 *   <BlockMarkdown>{payload.passage}</BlockMarkdown>
 * </div>
 */

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface BlockMarkdownProps {
  /** The author text to render as block Markdown. */
  children: string;
}

export default function BlockMarkdown({ children }: BlockMarkdownProps) {
  return (
    <div className="flex flex-col gap-2">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node: _node, ...rest }) => (
            <p {...rest} className="m-0 whitespace-pre-line" />
          ),
          pre: ({ node: _node, ...rest }) => (
            <pre
              {...rest}
              className="m-0 overflow-x-auto whitespace-pre rounded-sm bg-[var(--bg-elevated)] p-3 font-mono text-sm leading-relaxed"
            />
          ),
          ul: ({ node: _node, ...rest }) => (
            <ul {...rest} className="m-0 list-disc pl-5" />
          ),
          ol: ({ node: _node, ...rest }) => (
            <ol {...rest} className="m-0 list-decimal pl-5" />
          ),
          a: ({ node: _node, href, children: inner, ...rest }) => (
            <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}

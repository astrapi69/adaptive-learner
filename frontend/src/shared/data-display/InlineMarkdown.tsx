/**
 * InlineMarkdown — render a short, author-provided string as INLINE-only
 * Markdown (bold / italic / inline code / links / line breaks).
 *
 * Exercise prompts, card labels, and cloze sentences are authored as plain
 * strings that may carry light Markdown (e.g. ``**día**`` for emphasis). They
 * must render formatted, not as literal asterisks — but they must NOT pull in
 * block-level layout (headings, lists, tables, blockquotes) which would break
 * a one-line prompt. This component renders through the same ``react-markdown``
 * pipeline the theory body uses, restricted to inline elements:
 *
 * - Block elements (``h1``–``h6``, ``ul``/``ol``/``li``, ``table``,
 *   ``blockquote``, …) are unwrapped to their text content, so a stray ``#``
 *   never produces a heading.
 * - The paragraph wrapper ``react-markdown`` adds is collapsed to a fragment,
 *   so the output stays inline inside the caller's element.
 * - Raw HTML is NOT rendered (no ``rehype-raw``): ``react-markdown`` escapes
 *   it, so ``<script>`` in a prompt shows as text — XSS-safe by construction.
 *
 * Always-render (no markdown-present pre-check): a string without Markdown
 * syntax passes through unchanged, so there is no edge case to get wrong. The
 * cost is negligible for the short strings this renders.
 *
 * Props-driven + app-agnostic (no app imports), so it is reusable anywhere a
 * short author string needs inline formatting.
 *
 * @example
 * <p className="prompt">
 *   <InlineMarkdown>{exercise.prompt ?? ""}</InlineMarkdown>
 * </p>
 */

import Markdown from "react-markdown";

/** Inline elements kept in the output; everything else is unwrapped to text. */
const INLINE_ELEMENTS = ["p", "a", "strong", "em", "code", "br"];

export interface InlineMarkdownProps {
  /** The author string to render as inline Markdown. */
  children: string;
}

export default function InlineMarkdown({ children }: InlineMarkdownProps) {
  return (
    <Markdown
      allowedElements={INLINE_ELEMENTS}
      unwrapDisallowed
      components={{
        // Collapse the auto-added paragraph wrapper so the content stays
        // inline inside the caller's element (a <p>/<span>/sentence segment).
        p: ({ children: inner }) => <>{inner}</>,
        // Links open safely in a new tab; relative/anchor targets are fine too.
        a: ({ href, children: inner, ...rest }) => (
          <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        ),
      }}
    >
      {children}
    </Markdown>
  );
}

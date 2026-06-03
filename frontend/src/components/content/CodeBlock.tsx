/**
 * Syntax-highlighted code block for technical content (schema v1.3).
 *
 * Used by the lesson viewer's theory markdown (fenced ``` blocks) and
 * by code cards (``card.code_snippet`` + ``expected_output``).
 *
 * A curated highlight.js (core + ~11 grammars, see ``lib/content/hljs``)
 * is loaded LAZILY via dynamic import the first time a code block mounts,
 * so the highlighter never weighs down lessons that have no code. Until
 * it resolves (and if it fails), the code shows as plain escaped text —
 * never blank.
 */

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "../../hooks/useI18n";

interface CodeBlockProps {
  code: string;
  language?: string | null;
  /** Optional expected output, shown in a separate "Output:" block. */
  output?: string | null;
}

export default function CodeBlock({ code, language, output }: CodeBlockProps) {
  const { t } = useI18n();
  const trimmed = code.replace(/\n+$/, "");
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hljs = (await import("../../lib/content/hljs")).default;
        const lang =
          language && hljs.getLanguage(language) ? language : null;
        // highlight.js HTML-escapes the input and only adds its own
        // <span> token markup, so the result is safe to inject.
        const result = lang
          ? hljs.highlight(trimmed, { language: lang })
          : hljs.highlightAuto(trimmed);
        if (!cancelled) setHtml(result.value);
      } catch {
        if (!cancelled) setHtml(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmed, language]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (insecure context / permissions) */
    }
  }

  const codeClass = language ? `hljs language-${language}` : "hljs";

  return (
    <div className="code-block" data-testid="code-block">
      <div className="code-block-head">
        {language && (
          <span className="code-block-lang" data-testid="code-block-lang">
            {language}
          </span>
        )}
        <button
          type="button"
          className="code-block-copy"
          onClick={copy}
          data-testid="code-block-copy"
          aria-label={t("content.tree.code_copy", "Copy code")}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      {/* overflow-x: auto on .code-block-pre keeps long lines scrollable
          on mobile instead of breaking the layout. */}
      {html !== null ? (
        <pre className="code-block-pre">
          <code
            className={codeClass}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
      ) : (
        <pre className="code-block-pre">
          <code className={codeClass}>{trimmed}</code>
        </pre>
      )}
      {output != null && output.trim() !== "" && (
        <div className="code-block-output" data-testid="code-block-output">
          <span className="code-block-output-label">
            {t("content.tree.code_output", "Output:")}
          </span>
          <pre>{output}</pre>
        </div>
      )}
    </div>
  );
}

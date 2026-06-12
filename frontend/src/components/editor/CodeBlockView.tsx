/**
 * CodeBlockView (Phase 27D / v1.14.0).
 *
 * React NodeView for the lowlight-backed code block. Wraps the
 * ``<pre><code>`` rendered by ProseMirror with:
 *
 *   - A native ``<select>`` language picker (the
 *     ``@radix-ui/react-select`` portal pattern is brittle
 *     under happy-dom per the project's lessons-learned rule,
 *     so we use the native element which fireEvent.change
 *     resolves cleanly).
 *   - A copy-to-clipboard button that copies the code block's
 *     plain text (NOT the highlighted HTML).
 *
 * The language selector writes back to the node's ``language``
 * attribute via ``updateAttributes``; ``CodeBlockLowlight``
 * re-runs lowlight against the new grammar on the next render.
 *
 * The supported language list is the Phase-27D MVP set:
 * python, javascript, typescript, java, html, css, sql, bash,
 * json, yaml, markdown. Plus a sentinel "Plain text" option
 * that clears the language attribute (lowlight runs no
 * grammar; the block renders monospaced but unhighlighted).
 */

import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState } from "react";

import { useI18n } from "../../hooks/useI18n";

/** Visible options in the language picker. Keep in sync with
 *  the lowlight registration in ``code-block-config.ts``. */
const LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Plain text" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
];

export default function CodeBlockView(props: NodeViewProps) {
  const { t } = useI18n();
  const { node, updateAttributes, editor } = props;
  const language = (node.attrs.language as string | null | undefined) ?? "";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = node.textContent;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write failed (permission denied / no
      // navigator.clipboard) — swallow silently; the user
      // can still select + Ctrl+C the visible text.
      setCopied(false);
    }
  };

  return (
    <NodeViewWrapper as="div" className="code-block-view" data-testid="code-block-view">
      <div
        className="code-block-view-toolbar"
        contentEditable={false}
        data-testid="code-block-toolbar"
      >
        <select
          value={language}
          onChange={(e) =>
            updateAttributes({
              language: e.target.value === "" ? null : e.target.value,
            })
          }
          disabled={!editor.isEditable}
          aria-label={t("editor.code_block_language", "Code block language")}
          data-testid="code-block-language"
          className="code-block-view-language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value || "_plain"} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleCopy()}
          data-testid="code-block-copy"
          className="code-block-view-copy"
          title={t("editor.code_block_copy", "Copy code")}
        >
          {copied ? t("editor.code_block_copied", "Copied") : t("editor.code_block_copy", "Copy")}
        </button>
      </div>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

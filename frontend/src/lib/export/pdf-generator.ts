/**
 * Browser-side PDF generation (Phase 16C).
 *
 * Pipeline:
 *
 *   1. Markdown (from ``markdown-renderer``) →
 *   2. HTML (from ``markdown-to-html``) →
 *   3. wrap in a print-optimised HTML document →
 *   4. open in a hidden iframe →
 *   5. call ``iframe.contentWindow.print()``.
 *
 * The user picks "Save as PDF" in the browser's print dialog —
 * no PDF library shipped with the bundle. Zero server-side
 * dependency.
 *
 * The iframe stays attached to the document until the print
 * dialog closes; otherwise some browsers cancel the print job
 * when the iframe is torn down mid-dialog.
 */

import {markdownToHtml} from "./markdown-to-html";

const PRINT_CSS = `
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #1f2937;
  margin: 24mm 20mm;
  background: #ffffff;
}
h1 {
  color: #4338ca;
  border-bottom: 2px solid #6366f1;
  padding-bottom: 0.3em;
  margin-top: 0;
  font-size: 22pt;
}
h2 {
  color: #4f46e5;
  margin-top: 1.4em;
  font-size: 16pt;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.2em;
}
h3 {
  color: #1f2937;
  margin-top: 1.2em;
  font-size: 13pt;
}
h4 { font-size: 12pt; margin-top: 1em; }
p { margin: 0.4em 0; }
ul { margin: 0.4em 0; padding-left: 1.4em; }
li { margin: 0.15em 0; }
blockquote {
  border-left: 3px solid #6366f1;
  padding: 0.4em 0.9em;
  margin: 0.6em 0;
  background: #f5f7ff;
  color: #1f2937;
  border-radius: 0 4px 4px 0;
}
code {
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  background: #f3f4f6;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-size: 0.9em;
}
pre {
  background: #f3f4f6;
  padding: 0.8em;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.85em;
  page-break-inside: avoid;
}
pre code { background: transparent; padding: 0; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.6em 0;
  font-size: 0.92em;
  page-break-inside: avoid;
}
th, td {
  border: 1px solid #d1d5db;
  padding: 0.35em 0.6em;
  text-align: left;
  vertical-align: top;
}
th { background: #eef2ff; color: #4338ca; font-weight: 600; }
tr:nth-child(even) td { background: #fafafa; }
hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.4em 0;
}
strong { color: #1f2937; font-weight: 600; }
em { color: #4b5563; }
@page { margin: 18mm; }
@media print {
  body { margin: 0 14mm; }
  h1, h2, h3 { page-break-after: avoid; }
  table, pre, blockquote { page-break-inside: avoid; }
}
`;

function escapeForTitle(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Wrap an HTML fragment in a full document with print CSS. The
 * title is read by the browser when the user saves to PDF.
 */
export function buildPrintHtml(htmlBody: string, title: string): string {
    return [
        "<!DOCTYPE html>",
        `<html lang="en">`,
        "<head>",
        `<meta charset="utf-8">`,
        `<title>${escapeForTitle(title)}</title>`,
        `<style>${PRINT_CSS}</style>`,
        "</head>",
        "<body>",
        htmlBody,
        "</body>",
        "</html>",
    ].join("\n");
}

/**
 * Convert a Markdown export string into a print-ready HTML
 * document. Exposed for tests + iframe injection.
 */
export function markdownToPrintHtml(markdown: string, title: string): string {
    return buildPrintHtml(markdownToHtml(markdown), title);
}

/**
 * Render the export in a hidden iframe and invoke the browser's
 * print dialog. The user picks "Save as PDF" to get a PDF file.
 *
 * Resolves once the print dialog has been triggered. The iframe
 * is removed shortly afterwards; some browsers (Firefox, Safari)
 * cancel the print job if the iframe disappears DURING the
 * dialog, so we leave it for two seconds — enough for the
 * dialog to capture the document.
 */
export async function openPrintWindow(
    markdown: string,
    title: string,
): Promise<void> {
    const html = markdownToPrintHtml(markdown, title);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = title;
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
        document.body.removeChild(iframe);
        throw new Error("Could not open print window");
    }
    doc.open();
    doc.write(html);
    doc.close();
    // Wait one tick so the document parses + applies styles before
    // print() snapshots it.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    win.focus();
    win.print();
    // Leave the iframe attached long enough for the print dialog
    // to render the document, then clean up.
    setTimeout(() => {
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    }, 2000);
}

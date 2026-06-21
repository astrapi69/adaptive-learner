/**
 * EXP-033 / AIV-04 — render an AI content-check report as Markdown for
 * pasting into a GitHub issue / PR comment in the content repo.
 *
 * Pure: the caller supplies the set name, a composed summary line, the
 * issue rows, and the column headers (i18n stays at the call site). One
 * table row per issue, with cells escaped so a ``|`` in a card value
 * doesn't break the table.
 */

export interface ValidationMarkdownRow {
  lessonTitle: string;
  cardLabel: string;
  field: string;
  problem: string;
  suggestion: string;
}

export interface ValidationMarkdownHeaders {
  lesson: string;
  card: string;
  field: string;
  problem: string;
  suggestion: string;
}

/** Escape a table cell: collapse newlines and escape pipes. */
function cell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

/**
 * Build the Markdown report. With no rows, emits the heading + summary +
 * an "all passed" note instead of an empty table.
 */
export function buildValidationMarkdown(args: {
  setName: string;
  summaryLine: string;
  rows: readonly ValidationMarkdownRow[];
  headers: ValidationMarkdownHeaders;
  /** Shown in place of the table when there are no issues. */
  allOkLine: string;
  /** Optional provenance lines under the heading, e.g.
   *  "Checked with: Anthropic Claude (claude-…)" + "Date: 2026-…". */
  metaLines?: readonly string[];
}): string {
  const lines: string[] = [];
  lines.push(`# AI content check: ${args.setName}`);
  lines.push("");
  for (const meta of args.metaLines ?? []) {
    if (meta) lines.push(meta);
  }
  if (args.metaLines && args.metaLines.some((m) => m)) lines.push("");
  lines.push(args.summaryLine);
  lines.push("");
  if (args.rows.length === 0) {
    lines.push(args.allOkLine);
    return lines.join("\n");
  }
  const h = args.headers;
  lines.push(`| ${h.lesson} | ${h.card} | ${h.field} | ${h.problem} | ${h.suggestion} |`);
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of args.rows) {
    lines.push(
      `| ${cell(row.lessonTitle)} | ${cell(row.cardLabel)} | ${cell(row.field)} | ` +
        `${cell(row.problem)} | ${cell(row.suggestion)} |`,
    );
  }
  return lines.join("\n");
}

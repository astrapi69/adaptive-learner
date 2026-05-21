/**
 * Markdown renderer for backup diffs (v1.12.0 / Phase 25E).
 *
 * Sub-phase 25B introduces this module as a stub so the compare
 * UI's "Export as Markdown" button compiles; 25E fills it in
 * with the full report format. The stub keeps the contract
 * tight: same exported name, same signature, so 25E is a pure
 * implementation swap.
 */

import type {BackupDiff} from "./backup-diff";

export interface RenderMarkdownOptions {
    labelA: string;
    labelB: string;
}

export function renderDiffMarkdown(
    _diff: BackupDiff,
    _opts: RenderMarkdownOptions,
): string {
    // Placeholder body. Replaced in 25E with the full report
    // shape (summary header, per-table sections, omitted
    // zero-delta rows, field-level diffs, version footer).
    return "# Backup Comparison Report\n\n(stub — populated in v1.12.0 / Phase 25E)\n";
}

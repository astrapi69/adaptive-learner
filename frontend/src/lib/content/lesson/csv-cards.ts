/**
 * CSV / paste card parser for the Lesson Creator (Phase 65B).
 *
 * Accepts comma-separated OR tab-separated text (paste-friendly):
 * columns are ``front, back, notes`` (notes optional). Each line
 * becomes one parsed row with a ``valid`` flag (front + back both
 * non-empty); the caller previews rows and lets the user fix or skip
 * the invalid ones.
 *
 * Deliberately simple — one row per line, delimiter auto-detected
 * per line (tab wins when present, else comma). Surrounding double
 * quotes on a field are stripped so spreadsheet exports paste
 * cleanly; embedded-delimiter quoting is out of scope (vocab cards
 * rarely need it).
 */

export interface ParsedCsvRow {
    front: string;
    back: string;
    notes: string;
    valid: boolean;
}

function stripQuotes(field: string): string {
    const trimmed = field.trim();
    if (
        trimmed.length >= 2 &&
        trimmed.startsWith('"') &&
        trimmed.endsWith('"')
    ) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

/** Heuristic: skip an obvious header line (``front,back`` /
 *  ``front\tback``) so pasting a spreadsheet with headers works. */
function isHeaderRow(front: string, back: string): boolean {
    return (
        front.toLowerCase() === "front" &&
        (back.toLowerCase() === "back" || back.toLowerCase() === "")
    );
}

/**
 * Parse pasted comma- or tab-separated text into card rows
 * (``front, back, notes``). The delimiter is auto-detected per line
 * (tab wins when present, else comma), an obvious header row is
 * skipped, surrounding quotes are stripped, and blank lines are
 * ignored. Each row carries a ``valid`` flag (front + back both
 * non-empty) so the caller can preview and fix invalid rows.
 *
 * @param text - The raw pasted / file text.
 * @returns One {@link ParsedCsvRow} per non-empty, non-header line.
 */
export function parseCsvCards(text: string): ParsedCsvRow[] {
    const rows: ParsedCsvRow[] = [];
    const lines = text.split(/\r?\n/);
    let first = true;
    for (const line of lines) {
        if (line.trim() === "") continue;
        const delimiter = line.includes("\t") ? "\t" : ",";
        const fields = line.split(delimiter).map(stripQuotes);
        const front = fields[0] ?? "";
        const back = fields[1] ?? "";
        const notes = fields.slice(2).join(", ").trim();
        if (first) {
            first = false;
            if (isHeaderRow(front, back)) continue;
        }
        rows.push({
            front,
            back,
            notes,
            valid: front.length > 0 && back.length > 0,
        });
    }
    return rows;
}

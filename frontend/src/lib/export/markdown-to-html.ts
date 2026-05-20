/**
 * Lightweight Markdown → HTML converter for export PDFs (Phase
 * 16C). Handles only the subset the renderers in
 * ``markdown-renderer.ts`` emit:
 *
 *   - ATX headings (``#`` … ``######``)
 *   - paragraphs
 *   - unordered lists (``-`` with 2-space indent for nesting)
 *   - blockquotes (``>``)
 *   - fenced code blocks (```` ``` ````)
 *   - GFM-style tables
 *   - inline ``**bold**``, ``_italic_``, ````code````
 *   - horizontal rules (``---``)
 *
 * Anything outside this subset is rendered verbatim with HTML-
 * escaping; the renderer never emits images / links / footnotes,
 * so we don't pay the parser-complexity tax to support them.
 */

/** Escape the four HTML-significant chars. */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Inline markup: ``**bold**``, ``_italic_``, ````code```` and the
 * pipe-escape ``\|`` used inside table cells. Applied after HTML-
 * escaping so the user's literal text can't inject tags. */
function applyInline(s: string): string {
    let out = escapeHtml(s);
    // Inline code first so the ** / _ inside backticks doesn't trip.
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])_([^_]+)_/g, "$1<em>$2</em>");
    // \| → | (we escape pipes in table cells)
    out = out.replace(/\\\|/g, "|");
    return out;
}

interface ParsedTable {
    headers: string[];
    rows: string[][];
}

function parseTable(lines: string[], start: number): {table: ParsedTable; consumed: number} | null {
    if (start + 1 >= lines.length) return null;
    const header = lines[start];
    const separator = lines[start + 1];
    if (!/^\s*\|.*\|\s*$/.test(header)) return null;
    if (!/^\s*\|[-:|\s]+\|\s*$/.test(separator)) return null;
    const headers = splitRow(header);
    const rows: string[][] = [];
    let i = start + 2;
    while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
    }
    return {table: {headers, rows}, consumed: i - start};
}

function splitRow(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    // Respect \| as a literal pipe inside cells (escaped).
    const cells: string[] = [];
    let buf = "";
    for (let i = 0; i < trimmed.length; i += 1) {
        if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
            buf += "\\|";
            i += 1;
            continue;
        }
        if (trimmed[i] === "|") {
            cells.push(buf.trim());
            buf = "";
            continue;
        }
        buf += trimmed[i];
    }
    cells.push(buf.trim());
    return cells;
}

function renderTable(table: ParsedTable): string {
    const headRow = table.headers
        .map((h) => `<th>${applyInline(h)}</th>`)
        .join("");
    const bodyRows = table.rows
        .map(
            (row) =>
                "<tr>" +
                row.map((c) => `<td>${applyInline(c)}</td>`).join("") +
                "</tr>",
        )
        .join("");
    return `<table><thead><tr>${headRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

interface ListEntry {
    indent: number;
    content: string;
}

function parseList(lines: string[], start: number): {html: string; consumed: number} | null {
    if (!/^(\s*)- /.test(lines[start])) return null;
    const entries: ListEntry[] = [];
    let i = start;
    while (i < lines.length) {
        const m = /^(\s*)- (.*)$/.exec(lines[i]);
        if (!m) break;
        entries.push({indent: m[1].length, content: m[2]});
        i += 1;
    }
    return {html: renderList(entries), consumed: i - start};
}

function renderList(entries: ListEntry[]): string {
    const root = {indent: -2, content: "", children: [] as ListNode[]} as ListNode;
    const stack: ListNode[] = [root];
    for (const entry of entries) {
        while (stack.length > 1 && stack[stack.length - 1].indent >= entry.indent) {
            stack.pop();
        }
        const node: ListNode = {indent: entry.indent, content: entry.content, children: []};
        stack[stack.length - 1].children.push(node);
        stack.push(node);
    }
    return renderListNode(root, true);
}

interface ListNode {
    indent: number;
    content: string;
    children: ListNode[];
}

function renderListNode(node: ListNode, root: boolean): string {
    if (root) {
        const items = node.children.map((c) => renderListItem(c)).join("");
        return `<ul>${items}</ul>`;
    }
    const childrenHtml =
        node.children.length === 0
            ? ""
            : `<ul>${node.children.map((c) => renderListItem(c)).join("")}</ul>`;
    return childrenHtml;
}

function renderListItem(node: ListNode): string {
    const nested = renderListNode(node, false);
    return `<li>${applyInline(node.content)}${nested}</li>`;
}

/**
 * Convert a Markdown string (as produced by the export
 * Markdown renderer) into an HTML fragment.
 */
export function markdownToHtml(md: string): string {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const out: string[] = [];
    let i = 0;
    let paragraphBuffer: string[] = [];

    const flushParagraph = (): void => {
        if (paragraphBuffer.length === 0) return;
        // Trailing two-space "  " indicates a hard break, but the
        // renderer doesn't emit those; treat plain newlines as soft
        // breaks via <br>.
        const joined = paragraphBuffer
            .map((line) => applyInline(line.replace(/\s+$/, "")))
            .join("<br>");
        out.push(`<p>${joined}</p>`);
        paragraphBuffer = [];
    };

    while (i < lines.length) {
        const line = lines[i];

        // Blank line ends a paragraph.
        if (line.trim() === "") {
            flushParagraph();
            i += 1;
            continue;
        }

        // Heading
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            flushParagraph();
            const level = heading[1].length;
            out.push(`<h${level}>${applyInline(heading[2])}</h${level}>`);
            i += 1;
            continue;
        }

        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
            flushParagraph();
            out.push("<hr>");
            i += 1;
            continue;
        }

        // Fenced code block
        if (/^```/.test(line)) {
            flushParagraph();
            const lang = line.replace(/^```/, "").trim();
            const body: string[] = [];
            i += 1;
            while (i < lines.length && !/^```/.test(lines[i])) {
                body.push(lines[i]);
                i += 1;
            }
            // Consume the closing fence.
            if (i < lines.length) i += 1;
            const safe = body.map((l) => escapeHtml(l)).join("\n");
            const cls = lang ? ` class="lang-${escapeHtml(lang)}"` : "";
            out.push(`<pre><code${cls}>${safe}</code></pre>`);
            continue;
        }

        // Blockquote
        if (/^>\s?/.test(line)) {
            flushParagraph();
            const quoted: string[] = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                quoted.push(lines[i].replace(/^>\s?/, ""));
                i += 1;
            }
            const inner = quoted.map((q) => applyInline(q)).join("<br>");
            out.push(`<blockquote>${inner}</blockquote>`);
            continue;
        }

        // Table
        const tableResult = parseTable(lines, i);
        if (tableResult) {
            flushParagraph();
            out.push(renderTable(tableResult.table));
            i += tableResult.consumed;
            continue;
        }

        // List
        const listResult = parseList(lines, i);
        if (listResult) {
            flushParagraph();
            out.push(listResult.html);
            i += listResult.consumed;
            continue;
        }

        // Default: paragraph buffer
        paragraphBuffer.push(line);
        i += 1;
    }
    flushParagraph();
    return out.join("\n");
}

/**
 * TipTap-to-Markdown converter (Phase 27E / v1.14.0).
 *
 * Used by the Markdown / PDF exporters when a content field
 * may carry either:
 *
 *   - Legacy plain text (rows written before Phase 27).
 *   - Serialised TipTap JSON (rows written on v1.14.0 and
 *     later).
 *
 * ``renderStoredContent`` is the only public entry point.
 * It JSON.parses the input; on success it walks the tree and
 * emits Markdown, on failure it returns the input verbatim
 * (legacy plain text is already user-readable).
 *
 * The walker is intentionally pragmatic, not exhaustive:
 *
 *   - Node coverage: doc / paragraph / heading / text /
 *     bulletList / orderedList / listItem / taskList /
 *     taskItem / codeBlock / blockquote / hardBreak /
 *     horizontalRule / image / table+row+cell+header.
 *   - Mark coverage: bold / italic / strike / code / link /
 *     underline (HTML pass-through) / highlight (GFM ``==``
 *     when present, HTML mark otherwise) / subscript /
 *     superscript.
 *   - Color + textStyle marks are dropped (no native Markdown).
 *
 * Unknown node / mark types are skipped without emitting
 * placeholder content so a future TipTap upgrade that lands
 * a new node type cannot pollute the exported file.
 */

import type {JSONContent} from "@tiptap/core";

/** Convert a stored content string to Markdown. ``null`` /
 *  empty / whitespace-only inputs return empty string. */
export function renderStoredContent(
    stored: string | null | undefined,
): string {
    if (stored == null) return "";
    const trimmed = stored.trim();
    if (trimmed.length === 0) return "";
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        // Legacy plain text — return verbatim (it may already
        // contain Markdown the user typed manually).
        return stored;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return stored;
    }
    if (!isTipTapDoc(parsed)) return stored;
    return renderDoc(parsed).trimEnd();
}

function isTipTapDoc(value: unknown): value is JSONContent {
    return (
        typeof value === "object" &&
        value !== null &&
        "type" in value &&
        (value as {type: unknown}).type === "doc"
    );
}

// --- Block walker --------------------------------------------------------

function renderDoc(doc: JSONContent): string {
    return (doc.content ?? [])
        .map((node) => renderBlock(node, 0))
        .filter((s) => s.length > 0)
        .join("\n\n");
}

function renderBlock(node: JSONContent, depth: number): string {
    switch (node.type) {
        case "paragraph":
            return renderInline(node.content ?? []);
        case "heading": {
            const level = clampHeadingLevel(
                (node.attrs?.level as number | undefined) ?? 1,
            );
            return `${"#".repeat(level)} ${renderInline(node.content ?? [])}`;
        }
        case "bulletList":
            return renderList(node.content ?? [], depth, false);
        case "orderedList":
            return renderList(node.content ?? [], depth, true);
        case "taskList":
            return renderTaskList(node.content ?? [], depth);
        case "blockquote":
            return renderBlockquote(node.content ?? []);
        case "codeBlock": {
            const language =
                (node.attrs?.language as string | null | undefined) ?? "";
            const text = innerText(node);
            return `\`\`\`${language}\n${text}\n\`\`\``;
        }
        case "horizontalRule":
            return "---";
        case "image": {
            const src = (node.attrs?.src as string | undefined) ?? "";
            const alt = (node.attrs?.alt as string | undefined) ?? "";
            const title = node.attrs?.title as string | undefined;
            return `![${alt}](${src}${title ? ` "${title}"` : ""})`;
        }
        case "table":
            return renderTable(node);
        default:
            return "";
    }
}

function clampHeadingLevel(level: number): number {
    if (level < 1) return 1;
    if (level > 6) return 6;
    return Math.trunc(level);
}

// --- Lists ---------------------------------------------------------------

function renderList(
    items: JSONContent[],
    depth: number,
    ordered: boolean,
): string {
    const indent = "  ".repeat(depth);
    const lines: string[] = [];
    items.forEach((item, index) => {
        if (item.type !== "listItem") return;
        const marker = ordered ? `${index + 1}.` : "-";
        const body = renderListItemBody(item.content ?? [], depth + 1);
        if (body.length === 0) {
            lines.push(`${indent}${marker} `);
            return;
        }
        const [first, ...rest] = body.split("\n");
        lines.push(`${indent}${marker} ${first}`);
        for (const line of rest) {
            lines.push(`${indent}  ${line}`);
        }
    });
    return lines.join("\n");
}

function renderTaskList(items: JSONContent[], depth: number): string {
    const indent = "  ".repeat(depth);
    const lines: string[] = [];
    for (const item of items) {
        if (item.type !== "taskItem") continue;
        const checked = item.attrs?.checked === true;
        const marker = `- [${checked ? "x" : " "}]`;
        const body = renderListItemBody(item.content ?? [], depth + 1);
        if (body.length === 0) {
            lines.push(`${indent}${marker}`);
            continue;
        }
        const [first, ...rest] = body.split("\n");
        lines.push(`${indent}${marker} ${first}`);
        for (const line of rest) {
            lines.push(`${indent}  ${line}`);
        }
    }
    return lines.join("\n");
}

function renderListItemBody(
    children: JSONContent[],
    depth: number,
): string {
    return children
        .map((child) => {
            if (child.type === "paragraph") {
                return renderInline(child.content ?? []);
            }
            // Nested list directly under listItem.
            return renderBlock(child, depth);
        })
        .filter((s) => s.length > 0)
        .join("\n");
}

// --- Blockquote ----------------------------------------------------------

function renderBlockquote(children: JSONContent[]): string {
    const inner = children
        .map((child) => renderBlock(child, 0))
        .filter((s) => s.length > 0)
        .join("\n\n");
    return inner
        .split("\n")
        .map((line) => (line.length > 0 ? `> ${line}` : ">"))
        .join("\n");
}

// --- Tables --------------------------------------------------------------

function renderTable(table: JSONContent): string {
    const rows = (table.content ?? []).filter((r) => r.type === "tableRow");
    if (rows.length === 0) return "";
    const rendered: string[][] = rows.map((row) =>
        (row.content ?? []).map((cell) =>
            (cell.content ?? [])
                .map((c) =>
                    c.type === "paragraph" ? renderInline(c.content ?? []) : "",
                )
                .join(" ")
                .trim(),
        ),
    );
    if (rendered.length === 0) return "";
    const header = rendered[0];
    const headerLine = `| ${header.join(" | ")} |`;
    const separator = `| ${header.map(() => "---").join(" | ")} |`;
    const body = rendered.slice(1).map((cells) => `| ${cells.join(" | ")} |`);
    return [headerLine, separator, ...body].join("\n");
}

// --- Inline walker -------------------------------------------------------

function renderInline(nodes: JSONContent[]): string {
    return nodes.map(renderInlineNode).join("");
}

function renderInlineNode(node: JSONContent): string {
    if (node.type === "hardBreak") return "  \n";
    if (node.type === "image") {
        const src = (node.attrs?.src as string | undefined) ?? "";
        const alt = (node.attrs?.alt as string | undefined) ?? "";
        return `![${alt}](${src})`;
    }
    if (node.type !== "text") return "";
    let out = (node.text ?? "");
    const marks = node.marks ?? [];
    // Apply marks from inner to outer so the visible nesting
    // matches the user's selection order.
    for (const mark of marks) {
        out = applyMark(out, mark);
    }
    return out;
}

function applyMark(text: string, mark: {type: string; attrs?: Record<string, unknown>}): string {
    switch (mark.type) {
        case "bold":
            return `**${text}**`;
        case "italic":
            return `*${text}*`;
        case "strike":
            return `~~${text}~~`;
        case "code":
            return `\`${text}\``;
        case "underline":
            return `<u>${text}</u>`;
        case "highlight":
            return `==${text}==`;
        case "subscript":
            return `<sub>${text}</sub>`;
        case "superscript":
            return `<sup>${text}</sup>`;
        case "link": {
            const href = (mark.attrs?.href as string | undefined) ?? "";
            return `[${text}](${href})`;
        }
        // textStyle / color have no Markdown equivalent.
        default:
            return text;
    }
}

// --- Helpers -------------------------------------------------------------

function innerText(node: JSONContent): string {
    if (node.type === "text") return node.text ?? "";
    const children = node.content ?? [];
    return children.map(innerText).join("");
}

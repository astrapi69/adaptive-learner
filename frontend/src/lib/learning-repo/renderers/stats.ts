/**
 * LEARNING_STATS.md generator (Phase 49C / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python ``stats.py`` at
 * ``plugins/.../learning-repo/adaptive_learner_learning_repo/
 * meta/stats.py``. The parity test (49F) pins byte-for-byte
 * equality on shared fixture input.
 *
 * Per Article 3's STATS.md example: per-session table of
 * understanding / transfer / stress (scaled x2 from the 1-5
 * stored value to /10), method-switch sub-table, exit-
 * threshold reminder block. The exit-threshold pin marker
 * on the per-session row uses ``exitThresholdIndices`` (the
 * same predicate the future git tagger consumes).
 */

import type {Labels} from "../labels";
import {latestRating, type RatingData, type SessionData} from "../render-context";
import type {RenderContext} from "../render-context";
import {exitThresholdIndices} from "../thresholds";

/**
 * Render the LEARNING_STATS.md body for one project: the
 * per-session understanding/transfer/stress table (scaled to
 * /10), the method-switch sub-table, and the exit-threshold
 * reminder block.
 */
export function renderStats(ctx: RenderContext, labels: Labels): string {
    const lines: string[] = [
        `# ${labels.stats_title}`,
        "",
        labels.stats_intro,
        "",
    ];
    lines.push(...sessionTable(ctx, labels));
    lines.push(...methodSwitchTable(ctx, labels));
    lines.push(...exitThresholdBlock(labels));
    return rstripWithNewline(lines.join("\n"));
}

function sessionTable(ctx: RenderContext, labels: Labels): string[] {
    const lines: string[] = [
        `## ${labels.stats_sessions_heading}`,
        "",
    ];
    if (ctx.sessions.length === 0) {
        lines.push(labels.stats_no_sessions, "");
        return lines;
    }
    // Header row matches Python's f-string layout exactly,
    // including trailing single space before each ``|``.
    const header =
        `| ${labels.stats_table_session} ` +
        `| ${labels.stats_table_method} ` +
        `| ${labels.stats_table_understanding} ` +
        `| ${labels.stats_table_transfer} ` +
        `| ${labels.stats_table_stress} ` +
        `| ${labels.stats_table_cycles} ` +
        `| ${labels.stats_table_status} |`;
    lines.push(header);
    lines.push("|" + "---|".repeat(7));
    const sessionsSorted = [...ctx.sessions].sort((a, b) =>
        a.started_at.localeCompare(b.started_at),
    );
    const exitIndices = exitThresholdIndices(ctx);
    sessionsSorted.forEach((session, index) => {
        lines.push(
            sessionRow(session, ctx, labels, exitIndices.has(index)),
        );
    });
    lines.push("");
    return lines;
}

function sessionRow(
    session: SessionData,
    ctx: RenderContext,
    labels: Labels,
    exitMet: boolean,
): string {
    const rating = latestRating(ctx, session.id);
    const understanding = formatRating(rating, "understanding");
    const transfer = formatRating(rating, "method_fit");
    const stress = formatRating(rating, "stress");
    const shortId = session.id.slice(0, 8);
    const cycleCount = session.cycle_count ?? 1;
    let status = session.status;
    if (exitMet) {
        status = `${session.status} ${labels.stats_exit_pin_marker}`;
    }
    return (
        `| \`${shortId}\` ` +
        `| ${session.method} ` +
        `| ${understanding} ` +
        `| ${transfer} ` +
        `| ${stress} ` +
        `| ${cycleCount} ` +
        `| ${status} |`
    );
}

function formatRating(
    rating: RatingData | null,
    field: "understanding" | "method_fit" | "stress",
): string {
    if (rating === null) {
        return "-";
    }
    // 1-5 stored, scaled x2 to /10 for display per Article-1
    // § 8 (and to match the exit-threshold contract).
    const raw = rating[field];
    const scaled = raw * 2;
    return `${scaled}/10`;
}

function methodSwitchTable(
    ctx: RenderContext,
    labels: Labels,
): string[] {
    const lines: string[] = [
        `## ${labels.stats_method_switches_heading}`,
        "",
    ];
    if (ctx.method_switches.length === 0) {
        lines.push(labels.stats_no_method_switches, "");
        return lines;
    }
    const header =
        `| ${labels.stats_table_from} ` +
        `| ${labels.stats_table_to} ` +
        `| ${labels.stats_table_reason} ` +
        `| ${labels.stats_table_when} |`;
    lines.push(header);
    lines.push("|" + "---|".repeat(4));
    const sorted = [...ctx.method_switches].sort((a, b) =>
        a.switched_at.localeCompare(b.switched_at),
    );
    for (const switchRow of sorted) {
        // Python's ``strftime("%Y-%m-%d")`` on a UTC datetime
        // → first 10 chars of ISO 8601. Matches even when
        // the source datetime carries a non-Z offset since
        // the date portion is the same.
        const when = switchRow.switched_at.slice(0, 10);
        const reason = switchRow.reason
            .replace(/\|/g, "\\|")
            .replace(/\n/g, " ");
        lines.push(
            `| ${switchRow.from_method} | ${switchRow.to_method} | ${reason} | ${when} |`,
        );
    }
    lines.push("");
    return lines;
}

function exitThresholdBlock(labels: Labels): string[] {
    return [
        `## ${labels.stats_exit_threshold_heading}`,
        "",
        labels.stats_exit_threshold_body,
        "",
    ];
}

function rstripWithNewline(s: string): string {
    return s.replace(/[\s\n]+$/, "") + "\n";
}

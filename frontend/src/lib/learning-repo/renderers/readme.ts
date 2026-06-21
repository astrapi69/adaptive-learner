/**
 * README.md generator for the learning-repo renderer (Phase
 * 49C / v1.32.0 / PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python ``readme.py`` at
 * ``plugins/.../learning-repo/adaptive_learner_learning_repo/
 * meta/readme.py``. The parity test (49F) pins byte-for-byte
 * output equality on shared fixture input.
 *
 * Section order matches Python: title → goal → status →
 * progress → method-distribution (when non-empty) → topics →
 * see-also.
 */

import {formatLabel, type Labels} from "../labels";
import {methodDistribution} from "../render-context";
import type {RenderContext} from "../render-context";
import {topicFolderName} from "../topic-folder-slug";

/**
 * Render the project README.md body: title, goal, status,
 * progress, method distribution (when non-empty), topic links,
 * and the see-also section.
 */
export function renderReadme(ctx: RenderContext, labels: Labels): string {
    const lines: string[] = [
        `# ${formatLabel(labels.readme_title, {topic: ctx.project.topic})}`,
        "",
        `## ${labels.readme_goal_heading}`,
        "",
        ctx.project.goal,
        "",
        `## ${labels.readme_status_heading}`,
        "",
        ctx.project.active ? labels.readme_active : labels.readme_archived,
        "",
        `## ${labels.readme_progress_heading}`,
        "",
        `- ${labels.readme_sessions_label}: ${ctx.sessions.length}`,
        `- ${labels.readme_cycles_label}: ${cycleSum(ctx)}`,
        "",
    ];
    lines.push(...methodDistributionBlock(ctx, labels));
    lines.push(...topicsBlock(ctx, labels));
    lines.push(...seeAlsoBlock(labels));
    // Match Python's ``"\n".join(lines).rstrip() + "\n"``.
    return rstripWithNewline(lines.join("\n"));
}

function cycleSum(ctx: RenderContext): number {
    // Dexie-mode sessions don't write ``cycle_count``; default
    // to 1 (the SQLAlchemy column default in API mode). Same
    // shape as ``s.cycle_count or 1`` would emit in Python.
    let total = 0;
    for (const s of ctx.sessions) {
        total += s.cycle_count ?? 1;
    }
    return total;
}

function methodDistributionBlock(
    ctx: RenderContext,
    labels: Labels,
): string[] {
    const dist = methodDistribution(ctx);
    if (dist.size === 0) {
        return [];
    }
    const lines: string[] = [
        `## ${labels.readme_method_distribution_heading}`,
        "",
    ];
    // Sort key matches Python: ``(-dist[m], m)`` — count
    // descending, then alphabetical tiebreaker.
    const sorted = Array.from(dist.entries()).sort((a, b) => {
        if (a[1] !== b[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });
    for (const [method, count] of sorted) {
        lines.push(`- **${method}**: ${count}`);
    }
    lines.push("");
    return lines;
}

function topicsBlock(ctx: RenderContext, labels: Labels): string[] {
    const lines: string[] = [
        `## ${labels.readme_topics_heading}`,
        "",
    ];
    if (ctx.topics.length === 0) {
        lines.push(labels.readme_no_topics, "");
        return lines;
    }
    for (const topic of ctx.topics) {
        const folder = topicFolderName(topic.order, topic.title);
        lines.push(`- [${topic.title}](${folder}/README.md)`);
    }
    lines.push("");
    return lines;
}

function seeAlsoBlock(labels: Labels): string[] {
    return [
        `## ${labels.readme_see_also_heading}`,
        "",
        `- ${labels.readme_see_stats}`,
        `- ${labels.readme_see_cheatsheet}`,
        `- ${labels.readme_see_roadmap}`,
        "",
    ];
}

/**
 * Strip trailing whitespace + add a final newline. Matches
 * Python's ``"\n".join(lines).rstrip() + "\n"``.
 */
function rstripWithNewline(s: string): string {
    return s.replace(/[\s\n]+$/, "") + "\n";
}

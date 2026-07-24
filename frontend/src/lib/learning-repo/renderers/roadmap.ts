/**
 * ROADMAP.md generator (Phase 49D / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python ``roadmap.py`` at
 * ``plugins/.../learning-repo/adaptive_learner_learning_repo/
 * meta/roadmap.py``. Parity test (49F) pins byte-for-byte.
 *
 * Surfaces:
 *   - Immediate next-step suggestion (resume-active /
 *     start-next / start-first) — picked from the most
 *     actionable signal in the project's session history.
 *   - Open topics in flight (with session count + methods).
 *
 * Curriculum-level future topics are NOT surfaced here per
 * the Python source: the data model doesn't link
 * ``LearningProject`` to ``Curriculum`` directly.
 */

import {formatLabel, type Labels} from "../labels";
import type {RenderContext, SessionData} from "../render-context";

/**
 * Render the ROADMAP.md body: an immediate next-step
 * suggestion (resume-active / start-next / start-first) plus
 * the list of open topics still in flight.
 */
export function renderRoadmap(
    ctx: RenderContext,
    labels: Labels,
): string {
    const lines: string[] = [
        `# ${labels.roadmap_title}`,
        "",
        labels.roadmap_intro,
        "",
    ];
    lines.push(...nextStepsBlock(ctx, labels));
    lines.push(...openTopicsBlock(ctx, labels));
    return rstripWithNewline(lines.join("\n"));
}

function nextStepsBlock(
    ctx: RenderContext,
    labels: Labels,
): string[] {
    const lines: string[] = [
        `## ${labels.roadmap_next_steps_heading}`,
        "",
    ];
    const suggestion = suggestNextStep(ctx, labels);
    if (suggestion === null) {
        lines.push(labels.roadmap_no_next_steps, "");
        return lines;
    }
    lines.push(`- ${suggestion}`, "");
    return lines;
}

function suggestNextStep(
    ctx: RenderContext,
    labels: Labels,
): string | null {
    const active = activeSession(ctx);
    if (active !== null) {
        return formatLabel(labels.roadmap_resume_active, {
            method: active.method,
            step: active.cycle_step,
            cycle: active.cycle_count ?? 1,
        });
    }
    const lastCompleted = lastCompletedSession(ctx);
    if (lastCompleted !== null) {
        return formatLabel(labels.roadmap_start_next, {
            method: lastCompleted.method,
        });
    }
    if (ctx.sessions.length > 0) {
        // All sessions abandoned (no active, no completed) →
        // fall through to "start first" using the
        // chronologically first session's method as best
        // signal.
        const sorted = [...ctx.sessions].sort((a, b) =>
            a.started_at.localeCompare(b.started_at),
        );
        return formatLabel(labels.roadmap_start_first, {
            method: sorted[0].method,
        });
    }
    return null;
}

function activeSession(ctx: RenderContext): SessionData | null {
    for (const s of ctx.sessions) {
        if (s.status === "active") return s;
    }
    return null;
}

function lastCompletedSession(ctx: RenderContext): SessionData | null {
    const completed = ctx.sessions.filter((s) => s.status === "completed");
    if (completed.length === 0) return null;
    // Python's ``max(..., key=lambda s: s.ended_at or s.started_at)``
    // — fall back to started_at when ended_at is null.
    return completed.reduce((best, s) => {
        const bestKey = best.ended_at ?? best.started_at;
        const sKey = s.ended_at ?? s.started_at;
        return sKey.localeCompare(bestKey) > 0 ? s : best;
    });
}

function openTopicsBlock(
    ctx: RenderContext,
    labels: Labels,
): string[] {
    const lines: string[] = [
        `## ${labels.roadmap_open_topics_heading}`,
        "",
    ];
    if (ctx.topics.length === 0) {
        lines.push(labels.roadmap_no_open_topics, "");
        return lines;
    }
    for (const topic of ctx.topics) {
        const methods =
            topic.methods.length === 0 ? "-" : topic.methods.join(", ");
        lines.push(
            `- **${topic.title}** (${topic.session_ids.length} sessions; methods: ${methods})`,
        );
    }
    lines.push("");
    return lines;
}

function rstripWithNewline(s: string): string {
    return s.replace(/[\s\n]+$/, "") + "\n";
}

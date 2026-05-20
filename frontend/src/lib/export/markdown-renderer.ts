/**
 * Markdown renderer (Phase 16B).
 *
 * Takes a structured export payload (ProgressReport |
 * SessionDetail | CurriculumOverview) and produces a clean,
 * human-readable Markdown string. Dispatches by ``type`` field.
 *
 * Design principles:
 *
 *   - Readable standalone: someone opening the .md without
 *     context should understand the learning journey.
 *   - Language-aware: DE / EN labels via ``lib/export/i18n``;
 *     other languages fall back to EN.
 *   - Star ratings for 1-5 scales: "★★★★☆ (4/5)".
 *   - Percentages where applicable.
 *   - Special characters escaped where needed (table cells,
 *     code-fences in messages).
 *   - No external dependencies — the renderer is a single
 *     string-building function tree.
 */

import type {
    CurriculumOverview,
    ProgressProject,
    ProgressReport,
    SessionDetail,
} from "../../storage/export-builder";
import {methodLabel, statusLabel, stepLabel, t} from "./i18n";

export type ExportPayload = ProgressReport | SessionDetail | CurriculumOverview;

/** Dispatch the right renderer by payload type. */
export function renderMarkdown(payload: ExportPayload): string {
    switch (payload.type) {
        case "progress_report":
            return renderProgressReport(payload);
        case "session_detail":
            return renderSessionDetail(payload);
        case "curriculum_overview":
            return renderCurriculumOverview(payload);
    }
}

/** Suggested filename for the download. ISO date + short type
 * makes it obvious in a Downloads folder.
 */
export function exportFilename(payload: ExportPayload, ext: string): string {
    const date = payload.generated_at.slice(0, 10);
    const slug = payload.type.replace("_", "-");
    return `adaptive-learner-${slug}-${date}.${ext}`;
}

// ---- Common helpers ------------------------------------------------------

const MAX_STARS = 5;

function stars(value: number, scale = MAX_STARS): string {
    const clamped = Math.max(0, Math.min(scale, Math.round(value)));
    return "★".repeat(clamped) + "☆".repeat(scale - clamped);
}

function fraction01ToPercent(value: number): number {
    return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function ratingLine(label: string, value: number, lang: string): string {
    return `- **${label}:** ${stars(value)} (${value}/${MAX_STARS} ${t(lang, "scale_5")})`;
}

function formatDateTime(iso: string | null): string {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function formatDate(iso: string | null): string {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
}

function escapePipe(s: string): string {
    return s.replace(/\|/g, "\\|");
}

function envelopeFooter(payload: ExportPayload): string {
    const generated = formatDateTime(payload.generated_at);
    return (
        "---\n\n" +
        `_${t(payload.lang, "generated_at")}: ${generated} - ` +
        `${t(payload.lang, "app_version")}: ${payload.app_version}_\n`
    );
}

// ---- Progress Report -----------------------------------------------------

function renderProgressReport(payload: ProgressReport): string {
    const sections: string[] = [
        `# ${t(payload.lang, "progress_report_title")}`,
        "",
        `**${t(payload.lang, "learner")}:** ${payload.user.name}  ` +
            `\n**${t(payload.lang, "language")}:** ${payload.user.language}`,
        "",
        renderProfileSection(payload),
        renderProjectsSection(payload),
        renderRecentSessionsSection(payload),
        renderStepInsightsSection(payload),
        renderExtractionsSection(payload),
        envelopeFooter(payload),
    ];
    return sections.filter(Boolean).join("\n");
}

function renderProfileSection(payload: ProgressReport): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "method_profile")}`, ""];
    if (!payload.profile) {
        lines.push(t(lang, "no_profile"));
        lines.push("");
        return lines.join("\n");
    }
    const p = payload.profile;
    lines.push(
        `**${t(lang, "dominant_method")}:** ${methodLabel(lang, p.dominant_method)}  ` +
            `\n**${t(lang, "assessed_at")}:** ${formatDate(p.assessed_at)}`,
    );
    lines.push("");
    lines.push(`| ${t(lang, "method")} | ${t(lang, "advance_rate")} |`);
    lines.push("|---|---|");
    const methods: (keyof typeof p)[] = [
        "deductive",
        "inductive",
        "error_based",
        "dialogic",
        "contextual",
        "ai_adaptive",
    ];
    for (const m of methods) {
        const v = p[m] as number;
        const bar = "█".repeat(Math.round(v * 10)).padEnd(10, "░");
        lines.push(
            `| ${methodLabel(lang, m as string)} | ${bar} ${fraction01ToPercent(v)}% |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

function renderProjectsSection(payload: ProgressReport): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "projects")}`, ""];
    if (payload.projects.length === 0) {
        lines.push(t(lang, "no_projects"));
        lines.push("");
        return lines.join("\n");
    }
    for (const project of payload.projects) {
        lines.push(...renderProject(project, lang));
    }
    return lines.join("\n");
}

function renderProject(project: ProgressProject, lang: string): string[] {
    const lines: string[] = [];
    const statusKey = project.active ? "active" : "archived";
    lines.push(`### ${project.topic}`);
    lines.push("");
    lines.push(`- **${t(lang, "goal")}:** ${project.goal}`);
    lines.push(`- **${t(lang, "timeframe")}:** ${project.timeframe}`);
    lines.push(
        `- **${t(lang, "daily_minutes")}:** ${project.daily_minutes} ${t(lang, "minutes_short")}`,
    );
    if (project.current_problem) {
        lines.push(`- **${t(lang, "current_problem")}:** ${project.current_problem}`);
    }
    lines.push(`- **${t(lang, "status")}:** ${t(lang, statusKey)}`);
    lines.push(`- **${t(lang, "session_count")}:** ${project.session_count}`);
    lines.push(
        `- **${t(lang, "total_minutes")}:** ${project.total_minutes} ${t(lang, "minutes_short")}`,
    );
    if (project.session_count > 0) {
        lines.push(
            `- **${t(lang, "mean_understanding")}:** ${fraction01ToPercent(project.mean_understanding)}%`,
        );
        lines.push(
            `- **${t(lang, "mean_stress")}:** ${fraction01ToPercent(project.mean_stress)}%`,
        );
    }
    lines.push("");

    if (project.session_count > 0) {
        lines.push(`#### ${t(lang, "method_distribution")}`);
        lines.push("");
        lines.push(`| ${t(lang, "method")} | ${t(lang, "session_count")} | % |`);
        lines.push("|---|---|---|");
        for (const entry of project.method_distribution) {
            lines.push(
                `| ${methodLabel(lang, entry.method)} | ${entry.count} | ${entry.percentage}% |`,
            );
        }
        lines.push("");
    }

    lines.push(`#### ${t(lang, "method_switches")}`);
    lines.push("");
    if (project.method_switches.length === 0) {
        lines.push(t(lang, "no_switches"));
    } else {
        for (const sw of project.method_switches) {
            const arrow = `${methodLabel(lang, sw.from_method)} -> ${methodLabel(lang, sw.to_method)}`;
            lines.push(
                `- ${formatDate(sw.switched_at)} - ${arrow} ` +
                    `_(${t(lang, "reason")}: ${sw.reason})_`,
            );
        }
    }
    lines.push("");
    return lines;
}

function renderRecentSessionsSection(payload: ProgressReport): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "recent_sessions")}`, ""];
    if (payload.recent_sessions.length === 0) {
        lines.push(t(lang, "no_sessions"));
        lines.push("");
        return lines.join("\n");
    }
    lines.push(
        `| ${t(lang, "started_at")} | ${t(lang, "topic")} | ` +
            `${t(lang, "method")} | ${t(lang, "duration")} | ` +
            `${t(lang, "understanding")} | ${t(lang, "status")} |`,
    );
    lines.push("|---|---|---|---|---|---|");
    for (const s of payload.recent_sessions) {
        const understanding = s.rating ? `${s.rating.understanding}/5` : "-";
        lines.push(
            `| ${formatDate(s.started_at)} | ` +
                `${escapePipe(s.project_topic)} | ${methodLabel(lang, s.method)} | ` +
                `${s.duration_minutes} ${t(lang, "minutes_short")} | ` +
                `${understanding} | ${statusLabel(lang, s.status)} |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

function renderStepInsightsSection(payload: ProgressReport): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "step_evaluation_insights")}`, ""];
    if (!payload.step_evaluation_insights) {
        lines.push(t(lang, "no_step_insights"));
        lines.push("");
        return lines.join("\n");
    }
    lines.push(
        `| ${t(lang, "step")} | ${t(lang, "evaluations_count")} | ` +
            `${t(lang, "advanced")} | ${t(lang, "repeated")} | ` +
            `${t(lang, "deferred")} | ${t(lang, "advance_rate")} | ` +
            `${t(lang, "mean_confidence")} |`,
    );
    lines.push("|---|---|---|---|---|---|---|");
    for (const insight of payload.step_evaluation_insights) {
        lines.push(
            `| ${insight.step}. ${stepLabel(lang, insight.step)} | ` +
                `${insight.count} | ${insight.advance_count} | ` +
                `${insight.repeat_count} | ${insight.deferred_count} | ` +
                `${fraction01ToPercent(insight.advance_rate)}% | ` +
                `${fraction01ToPercent(insight.mean_confidence)}% |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

function renderExtractionsSection(payload: ProgressReport): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "extractions")}`, ""];
    if (payload.extractions.length === 0) {
        lines.push(t(lang, "no_extractions"));
        lines.push("");
        return lines.join("\n");
    }
    for (const e of payload.extractions) {
        lines.push(`### ${e.title}`);
        lines.push("");
        lines.push(`- **${t(lang, "source")}:** ${e.source}`);
        lines.push(
            `- **${t(lang, "messages")}:** ${e.message_count}`,
        );
        lines.push(
            `- **${t(lang, "imported_at")}:** ${formatDate(e.imported_at)}`,
        );
        if (e.topic_tag) {
            lines.push(`- **${t(lang, "topic")}:** ${e.topic_tag}`);
        }
        if (e.analysis && Object.keys(e.analysis).length > 0) {
            lines.push("");
            lines.push(`**${t(lang, "analysis")}:**`);
            lines.push("");
            lines.push("```json");
            lines.push(JSON.stringify(e.analysis, null, 2));
            lines.push("```");
        }
        lines.push("");
    }
    return lines.join("\n");
}

// ---- Session Detail ------------------------------------------------------

function renderSessionDetail(payload: SessionDetail): string {
    const lang = payload.lang;
    const sections: string[] = [
        `# ${t(lang, "session_detail_title")}`,
        "",
        renderSessionMeta(payload),
        renderTranscript(payload),
        renderSessionRating(payload),
        renderSessionStepEvaluations(payload),
        envelopeFooter(payload),
    ];
    return sections.filter(Boolean).join("\n");
}

function renderSessionMeta(payload: SessionDetail): string {
    const lang = payload.lang;
    const s = payload.session;
    const lines: string[] = [`## ${t(lang, "session")}`, ""];
    if (payload.project) {
        lines.push(`**${t(lang, "topic")}:** ${payload.project.topic}  `);
        lines.push(`**${t(lang, "goal")}:** ${payload.project.goal}  `);
    }
    lines.push(`**${t(lang, "method")}:** ${methodLabel(lang, s.method)}  `);
    lines.push(`**${t(lang, "started_at")}:** ${formatDateTime(s.started_at)}  `);
    lines.push(`**${t(lang, "ended_at")}:** ${formatDateTime(s.ended_at)}  `);
    lines.push(
        `**${t(lang, "duration")}:** ${s.duration_minutes} ${t(lang, "minutes_short")}  `,
    );
    lines.push(
        `**${t(lang, "cycle_step")}:** ${s.cycle_step}. ${stepLabel(lang, s.cycle_step)}  `,
    );
    lines.push(`**${t(lang, "status")}:** ${statusLabel(lang, s.status)}`);
    lines.push("");
    return lines.join("\n");
}

function renderTranscript(payload: SessionDetail): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "transcript")}`, ""];
    if (payload.messages.length === 0) {
        lines.push(t(lang, "no_messages"));
        lines.push("");
        return lines.join("\n");
    }
    for (const m of payload.messages) {
        const roleLabelKey =
            m.role === "user"
                ? "role_user"
                : m.role === "assistant"
                  ? "role_assistant"
                  : "role_system";
        lines.push(`### ${t(lang, roleLabelKey)} - _${formatDateTime(m.created_at)}_`);
        lines.push("");
        // Use a blockquote per line so the role is visually attached
        // to the message body, surviving multi-paragraph content.
        const content = m.content.replace(/\r\n/g, "\n");
        for (const line of content.split("\n")) {
            lines.push(`> ${line}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}

function renderSessionRating(payload: SessionDetail): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "rating")}`, ""];
    if (!payload.rating) {
        lines.push(t(lang, "no_rating"));
        lines.push("");
        return lines.join("\n");
    }
    const r = payload.rating;
    lines.push(ratingLine(t(lang, "understanding"), r.understanding, lang));
    lines.push(ratingLine(t(lang, "stress"), r.stress, lang));
    lines.push(ratingLine(t(lang, "method_fit"), r.method_fit, lang));
    if (r.notes) {
        lines.push("");
        lines.push(`**${t(lang, "notes")}:**`);
        lines.push("");
        for (const line of r.notes.split("\n")) {
            lines.push(`> ${line}`);
        }
    }
    lines.push("");
    return lines.join("\n");
}

function renderSessionStepEvaluations(payload: SessionDetail): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "step_evaluations")}`, ""];
    if (payload.step_evaluations.length === 0) {
        lines.push(t(lang, "no_step_insights"));
        lines.push("");
        return lines.join("\n");
    }
    lines.push(
        `| ${t(lang, "evaluated_at")} | ${t(lang, "from_step")} | ` +
            `${t(lang, "to_step")} | ${t(lang, "confidence")} | ` +
            `${t(lang, "status")} | ${t(lang, "reason")} |`,
    );
    lines.push("|---|---|---|---|---|---|");
    for (const e of payload.step_evaluations) {
        const status = e.fallback_used
            ? t(lang, "fallback")
            : e.applied
              ? t(lang, "applied")
              : t(lang, "not_applied");
        lines.push(
            `| ${formatDateTime(e.evaluated_at)} | ` +
                `${e.from_step}. ${stepLabel(lang, e.from_step)} | ` +
                `${e.to_step}. ${stepLabel(lang, e.to_step)} | ` +
                `${fraction01ToPercent(e.confidence)}% | ${status} | ` +
                `${escapePipe(e.reason)} |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

// ---- Curriculum Overview -------------------------------------------------

function renderCurriculumOverview(payload: CurriculumOverview): string {
    const lang = payload.lang;
    const c = payload.curriculum;
    const sections: string[] = [
        `# ${t(lang, "curriculum_overview_title")}: ${c.title}`,
        "",
    ];
    if (c.description) {
        sections.push(`**${t(lang, "description")}:** ${c.description}`);
        sections.push("");
    }
    sections.push(`**${t(lang, "language")}:** ${c.language}  `);
    sections.push(`**${t(lang, "generated_at")}:** ${formatDate(c.created_at)}`);
    sections.push("");
    sections.push(renderTopicTree(payload));
    sections.push(renderLessons(payload));
    sections.push(envelopeFooter(payload));
    return sections.filter(Boolean).join("\n");
}

function renderTopicTree(payload: CurriculumOverview): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "topics")}`, ""];
    if (payload.topics.length === 0) {
        lines.push(t(lang, "no_topics"));
        lines.push("");
        return lines.join("\n");
    }
    for (const topic of payload.topics) {
        const indent = "  ".repeat(topic.depth);
        lines.push(`${indent}- **${topic.title}**`);
        if (topic.description) {
            lines.push(`${indent}  - ${topic.description}`);
        }
    }
    lines.push("");
    return lines.join("\n");
}

function renderLessons(payload: CurriculumOverview): string {
    const lang = payload.lang;
    const lines: string[] = [`## ${t(lang, "lessons")}`, ""];
    if (payload.lessons.length === 0) {
        lines.push(t(lang, "no_lessons"));
        lines.push("");
        return lines.join("\n");
    }
    for (const lesson of payload.lessons) {
        lines.push(`### ${lesson.title}`);
        lines.push("");
        if (lesson.content) {
            lines.push(lesson.content);
        }
        lines.push("");
    }
    return lines.join("\n");
}

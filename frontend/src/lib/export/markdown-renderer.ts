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
 *   - Language-aware: every label comes from the catalogs through the
 *     caller's ``t`` (``lib/export/i18n``, #3426), so the report is in
 *     the UI language.
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
} from "../../storage/backup/export-builder";
import {renderStoredContent} from "../utils/tiptap-to-markdown";
import {methodLabel, reportText, statusLabel, stepLabel, t} from "./i18n";
import type {ReportText, Translate} from "./i18n";

export type ExportPayload = ProgressReport | SessionDetail | CurriculumOverview;

/** Dispatch the right renderer by payload type. */
export function renderMarkdown(payload: ExportPayload, translate: Translate): string {
    const text = reportText(translate);
    switch (payload.type) {
        case "progress_report":
            return renderProgressReport(payload, text);
        case "session_detail":
            return renderSessionDetail(payload, text);
        case "curriculum_overview":
            return renderCurriculumOverview(payload, text);
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

function ratingLine(label: string, value: number, text: ReportText): string {
    return `- **${label}:** ${stars(value)} (${value}/${MAX_STARS} ${t(text, "scale_5")})`;
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

function envelopeFooter(payload: ExportPayload, text: ReportText): string {
    const generated = formatDateTime(payload.generated_at);
    return (
        "---\n\n" +
        `_${t(text, "generated_at")}: ${generated} - ` +
        `${t(text, "app_version")}: ${payload.app_version}_\n`
    );
}

// ---- Progress Report -----------------------------------------------------

function renderProgressReport(payload: ProgressReport, text: ReportText): string {
    const sections: string[] = [
        `# ${t(text, "progress_report_title")}`,
        "",
        `**${t(text, "learner")}:** ${payload.user.name}  ` +
            `\n**${t(text, "language")}:** ${payload.user.language}`,
        "",
        renderProfileSection(payload, text),
        renderProjectsSection(payload, text),
        renderRecentSessionsSection(payload, text),
        renderStepInsightsSection(payload, text),
        renderExtractionsSection(payload, text),
        envelopeFooter(payload, text),
    ];
    return sections.filter(Boolean).join("\n");
}

function renderProfileSection(payload: ProgressReport, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "method_profile")}`, ""];
    if (!payload.profile) {
        lines.push(t(text, "no_profile"));
        lines.push("");
        return lines.join("\n");
    }
    const p = payload.profile;
    lines.push(
        `**${t(text, "dominant_method")}:** ${methodLabel(text, p.dominant_method)}  ` +
            `\n**${t(text, "assessed_at")}:** ${formatDate(p.assessed_at)}`,
    );
    lines.push("");
    lines.push(`| ${t(text, "method")} | ${t(text, "advance_rate")} |`);
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
            `| ${methodLabel(text, m as string)} | ${bar} ${fraction01ToPercent(v)}% |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

function renderProjectsSection(payload: ProgressReport, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "projects")}`, ""];
    if (payload.projects.length === 0) {
        lines.push(t(text, "no_projects"));
        lines.push("");
        return lines.join("\n");
    }
    for (const project of payload.projects) {
        lines.push(...renderProject(project, text));
    }
    return lines.join("\n");
}

function renderProject(project: ProgressProject, text: ReportText): string[] {
    const lines: string[] = [];
    const statusKey = project.active ? "active" : "archived";
    lines.push(`### ${project.topic}`);
    lines.push("");
    lines.push(`- **${t(text, "goal")}:** ${project.goal}`);
    lines.push(`- **${t(text, "timeframe")}:** ${project.timeframe}`);
    lines.push(
        `- **${t(text, "daily_minutes")}:** ${project.daily_minutes} ${t(text, "minutes_short")}`,
    );
    if (project.current_problem) {
        lines.push(`- **${t(text, "current_problem")}:** ${project.current_problem}`);
    }
    lines.push(`- **${t(text, "status")}:** ${t(text, statusKey)}`);
    lines.push(`- **${t(text, "session_count")}:** ${project.session_count}`);
    lines.push(
        `- **${t(text, "total_minutes")}:** ${project.total_minutes} ${t(text, "minutes_short")}`,
    );
    if (project.session_count > 0) {
        lines.push(
            `- **${t(text, "mean_understanding")}:** ${fraction01ToPercent(project.mean_understanding)}%`,
        );
        lines.push(
            `- **${t(text, "mean_stress")}:** ${fraction01ToPercent(project.mean_stress)}%`,
        );
    }
    lines.push("");

    if (project.session_count > 0) {
        lines.push(`#### ${t(text, "method_distribution")}`);
        lines.push("");
        lines.push(`| ${t(text, "method")} | ${t(text, "session_count")} | % |`);
        lines.push("|---|---|---|");
        for (const entry of project.method_distribution) {
            lines.push(
                `| ${methodLabel(text, entry.method)} | ${entry.count} | ${entry.percentage}% |`,
            );
        }
        lines.push("");
    }

    lines.push(`#### ${t(text, "method_switches")}`);
    lines.push("");
    if (project.method_switches.length === 0) {
        lines.push(t(text, "no_switches"));
    } else {
        for (const sw of project.method_switches) {
            const arrow = `${methodLabel(text, sw.from_method)} -> ${methodLabel(text, sw.to_method)}`;
            lines.push(
                `- ${formatDate(sw.switched_at)} - ${arrow} ` +
                    `_(${t(text, "reason")}: ${sw.reason})_`,
            );
        }
    }
    lines.push("");
    return lines;
}

function renderRecentSessionsSection(payload: ProgressReport, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "recent_sessions")}`, ""];
    if (payload.recent_sessions.length === 0) {
        lines.push(t(text, "no_sessions"));
        lines.push("");
        return lines.join("\n");
    }
    lines.push(
        `| ${t(text, "started_at")} | ${t(text, "topic")} | ` +
            `${t(text, "method")} | ${t(text, "duration")} | ` +
            `${t(text, "understanding")} | ${t(text, "status")} |`,
    );
    lines.push("|---|---|---|---|---|---|");
    for (const s of payload.recent_sessions) {
        const understanding = s.rating ? `${s.rating.understanding}/5` : "-";
        lines.push(
            `| ${formatDate(s.started_at)} | ` +
                `${escapePipe(s.project_topic)} | ${methodLabel(text, s.method)} | ` +
                `${s.duration_minutes} ${t(text, "minutes_short")} | ` +
                `${understanding} | ${statusLabel(text, s.status)} |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

function renderStepInsightsSection(payload: ProgressReport, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "step_evaluation_insights")}`, ""];
    if (!payload.step_evaluation_insights) {
        lines.push(t(text, "no_step_insights"));
        lines.push("");
        return lines.join("\n");
    }
    lines.push(
        `| ${t(text, "step")} | ${t(text, "evaluations_count")} | ` +
            `${t(text, "advanced")} | ${t(text, "repeated")} | ` +
            `${t(text, "deferred")} | ${t(text, "advance_rate")} | ` +
            `${t(text, "mean_confidence")} |`,
    );
    lines.push("|---|---|---|---|---|---|---|");
    for (const insight of payload.step_evaluation_insights) {
        lines.push(
            `| ${insight.step}. ${stepLabel(text, insight.step)} | ` +
                `${insight.count} | ${insight.advance_count} | ` +
                `${insight.repeat_count} | ${insight.deferred_count} | ` +
                `${fraction01ToPercent(insight.advance_rate)}% | ` +
                `${fraction01ToPercent(insight.mean_confidence)}% |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

function renderExtractionsSection(payload: ProgressReport, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "extractions")}`, ""];
    if (payload.extractions.length === 0) {
        lines.push(t(text, "no_extractions"));
        lines.push("");
        return lines.join("\n");
    }
    for (const e of payload.extractions) {
        lines.push(`### ${e.title}`);
        lines.push("");
        lines.push(`- **${t(text, "source")}:** ${e.source}`);
        lines.push(
            `- **${t(text, "messages")}:** ${e.message_count}`,
        );
        lines.push(
            `- **${t(text, "imported_at")}:** ${formatDate(e.imported_at)}`,
        );
        if (e.topic_tag) {
            lines.push(`- **${t(text, "topic")}:** ${e.topic_tag}`);
        }
        if (e.project_id) {
            lines.push(`- **${t(text, "linked_project")}:** ${e.project_id}`);
        }
        if (e.analysis && Object.keys(e.analysis).length > 0) {
            lines.push("");
            lines.push(...renderAnalysis(e.analysis, text));
        }
        lines.push("");
    }
    return lines.join("\n");
}

/**
 * Render a ConversationAnalysisResult as human-readable Markdown
 * instead of a JSON dump. Each known field gets its own labelled
 * sub-section; unknown fields fall through to a compact JSON
 * appendix so partial / future analysis shapes still surface.
 */
function renderAnalysis(
    analysis: Record<string, unknown>,
    text: ReportText,
): string[] {
    const lines: string[] = [];
    const consumed = new Set<string>();

    const writeField = (key: string, render: () => void): void => {
        if (key in analysis && analysis[key] != null) {
            render();
            consumed.add(key);
        }
    };

    writeField("topic", () => {
        lines.push(
            `**${t(text, "analysis_topic")}:** ${String(analysis["topic"])}`,
        );
        lines.push("");
    });

    writeField("user_level", () => {
        const level = String(analysis["user_level"]);
        const levelKey = (
            level === "beginner"
                ? "level_beginner"
                : level === "intermediate"
                  ? "level_intermediate"
                  : "level_advanced"
        ) as Parameters<typeof t>[1];
        lines.push(
            `**${t(text, "analysis_user_level")}:** ${t(text, levelKey)}`,
        );
        lines.push("");
    });

    writeField("subtopics", () => {
        const arr = analysis["subtopics"];
        if (!Array.isArray(arr)) return;
        lines.push(`**${t(text, "analysis_subtopics")}:**`);
        for (const s of arr) lines.push(`- ${String(s)}`);
        lines.push("");
    });

    writeField("strengths", () => {
        const arr = analysis["strengths"];
        if (!Array.isArray(arr)) return;
        lines.push(`**${t(text, "analysis_strengths")}:**`);
        for (const s of arr) lines.push(`- ${String(s)}`);
        lines.push("");
    });

    writeField("weaknesses", () => {
        const arr = analysis["weaknesses"];
        if (!Array.isArray(arr)) return;
        lines.push(`**${t(text, "analysis_weaknesses")}:**`);
        for (const s of arr) lines.push(`- ${String(s)}`);
        lines.push("");
    });

    writeField("error_patterns", () => {
        const arr = analysis["error_patterns"];
        if (!Array.isArray(arr)) return;
        lines.push(`**${t(text, "analysis_error_patterns")}:**`);
        for (const s of arr) lines.push(`- ${String(s)}`);
        lines.push("");
    });

    writeField("recommended_method", () => {
        lines.push(
            `**${t(text, "analysis_recommended_method")}:** ${methodLabel(text, String(analysis["recommended_method"]))}`,
        );
        lines.push("");
    });

    writeField("recommended_focus", () => {
        lines.push(
            `**${t(text, "analysis_recommended_focus")}:** ${String(analysis["recommended_focus"])}`,
        );
        lines.push("");
    });

    writeField("summary", () => {
        lines.push(`**${t(text, "analysis_summary")}:**`);
        lines.push("");
        for (const para of String(analysis["summary"]).split("\n")) {
            lines.push(`> ${para}`);
        }
        lines.push("");
    });

    writeField("suggested_curriculum", () => {
        const arr = analysis["suggested_curriculum"];
        if (!Array.isArray(arr)) return;
        lines.push(`**${t(text, "analysis_suggested_curriculum")}:**`);
        lines.push("");
        for (const item of arr) {
            if (!item || typeof item !== "object") continue;
            const lesson = item as Record<string, unknown>;
            const title = String(lesson.title ?? "-");
            const priority =
                typeof lesson.priority === "number"
                    ? ` _(${t(text, "analysis_priority")}: ${lesson.priority})_`
                    : "";
            lines.push(`- **${title}**${priority}`);
            if (lesson.description) {
                lines.push(`  - ${String(lesson.description)}`);
            }
        }
        lines.push("");
    });

    // Any leftover fields → JSON appendix so partial shapes don't
    // silently drop data.
    const leftovers: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(analysis)) {
        if (!consumed.has(k) && k !== "chunk_summaries" && k !== "fallback_used") {
            leftovers[k] = v;
        }
    }
    if (Object.keys(leftovers).length > 0) {
        lines.push(`**${t(text, "analysis")}:**`);
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(leftovers, null, 2));
        lines.push("```");
        lines.push("");
    }

    return lines;
}

// ---- Session Detail ------------------------------------------------------

function renderSessionDetail(payload: SessionDetail, text: ReportText): string {
    const sections: string[] = [
        `# ${t(text, "session_detail_title")}`,
        "",
        renderSessionMeta(payload, text),
        renderTranscript(payload, text),
        renderSessionRating(payload, text),
        renderSessionStepEvaluations(payload, text),
        envelopeFooter(payload, text),
    ];
    return sections.filter(Boolean).join("\n");
}

function renderSessionMeta(payload: SessionDetail, text: ReportText): string {
    const s = payload.session;
    const lines: string[] = [`## ${t(text, "session")}`, ""];
    if (payload.project) {
        lines.push(`**${t(text, "topic")}:** ${payload.project.topic}  `);
        lines.push(`**${t(text, "goal")}:** ${payload.project.goal}  `);
    }
    lines.push(`**${t(text, "method")}:** ${methodLabel(text, s.method)}  `);
    lines.push(`**${t(text, "started_at")}:** ${formatDateTime(s.started_at)}  `);
    lines.push(`**${t(text, "ended_at")}:** ${formatDateTime(s.ended_at)}  `);
    lines.push(
        `**${t(text, "duration")}:** ${s.duration_minutes} ${t(text, "minutes_short")}  `,
    );
    lines.push(
        `**${t(text, "cycle_step")}:** ${s.cycle_step}. ${stepLabel(text, s.cycle_step)}  `,
    );
    lines.push(`**${t(text, "status")}:** ${statusLabel(text, s.status)}`);
    lines.push("");
    return lines.join("\n");
}

function renderTranscript(payload: SessionDetail, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "transcript")}`, ""];
    if (payload.messages.length === 0) {
        lines.push(t(text, "no_messages"));
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
        lines.push(`### ${t(text, roleLabelKey)} - _${formatDateTime(m.created_at)}_`);
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

function renderSessionRating(payload: SessionDetail, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "rating")}`, ""];
    if (!payload.rating) {
        lines.push(t(text, "no_rating"));
        lines.push("");
        return lines.join("\n");
    }
    const r = payload.rating;
    lines.push(ratingLine(t(text, "understanding"), r.understanding, text));
    lines.push(ratingLine(t(text, "stress"), r.stress, text));
    lines.push(ratingLine(t(text, "method_fit"), r.method_fit, text));
    if (r.notes) {
        lines.push("");
        lines.push(`**${t(text, "notes")}:**`);
        lines.push("");
        // v1.14.0 / Phase 27E — notes may carry serialised
        // TipTap JSON; renderStoredContent emits Markdown and
        // returns plain text verbatim for legacy rows. Each
        // resulting line gets the blockquote prefix so the
        // note stays visually attached to the section.
        const noteMd = renderStoredContent(r.notes);
        for (const line of noteMd.split("\n")) {
            lines.push(line.length > 0 ? `> ${line}` : ">");
        }
    }
    lines.push("");
    return lines.join("\n");
}

function renderSessionStepEvaluations(payload: SessionDetail, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "step_evaluations")}`, ""];
    if (payload.step_evaluations.length === 0) {
        lines.push(t(text, "no_step_insights"));
        lines.push("");
        return lines.join("\n");
    }
    lines.push(
        `| ${t(text, "evaluated_at")} | ${t(text, "from_step")} | ` +
            `${t(text, "to_step")} | ${t(text, "confidence")} | ` +
            `${t(text, "status")} | ${t(text, "reason")} |`,
    );
    lines.push("|---|---|---|---|---|---|");
    for (const e of payload.step_evaluations) {
        const status = e.fallback_used
            ? t(text, "fallback")
            : e.applied
              ? t(text, "applied")
              : t(text, "not_applied");
        lines.push(
            `| ${formatDateTime(e.evaluated_at)} | ` +
                `${e.from_step}. ${stepLabel(text, e.from_step)} | ` +
                `${e.to_step}. ${stepLabel(text, e.to_step)} | ` +
                `${fraction01ToPercent(e.confidence)}% | ${status} | ` +
                `${escapePipe(e.reason)} |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

// ---- Curriculum Overview -------------------------------------------------

function renderCurriculumOverview(payload: CurriculumOverview, text: ReportText): string {
    const c = payload.curriculum;
    const sections: string[] = [
        `# ${t(text, "curriculum_overview_title")}: ${c.title}`,
        "",
    ];
    if (c.description) {
        const descMd = renderStoredContent(c.description);
        if (descMd.length > 0) {
            sections.push(`**${t(text, "description")}:**`);
            sections.push("");
            sections.push(descMd);
            sections.push("");
        }
    }
    sections.push(`**${t(text, "language")}:** ${c.language}  `);
    sections.push(`**${t(text, "generated_at")}:** ${formatDate(c.created_at)}`);
    sections.push("");
    sections.push(renderTopicTree(payload, text));
    sections.push(renderLessons(payload, text));
    sections.push(envelopeFooter(payload, text));
    return sections.filter(Boolean).join("\n");
}

function renderTopicTree(payload: CurriculumOverview, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "topics")}`, ""];
    if (payload.topics.length === 0) {
        lines.push(t(text, "no_topics"));
        lines.push("");
        return lines.join("\n");
    }
    for (const topic of payload.topics) {
        const indent = "  ".repeat(topic.depth);
        lines.push(`${indent}- **${topic.title}**`);
        if (topic.description) {
            // Topic descriptions are not yet edited via the
            // rich-text editor (the rich-text UI does not cover
            // topics in Phase 27), but the TEXT column still
            // accepts serialised TipTap JSON via sync from
            // future-versioned clients. renderStoredContent
            // round-trips both shapes.
            const md = renderStoredContent(topic.description);
            const flat = md.replace(/\n+/g, " ").trim();
            if (flat.length > 0) {
                lines.push(`${indent}  - ${flat}`);
            }
        }
    }
    lines.push("");
    return lines.join("\n");
}

function renderLessons(payload: CurriculumOverview, text: ReportText): string {
    const lines: string[] = [`## ${t(text, "lessons")}`, ""];
    if (payload.lessons.length === 0) {
        lines.push(t(text, "no_lessons"));
        lines.push("");
        return lines.join("\n");
    }
    for (const lesson of payload.lessons) {
        lines.push(`### ${lesson.title}`);
        lines.push("");
        if (lesson.content) {
            const md = renderStoredContent(lesson.content);
            if (md.length > 0) {
                lines.push(md);
            }
        }
        lines.push("");
    }
    return lines.join("\n");
}

/**
 * Per-topic folder stub README.md generator (Phase 49D /
 * v1.32.0 / PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the Python ``topic_folders.py`` at
 * ``plugins/.../learning-repo/adaptive_learner_learning_repo/
 * topic_folders.py``.
 *
 * Each TopicSlice from ``ctx.topics`` becomes one numbered
 * folder under the project repo root. Folder names use the
 * same ``NN_slug`` convention as the README link generator,
 * so the parent README's topic links resolve to the stubs
 * generated here.
 *
 * Returns an empty map when ``ctx.topics`` is empty (free-form
 * projects with no ``cycle_topics`` history).
 */

import {formatLabel, type Labels} from "./labels";
import type {RenderContext, TopicSlice} from "./render-context";
import {topicFolderName} from "./topic-folder-slug";

export function renderTopicFolders(
    ctx: RenderContext,
    labels: Labels,
): Record<string, string> {
    const folders: Record<string, string> = {};
    for (const topic of ctx.topics) {
        const folder = topicFolderName(topic.order, topic.title);
        const path = `${folder}/README.md`;
        folders[path] = renderTopicStub(topic, labels);
    }
    return folders;
}

function renderTopicStub(topic: TopicSlice, labels: Labels): string {
    const lines: string[] = [
        `# ${formatLabel(labels.topic_readme_title, {title: topic.title})}`,
        "",
        labels.topic_readme_parent_link,
        "",
        `## ${labels.topic_readme_sessions_heading}`,
        "",
    ];
    if (topic.session_ids.length > 0) {
        for (const sessionId of topic.session_ids) {
            lines.push(`- \`${sessionId.slice(0, 8)}\``);
        }
    } else {
        lines.push(labels.topic_readme_no_sessions);
    }
    lines.push("", `## ${labels.topic_readme_methods_heading}`, "");
    if (topic.methods.length > 0) {
        for (const method of topic.methods) {
            lines.push(`- ${method}`);
        }
    } else {
        lines.push("—");
    }
    lines.push("");
    return rstripWithNewline(lines.join("\n"));
}

function rstripWithNewline(s: string): string {
    return s.replace(/[\s\n]+$/, "") + "\n";
}

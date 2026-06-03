/**
 * Orchestrator for the learning-repo renderer — TypeScript
 * port of ``plugins/.../learning-repo/adaptive_learner_learning_repo/
 * renderer.py`` (Phase 49D / v1.32.0 / PHASE-42-STORAGE-
 * ABSTRACTION-01).
 *
 * Pure function of the context. Dispatches to every meta-file
 * generator + the topic-folder stubs, returns a
 * ``{path: content}`` map with the same shape as the backend's
 * ``/api/plugins/learning-repo/render/{project_id}`` response.
 *
 * No I/O. The DexieStorage learningRepo namespace (49E) calls
 * ``loadDexieContext`` (49B) to build the context, then hands
 * it here. The parity test (49F) loads a JSON fixture, builds
 * a context with a pinned ``rendered_at``, and asserts each
 * key in the returned map equals the corresponding golden
 * Markdown file byte-for-byte.
 */

import {labelsFor} from "./labels";
import type {RenderContext} from "./render-context";
import {renderCheatsheet} from "./renderers/cheatsheet";
import {renderReadme} from "./renderers/readme";
import {renderRoadmap} from "./renderers/roadmap";
import {renderStats} from "./renderers/stats";
import {renderTopicFolders} from "./topic-folders";

/**
 * Build the full ``{path: content}`` map for one project's
 * rendered repository tree.
 *
 * - Top-level files: ``README.md``, ``LEARNING_STATS.md``,
 *   ``CHEATSHEET.md``, ``ROADMAP.md``.
 * - Topic folders: ``NN_slug/README.md`` per ``TopicSlice``
 *   (empty when the project has no ``cycle_topics`` history).
 *
 * Caller supplies the language; ``labelsFor`` loads the bundled
 * i18n catalog and overlays ``repo.*`` strings onto the
 * English defaults.
 */
export async function renderRepository(
    ctx: RenderContext,
    language: string = "en",
): Promise<Record<string, string>> {
    const labels = await labelsFor(language);
    const tree: Record<string, string> = {
        "README.md": renderReadme(ctx, labels),
        "LEARNING_STATS.md": renderStats(ctx, labels),
        "CHEATSHEET.md": renderCheatsheet(ctx, labels),
        "ROADMAP.md": renderRoadmap(ctx, labels),
    };
    const topicStubs = renderTopicFolders(ctx, labels);
    for (const [path, content] of Object.entries(topicStubs)) {
        tree[path] = content;
    }
    return tree;
}

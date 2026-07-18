/**
 * useSessionHeaderData (#1804 — extracted from Session.tsx).
 *
 * The three independent, best-effort fetches that feed the session
 * header: the project topic line (Phase 51 bugfix), the
 * imported-conversation topic override (#1141), and the resolved
 * active-model info (v1.11.0 / Phase 24E). Every fetch degrades
 * silently — the header just omits the affected line.
 */

import {useEffect, useState} from "react";

import {getStorage} from "../../storage";
import {resolveModel} from "../../storage/ai/ai-providers";
import type {AvailableModel} from "../../storage/types";
import type {LearningProject, LearningSession, UserSettings} from "../../types";

/** Resolved model id + human-readable info for the header chip. */
export interface ActiveModelInfo {
    id: string;
    name: string;
    contextWindow: number | null;
}

/**
 * Resolve the header's project topic, imported-topic override, and
 * active-model info from the current session + user settings.
 *
 * @example
 * const {project, importedTopic, activeModelInfo} =
 *     useSessionHeaderData({session, userSettings});
 * <SessionHeader project={project} topicOverride={importedTopic} ... />
 */
export function useSessionHeaderData({
    session,
    userSettings,
}: {
    session: LearningSession | null;
    userSettings: UserSettings | null;
}) {
    const [project, setProject] = useState<LearningProject | null>(null);
    const [importedTopic, setImportedTopic] = useState<string | null>(null);
    const [activeModelInfo, setActiveModelInfo] =
        useState<ActiveModelInfo | null>(null);

    // Fetch the project once we know the session's project_id —
    // drives the topic line in the header (Phase 51 bugfix). The
    // header degrades gracefully if the fetch fails; the rest of
    // the page does not depend on this state.
    useEffect(() => {
        if (!session?.project_id) {
            setProject(null);
            return;
        }
        let cancelled = false;
        getStorage()
            .projects.get(session.project_id)
            .then((row) => {
                if (!cancelled) setProject(row);
            })
            .catch(() => {
                /* silent — header just omits the topic line. */
            });
        return () => {
            cancelled = true;
        };
    }, [session?.project_id]);

    // #1141 — resolve the imported conversation's topic for the header when the
    // session is linked to one. Prefers the analysis topic, falls back to the
    // conversation title. Cleared for non-imported sessions.
    useEffect(() => {
        const convId = session?.imported_conversation_id;
        if (!convId) {
            setImportedTopic(null);
            return;
        }
        let cancelled = false;
        getStorage()
            .imports.get(convId)
            .then((detail) => {
                if (cancelled) return;
                setImportedTopic(detail.analysis_result?.topic || detail.title || null);
            })
            .catch(() => {
                /* silent — header falls back to the project topic. */
            });
        return () => {
            cancelled = true;
        };
    }, [session?.imported_conversation_id]);

    // Resolve the active model whenever userSettings changes. The
    // model id always renders; the human name + context window come
    // from the available-models cache when one exists. This is
    // best-effort: no network roundtrip blocks the header on first
    // paint.
    useEffect(() => {
        if (!userSettings) {
            setActiveModelInfo(null);
            return;
        }
        const provider = userSettings.active_provider;
        const override = userSettings[
            `model_override_${provider}` as keyof UserSettings
        ] as string | null | undefined;
        const modelId = resolveModel(provider, override ?? null);
        const fallback = {
            id: modelId,
            name: modelId,
            contextWindow: null as number | null,
        };
        // hasApiKey gates the cache lookup — without a key the
        // backend / browser never fetched the list.
        const hasKey = userSettings[
            `has_${provider}_key` as keyof UserSettings
        ] as boolean;
        if (!hasKey) {
            setActiveModelInfo(fallback);
            return;
        }
        let cancelled = false;
        getStorage()
            .settings.getAvailableModels(userSettings.user_id, provider)
            .then((models: AvailableModel[]) => {
                if (cancelled) return;
                const match = models.find((m) => m.id === modelId);
                setActiveModelInfo(
                    match
                        ? {
                              id: match.id,
                              name: match.name,
                              contextWindow: match.context_window,
                          }
                        : fallback,
                );
            })
            .catch(() => {
                if (!cancelled) setActiveModelInfo(fallback);
            });
        return () => {
            cancelled = true;
        };
    }, [userSettings]);

    return {project, importedTopic, activeModelInfo};
}

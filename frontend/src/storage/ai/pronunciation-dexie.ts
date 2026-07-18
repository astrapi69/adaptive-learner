/**
 * Dexie-mode pronunciation namespace (#1786 — extracted from
 * dexie-storage.ts).
 *
 * Browser-direct pronunciation practice (#903): eligibility walks the
 * project's subject tree for a "Languages"/"Sprachen" node; phrase +
 * judge call the provider with the user's own key (gate: "key
 * present?", not "backend reachable?"), mirroring the study guide
 * (#902) + Anki (#807).
 */

import { ApiError } from "../../api/client";
import { getDb } from "../dexie/db";
import type { SubjectRow } from "../dexie/db";
import { resolveDexieAiConfig } from "../anki/anki-extraction";
import {
  generatePhrase as generatePronunciationPhrase,
  judgeAttempt as judgePronunciationAttempt,
} from "../../lib/ai/providers/pronunciation-ai";
import type { IStorageService } from "../types";

/**
 * Resolve the browser-direct AI config for a pronunciation call (#903): find
 * the project's owner, then its active provider + key. Throws ApiError(400)
 * when no key is configured, so the page reports "API key required" rather
 * than failing the AI call.
 */
async function resolvePronunciationAiConfig(projectId: string) {
  const db = getDb();
  const project = await db.learningProjects.get(projectId);
  if (!project) {
    throw new ApiError(404, `Project ${projectId} not found`);
  }
  const config = await resolveDexieAiConfig(project.user_id);
  if (!config) {
    throw new ApiError(
      400,
      "An API key is required for pronunciation practice. " +
        "Configure a provider in Settings.",
    );
  }
  return config;
}

export const dexiePronunciation: IStorageService["pronunciation"] = {
  async eligibility(projectId) {
    // Walk the project's subjects + every parent chain
    // looking for a "Languages" (or "Sprachen") node.
    const db = getDb();
    const assocs = await db.projectSubjects
      .where({ project_id: projectId })
      .toArray();
    if (assocs.length === 0) return { eligible: false };
    const visited = new Set<string>();
    for (const a of assocs) {
      let cursor: string | null = a.subject_id;
      while (cursor !== null && !visited.has(cursor)) {
        visited.add(cursor);
        const subj: SubjectRow | undefined = await db.subjects.get(cursor);
        if (!subj) break;
        if (
          subj.name.toLowerCase() === "languages" ||
          subj.name.toLowerCase() === "sprachen"
        ) {
          return { eligible: true };
        }
        cursor = subj.parent_id;
      }
    }
    return { eligible: false };
  },
  // #903 — browser-direct with the user's own key (gate: "key present?",
  // not "backend reachable?"), mirroring the study guide (#902) + Anki (#807).
  phrase: async (args) => {
    const config = await resolvePronunciationAiConfig(args.project_id);
    const phrase = await generatePronunciationPhrase(config, {
      language: args.language,
      level: args.level,
      focus: args.focus,
      previous: args.previous,
    });
    if (!phrase) {
      throw new ApiError(502, "Could not generate a phrase. Please try again.");
    }
    return { phrase, language: args.language };
  },
  judge: async (args) => {
    const config = await resolvePronunciationAiConfig(args.project_id);
    const verdict = await judgePronunciationAttempt(config, {
      target: args.target,
      actual: args.actual,
      language: args.language,
    });
    if (!verdict) {
      throw new ApiError(502, "Could not score that attempt. Please try again.");
    }
    return verdict;
  },
};

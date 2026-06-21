/**
 * AIX-06 (EXP-036) — concrete {@link SetBatchDeps} for a user-generated set.
 *
 * Bridges the storage-agnostic batch orchestrator
 * ({@link generateExercisesForSet}) to the real content store + the
 * AIX-01..04 generation pipeline. Both storage modes go through
 * ``getStorage().contentLoader`` and the browser-direct provider, so the
 * batch works in Dexie and API mode alike.
 *
 * The whole set is re-saved (via ``saveUserSet``) after each lesson —
 * there is no per-lesson update API — so the factory caches every full
 * lesson on load and rewrites the set from that cache. This is the same
 * persistence path the Save-as-Offline-Lesson flow uses.
 */

import { getStorage } from "../../storage";
import type {
  ContentLesson,
  ContentLessonExercise,
  ContentSetEntry,
  UserLessonOrigin,
} from "../../storage/types";
import { appendExercisesToLesson } from "../content/lesson/append-exercises";
import { cardsToExercises } from "./cards-to-exercises";
import { browserDirectProvider, generateExercises } from "./generate-exercises";
import type { BatchLesson, SetBatchDeps } from "./generate-exercises-for-set";
import type { ResolvedAiProvider } from "./resolve-provider";

function theoryStepsOf(lesson: ContentLesson): BatchLesson["theorySteps"] {
  return lesson.steps
    .filter((step) => step.type === "theory")
    .map((step) => ({ id: step.id, title: step.title, body: step.body }));
}

function exerciseCountOf(lesson: ContentLesson): number {
  return lesson.steps.filter((step) => step.type === "exercise" && step.exercise).length;
}

function originOf(entry: ContentSetEntry): UserLessonOrigin {
  if (entry.domain === "adaptive" || entry.domain === "imported") return entry.domain;
  return "analysis";
}

/**
 * Build the batch deps for one user-generated set.
 *
 * @param entry - The set (from "My Lessons").
 * @param config - The resolved provider (browser-direct).
 * @param clozePrompt - Localized cloze instruction for the mapper.
 * @returns Deps the orchestrator can drive.
 */
export function buildSetBatchDeps(
  entry: ContentSetEntry,
  config: ResolvedAiProvider,
  clozePrompt: string,
): SetBatchDeps {
  // filename -> full lesson, populated by loadLessons and rewritten on save.
  const cache = new Map<string, ContentLesson>();
  // batch-lesson id -> filename (the orchestrator passes BatchLesson back).
  const filenameById = new Map<string, string>();

  return {
    loadLessons: async (): Promise<BatchLesson[]> => {
      const list = await getStorage().contentLoader.listLessons(entry.source, entry.id);
      const out: BatchLesson[] = [];
      for (const filename of list.lessons) {
        const lesson = await getStorage().contentLoader.getLesson(
          entry.source,
          entry.id,
          filename,
        );
        cache.set(filename, lesson);
        filenameById.set(lesson.id, filename);
        out.push({
          id: lesson.id,
          filename,
          title: lesson.title,
          theorySteps: theoryStepsOf(lesson),
          exerciseCount: exerciseCountOf(lesson),
        });
      }
      return out;
    },

    generateForLesson: async (
      lesson: BatchLesson,
      signal?: AbortSignal,
    ): Promise<ContentLessonExercise[]> => {
      const provider = browserDirectProvider(config);
      const result = await generateExercises(lesson.theorySteps, provider, {
        language: entry.source_language || entry.language,
        signal,
      });
      return cardsToExercises(result.cards, { clozePrompt }).exercises;
    },

    saveLessonExercises: async (
      lesson: BatchLesson,
      exercises: ContentLessonExercise[],
    ): Promise<void> => {
      const filename = filenameById.get(lesson.id) ?? lesson.filename;
      const current = cache.get(filename);
      if (!current) return;
      cache.set(filename, appendExercisesToLesson(current, exercises));
      await getStorage().contentLoader.saveUserSet({
        set_id: entry.id,
        title: entry.title,
        title_native: entry.title_native ?? entry.title,
        language: entry.language,
        target_language: entry.target_language,
        source_language: entry.source_language,
        level: entry.level,
        origin: originOf(entry),
        description: entry.description,
        lessons: [...cache.values()],
      });
    },
  };
}

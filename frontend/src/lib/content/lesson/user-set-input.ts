/**
 * App-side storage-contract layer for wizard-authored extension lessons
 * (#1852, split out of the generic assembly in #1862). This is the ONE piece
 * of extension-lesson building that is genuinely app-coupled: it produces a
 * ``SaveUserSetInput`` (the ``IStorageService`` persistence contract) from
 * the wizard draft meta. The generic lesson assembly lives in
 * ``lib/exercises/authoring/lesson-assembly.ts``.
 */

import {slugify} from "../analysis/analysis-to-lesson";
import type {ExtensionLessonInput} from "../../exercises/authoring/lesson-assembly";
import type {LessonMeta} from "./lesson-draft";
import type {ContentLesson, SaveUserSetInput} from "../../../storage/types";

/** Stable slug-safe set id (re-saving with the same title overwrites). */
export function extensionSetId(meta: LessonMeta): string {
    return `created-${slugify(meta.title) || "lesson"}`;
}

/**
 * Wrap a built extension lesson in the ``SaveUserSetInput`` that persists it
 * to "My Lessons".
 *
 * @example
 * const set = buildExtensionUserSetInput({meta, exercises}, lesson);
 * await getStorage().contentLoader.saveUserSet(set);
 */
export function buildExtensionUserSetInput(
    input: ExtensionLessonInput,
    lesson: ContentLesson,
): SaveUserSetInput {
    const {meta} = input;
    return {
        set_id: extensionSetId(meta),
        title: meta.title.trim(),
        title_native: meta.titleNative.trim() || meta.title.trim(),
        language: meta.targetLanguage,
        target_language: meta.targetLanguage,
        source_language: meta.sourceLanguage,
        level: meta.level,
        origin: "imported",
        description: meta.description.trim() || null,
        lessons: [lesson],
    };
}

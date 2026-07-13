/**
 * ``ext:al-categorization`` core (#1579) - the first adopted extension
 * exercise type (schema 1.7 extension tier): "sort these items into their
 * buckets".
 *
 * The payload contract mirrors the engine's worked example
 * ``ext:ref-categorization`` (learn-content-engine docs/extensions.md):
 * ``ext_payload.categories`` as ``[{name, items[]}]``, at least two buckets,
 * unique bucket names, every item in exactly one bucket.
 *
 * This module is the ENGINE half (payload validation) plus the pure grading
 * helpers of the CONSUMER half. The renderer
 * (``components/exercises/renderers/CategorizationExercise.tsx``) and the
 * load guard (``SUPPORTED_EXTENSIONS``) complete the adoption.
 */

import type {ContentLessonExercise} from "../../storage/types";

/** The adopted extension type; declared by lessons as
 *  ``ext:al-categorization@<major>``. */
export const CATEGORIZATION_EXT_TYPE = "ext:al-categorization";

/** One target bucket: a name plus the items that belong into it. */
export interface CategoryBucket {
    name: string;
    items: string[];
}

/** The ``ext_payload`` shape ``ext:al-categorization`` expects. */
export interface CategorizationPayload {
    categories: CategoryBucket[];
}

/** Read the payload as a CategorizationPayload, or null when it is not
 *  shaped right. */
export function asCategorizationPayload(
    exercise: ContentLessonExercise,
): CategorizationPayload | null {
    const categories = (
        exercise.ext_payload as {categories?: unknown} | undefined
    )?.categories;
    if (!Array.isArray(categories)) return null;
    const shapedRight = categories.every(
        (bucket) =>
            typeof bucket === "object" &&
            bucket !== null &&
            typeof (bucket as CategoryBucket).name === "string" &&
            Array.isArray((bucket as CategoryBucket).items) &&
            (bucket as CategoryBucket).items.every(
                (item) => typeof item === "string",
            ),
    );
    return shapedRight ? {categories: categories as CategoryBucket[]} : null;
}

/** ENGINE half: validate one ``ext:al-categorization`` exercise's payload.
 *  Returns human-readable error messages; empty when the payload is valid.
 *  Mirrors the rule set of the engine's ``ext:ref-categorization``. */
export function categorizationPayloadErrors(
    exercise: ContentLessonExercise,
): string[] {
    const payload = asCategorizationPayload(exercise);
    if (!payload) {
        return [
            `'${exercise.id}' needs 'ext_payload.categories' as an array of {name, items[]}`,
        ];
    }
    const payloadErrors: string[] = [];
    if (payload.categories.length < 2) {
        payloadErrors.push(`'${exercise.id}' needs at least 2 categories`);
    }
    if (payload.categories.some((bucket) => bucket.items.length === 0)) {
        payloadErrors.push(
            `'${exercise.id}' needs at least 1 item in every category`,
        );
    }
    if (
        payload.categories.some((bucket) =>
            bucket.items.some((item) => item.trim() === ""),
        )
    ) {
        payloadErrors.push(`'${exercise.id}' items must be non-empty`);
    }
    const bucketNames = payload.categories.map((bucket) => bucket.name);
    if (new Set(bucketNames).size !== bucketNames.length) {
        payloadErrors.push(`'${exercise.id}' category names must be unique`);
    }
    const pooledItems = payload.categories.flatMap((bucket) => bucket.items);
    if (new Set(pooledItems).size !== pooledItems.length) {
        payloadErrors.push(
            `'${exercise.id}' items must appear in exactly one category`,
        );
    }
    return payloadErrors;
}

/** The combined item pool in authored order (the renderer shuffles it). */
export function allCategorizationItems(
    payload: CategorizationPayload,
): string[] {
    return payload.categories.flatMap((bucket) => bucket.items);
}

/** The bucket an item was authored into, or null for unknown items. */
export function authoredBucketFor(
    payload: CategorizationPayload,
    item: string,
): string | null {
    const owningBucket = payload.categories.find((bucket) =>
        bucket.items.includes(item),
    );
    return owningBucket ? owningBucket.name : null;
}

/** How many authored items the assignment (item -> bucket name) places into
 *  their authored bucket. Missing and misplaced items do not count. */
export function countCorrectAssignments(
    payload: CategorizationPayload,
    assignments: ReadonlyMap<string, string>,
): number {
    return payload.categories.reduce(
        (correctCount, bucket) =>
            correctCount +
            bucket.items.filter((item) => assignments.get(item) === bucket.name)
                .length,
        0,
    );
}

import {describe, expect, it} from "vitest";

import {
    CATEGORIZATION_EXT_TYPE,
    allCategorizationItems,
    asCategorizationPayload,
    authoredBucketFor,
    categorizationPayloadErrors,
    countCorrectAssignments,
} from "./categorization";
import type {ContentLessonExercise} from "../../../storage/types";

/**
 * Engine-half + grading core for the adopted extension
 * ``ext:al-categorization`` (#1579). The payload contract mirrors the
 * engine's worked example ``ext:ref-categorization``
 * (learn-content-engine docs/extensions.md): ``categories`` as
 * ``[{name, items[]}]``, min two buckets, unique names, every item in
 * exactly one bucket.
 */

const exerciseWith = (payload: unknown): ContentLessonExercise =>
    ({
        id: "ex-categ-01",
        type: CATEGORIZATION_EXT_TYPE,
        prompt: "Ordne jedes Signal der richtigen Kategorie zu",
        card_ids: [],
        distractors: [],
        ext_payload: payload,
    }) as unknown as ContentLessonExercise;

const SIGNALS = {
    categories: [
        {name: "Sichtzeichen", items: ["flache Hand", "Zeigefinger hoch"]},
        {name: "Hoerzeichen", items: ["Sitz", "Platz"]},
    ],
};

describe("asCategorizationPayload", () => {
    it("reads a well-formed payload", () => {
        const payload = asCategorizationPayload(exerciseWith(SIGNALS));
        expect(payload).not.toBeNull();
        expect(payload?.categories).toHaveLength(2);
    });

    it("returns null for malformed shapes (missing, non-array, bad bucket)", () => {
        expect(asCategorizationPayload(exerciseWith(undefined))).toBeNull();
        expect(asCategorizationPayload(exerciseWith({categories: "x"}))).toBeNull();
        expect(
            asCategorizationPayload(exerciseWith({categories: [{name: 1, items: []}]})),
        ).toBeNull();
    });
});

describe("categorizationPayloadErrors (engine half)", () => {
    it("accepts the well-formed payload (happy path)", () => {
        expect(categorizationPayloadErrors(exerciseWith(SIGNALS))).toEqual([]);
    });

    it("rejects a malformed shape with a single error", () => {
        const shapeErrors = categorizationPayloadErrors(exerciseWith("nope"));
        expect(shapeErrors).toHaveLength(1);
        expect(shapeErrors[0]).toContain("categories");
    });

    it("requires at least two buckets and one item per bucket", () => {
        const oneBucket = categorizationPayloadErrors(
            exerciseWith({categories: [{name: "A", items: ["x"]}]}),
        );
        expect(oneBucket.join(" ")).toContain("at least 2 categories");

        const emptyBucket = categorizationPayloadErrors(
            exerciseWith({
                categories: [
                    {name: "A", items: []},
                    {name: "B", items: ["x"]},
                ],
            }),
        );
        expect(emptyBucket.join(" ")).toContain("at least 1 item");
    });

    it("rejects blank items, duplicate bucket names, and cross-bucket duplicate items", () => {
        const blankItem = categorizationPayloadErrors(
            exerciseWith({
                categories: [
                    {name: "A", items: [" "]},
                    {name: "B", items: ["x"]},
                ],
            }),
        );
        expect(blankItem.join(" ")).toContain("non-empty");

        const dupName = categorizationPayloadErrors(
            exerciseWith({
                categories: [
                    {name: "A", items: ["x"]},
                    {name: "A", items: ["y"]},
                ],
            }),
        );
        expect(dupName.join(" ")).toContain("unique");

        const dupItem = categorizationPayloadErrors(
            exerciseWith({
                categories: [
                    {name: "A", items: ["x"]},
                    {name: "B", items: ["x"]},
                ],
            }),
        );
        expect(dupItem.join(" ")).toContain("exactly one category");
    });

    it("boundary: two buckets with one item each is the smallest valid payload", () => {
        const minimal = categorizationPayloadErrors(
            exerciseWith({
                categories: [
                    {name: "A", items: ["x"]},
                    {name: "B", items: ["y"]},
                ],
            }),
        );
        expect(minimal).toEqual([]);
    });
});

describe("grading helpers", () => {
    const payload = asCategorizationPayload(exerciseWith(SIGNALS))!;

    it("flattens the item pool in authored order", () => {
        expect(allCategorizationItems(payload)).toEqual([
            "flache Hand",
            "Zeigefinger hoch",
            "Sitz",
            "Platz",
        ]);
    });

    it("resolves the authored bucket per item (null for unknown items)", () => {
        expect(authoredBucketFor(payload, "Sitz")).toBe("Hoerzeichen");
        expect(authoredBucketFor(payload, "flache Hand")).toBe("Sichtzeichen");
        expect(authoredBucketFor(payload, "Bleib")).toBeNull();
    });

    it("counts correct assignments; misplaced and missing items do not count", () => {
        const fullCorrect = new Map([
            ["flache Hand", "Sichtzeichen"],
            ["Zeigefinger hoch", "Sichtzeichen"],
            ["Sitz", "Hoerzeichen"],
            ["Platz", "Hoerzeichen"],
        ]);
        expect(countCorrectAssignments(payload, fullCorrect)).toBe(4);

        const oneMisplaced = new Map(fullCorrect);
        oneMisplaced.set("Sitz", "Sichtzeichen");
        expect(countCorrectAssignments(payload, oneMisplaced)).toBe(3);

        const oneMissing = new Map(fullCorrect);
        oneMissing.delete("Platz");
        expect(countCorrectAssignments(payload, oneMissing)).toBe(3);
    });
});

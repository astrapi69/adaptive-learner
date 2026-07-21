import {describe, expect, it} from "vitest";

import {
    ERROR_CORRECTION_EXT_TYPE,
    asErrorCorrectionPayload,
    canonicalErrorCorrection,
    errorCorrectionPayloadErrors,
} from "./error-correction";
import type {ContentLessonExercise} from "../../../storage/types";

/**
 * Engine-half core for the adopted extension ``ext:al-error-correction``
 * (#1579, second adoption). The payload contract mirrors the engine's
 * worked example ``ext:ref-error-correction`` AFTER the accept-array
 * redesign (engine PR #42): ``tokens`` + ``error_index`` + ``accept``
 * (string array, ``accept[0]`` canonical, every entry differs from the
 * marked token).
 */

const exerciseWith = (payload: unknown): ContentLessonExercise =>
    ({
        id: "ex-errcorr-01",
        type: ERROR_CORRECTION_EXT_TYPE,
        prompt: "Ein Wort ist falsch - tippe es an und korrigiere es.",
        card_ids: [],
        distractors: [],
        ext_payload: payload,
    }) as unknown as ContentLessonExercise;

const DATIVE_SLIP = {
    tokens: ["Der", "Hund", "folgt", "das", "Kommando"],
    error_index: 3,
    accept: ["dem", "einem"],
};

describe("asErrorCorrectionPayload", () => {
    it("reads a well-formed payload", () => {
        const payload = asErrorCorrectionPayload(exerciseWith(DATIVE_SLIP));
        expect(payload).not.toBeNull();
        expect(payload?.accept).toEqual(["dem", "einem"]);
    });

    it("returns null for malformed shapes (missing, wrong field types)", () => {
        expect(asErrorCorrectionPayload(exerciseWith(undefined))).toBeNull();
        expect(
            asErrorCorrectionPayload(exerciseWith({...DATIVE_SLIP, tokens: "x"})),
        ).toBeNull();
        expect(
            asErrorCorrectionPayload(
                exerciseWith({...DATIVE_SLIP, accept: "dem"}),
            ),
        ).toBeNull();
        expect(
            asErrorCorrectionPayload(
                exerciseWith({...DATIVE_SLIP, error_index: "3"}),
            ),
        ).toBeNull();
    });
});

describe("errorCorrectionPayloadErrors (engine half)", () => {
    it("accepts the well-formed payload (happy path)", () => {
        expect(errorCorrectionPayloadErrors(exerciseWith(DATIVE_SLIP))).toEqual(
            [],
        );
    });

    it("rejects a malformed shape with a single error", () => {
        const shapeErrors = errorCorrectionPayloadErrors(
            exerciseWith({tokens: ["a", "b"]}),
        );
        expect(shapeErrors).toHaveLength(1);
        expect(shapeErrors[0]).toContain("accept");
    });

    it("requires at least two non-empty tokens", () => {
        const tooFew = errorCorrectionPayloadErrors(
            exerciseWith({...DATIVE_SLIP, tokens: ["Hund"], error_index: 0}),
        );
        expect(tooFew.join(" ")).toContain("at least 2 tokens");

        const blankToken = errorCorrectionPayloadErrors(
            exerciseWith({...DATIVE_SLIP, tokens: ["Der", " ", "folgt"], error_index: 0}),
        );
        expect(blankToken.join(" ")).toContain("non-empty");
    });

    it("requires error_index to be an integer inside the token range", () => {
        const outOfRange = errorCorrectionPayloadErrors(
            exerciseWith({...DATIVE_SLIP, error_index: 5}),
        );
        expect(outOfRange.join(" ")).toContain("token range");

        const fractional = errorCorrectionPayloadErrors(
            exerciseWith({...DATIVE_SLIP, error_index: 1.5}),
        );
        expect(fractional.join(" ")).toContain("token range");
    });

    it("requires a non-empty accept list and refuses a no-op entry", () => {
        const emptyList = errorCorrectionPayloadErrors(
            exerciseWith({...DATIVE_SLIP, accept: []}),
        );
        expect(emptyList.join(" ")).toContain("at least 1");

        const blankEntry = errorCorrectionPayloadErrors(
            exerciseWith({...DATIVE_SLIP, accept: ["dem", " "]}),
        );
        expect(blankEntry.join(" ")).toContain("at least 1");

        const noop = errorCorrectionPayloadErrors(
            exerciseWith({...DATIVE_SLIP, accept: ["dem", "das"]}),
        );
        expect(noop.join(" ")).toContain("differ from the marked token");
    });

    it("boundary: first and last token are valid error positions", () => {
        expect(
            errorCorrectionPayloadErrors(
                exerciseWith({...DATIVE_SLIP, error_index: 0, accept: ["Die"]}),
            ),
        ).toEqual([]);
        expect(
            errorCorrectionPayloadErrors(
                exerciseWith({...DATIVE_SLIP, error_index: 4, accept: ["Signal"]}),
            ),
        ).toEqual([]);
    });
});

describe("canonicalErrorCorrection", () => {
    it("returns accept[0] (the canonical solution) and null for malformed payloads", () => {
        expect(canonicalErrorCorrection(exerciseWith(DATIVE_SLIP))).toBe("dem");
        expect(canonicalErrorCorrection(exerciseWith({tokens: ["a", "b"]}))).toBeNull();
    });
});

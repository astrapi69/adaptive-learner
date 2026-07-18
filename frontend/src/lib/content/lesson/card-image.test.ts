/**
 * Tests for client-side card-image processing (#1763).
 *
 * Mirrors the avatar ``resize-image`` seam pattern: the canvas is
 * injected so the encode path is unit-testable in happy-dom without a
 * real 2D context.
 */

import {describe, expect, it, vi} from "vitest";

import {
    CARD_IMAGE_MAX_BYTES,
    encodeCardImage,
    isDataUri,
    processCardImageFile,
    scaledDimensions,
} from "./card-image";

describe("isDataUri", () => {
    it("recognises data: URIs and rejects paths / empties", () => {
        expect(isDataUri("data:image/jpeg;base64,AAAA")).toBe(true);
        expect(isDataUri("  data:image/png;base64,AAAA")).toBe(true);
        expect(isDataUri("img/bonjour.png")).toBe(false);
        expect(isDataUri("")).toBe(false);
    });
});

describe("scaledDimensions", () => {
    it("keeps images already within the cap unchanged", () => {
        expect(scaledDimensions(300, 200, 512)).toEqual({width: 300, height: 200});
    });
    it("downscales the longest edge to the cap, preserving aspect", () => {
        expect(scaledDimensions(1024, 512, 512)).toEqual({width: 512, height: 256});
        expect(scaledDimensions(512, 1024, 512)).toEqual({width: 256, height: 512});
    });
    it("returns a zero box for a degenerate source", () => {
        expect(scaledDimensions(0, 100, 512)).toEqual({width: 0, height: 0});
    });
});

describe("encodeCardImage", () => {
    function fakeCanvas(payload: string): HTMLCanvasElement {
        return {
            getContext: () => ({drawImage: vi.fn()}),
            toDataURL: () => `data:image/jpeg;base64,${payload}`,
        } as unknown as HTMLCanvasElement;
    }

    it("returns a JPEG data URL when it fits the byte cap", () => {
        const url = encodeCardImage(
            {} as CanvasImageSource,
            800,
            600,
            () => fakeCanvas("AAAA"),
        );
        expect(url).toBe("data:image/jpeg;base64,AAAA");
        expect(isDataUri(url ?? "")).toBe(true);
    });

    it("returns null when even the lowest quality exceeds the cap", () => {
        const big = "A".repeat(CARD_IMAGE_MAX_BYTES * 2);
        const url = encodeCardImage(
            {} as CanvasImageSource,
            800,
            600,
            () => fakeCanvas(big),
        );
        expect(url).toBeNull();
    });
});

describe("processCardImageFile", () => {
    it("rejects an unsupported file type with a translatable key", async () => {
        const file = new File(["x"], "a.gif", {type: "image/gif"});
        await expect(processCardImageFile(file)).rejects.toThrow(
            "create_lesson.cards.image_error.unsupported_type",
        );
    });
});

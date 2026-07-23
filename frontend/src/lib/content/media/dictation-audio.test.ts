/**
 * Tests for client-side dictation-audio processing (#1911, ext:al-dictation
 * Slice 3).
 *
 * Mirrors the card-image seam (``card-image.test.ts``): validate the format +
 * size gate deterministically, and confirm an accepted file reads into a
 * self-contained data URI. There is no re-encode step (audio can't be
 * canvas-recompressed), so the success path runs directly through happy-dom's
 * ``FileReader``.
 */

import {describe, expect, it} from "vitest";

import {
    AUDIO_MAX_BYTES,
    DICT_AUDIO_ERROR_TOO_LARGE,
    DICT_AUDIO_ERROR_UNSUPPORTED,
    isAcceptedAudioType,
    processAudioFile,
} from "./dictation-audio";

describe("isAcceptedAudioType", () => {
    it("accepts mp3/ogg/wav MIME types and rejects others", () => {
        expect(isAcceptedAudioType("audio/mpeg")).toBe(true);
        expect(isAcceptedAudioType("audio/mp3")).toBe(true);
        expect(isAcceptedAudioType("audio/ogg")).toBe(true);
        expect(isAcceptedAudioType("audio/wav")).toBe(true);
        expect(isAcceptedAudioType("audio/x-wav")).toBe(true);
        expect(isAcceptedAudioType("video/mp4")).toBe(false);
        expect(isAcceptedAudioType("image/png")).toBe(false);
        expect(isAcceptedAudioType("")).toBe(false);
    });
});

describe("processAudioFile", () => {
    it("reads an accepted file into a base64 data URI", async () => {
        const file = new File([new Uint8Array([1, 2, 3, 4])], "clip.mp3", {
            type: "audio/mpeg",
        });
        const url = await processAudioFile(file);
        expect(url.startsWith("data:")).toBe(true);
    });

    it("accepts a .wav whose browser MIME type is empty, by extension", async () => {
        const file = new File([new Uint8Array([1, 2, 3])], "clip.wav", {type: ""});
        const url = await processAudioFile(file);
        expect(url.startsWith("data:")).toBe(true);
    });

    it("rejects an unsupported type with a translatable key", async () => {
        const file = new File(["x"], "a.mp4", {type: "video/mp4"});
        await expect(processAudioFile(file)).rejects.toThrow(
            DICT_AUDIO_ERROR_UNSUPPORTED,
        );
    });

    it("rejects a file over the size cap with a translatable key", async () => {
        const big = new Uint8Array(AUDIO_MAX_BYTES + 1);
        const file = new File([big], "big.mp3", {type: "audio/mpeg"});
        await expect(processAudioFile(file)).rejects.toThrow(
            DICT_AUDIO_ERROR_TOO_LARGE,
        );
    });
});

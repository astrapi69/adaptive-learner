/**
 * Tests for the dictation audio upload field (#1911, ext:al-dictation Slice 3).
 *
 * Pins the prop-driven UI, mirroring ``CardImageField.test.tsx``: upload
 * control + path input when empty, an audio preview + Remove for a data-URI
 * value, the typed-path alternative still emitting a path (regression against
 * the #1881 contract), and a clear error on a bad file type (which rejects
 * before any read). The processing itself is covered in
 * ``dictation-audio.test.ts``.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import DictationAudioField from "./DictationAudioField";

const t = (_key: string, fallback?: string) => fallback ?? _key;
const DATA_URI = "data:audio/mpeg;base64,AAAA";

describe("DictationAudioField (#1911)", () => {
    it("shows an upload control and the path input when empty", () => {
        render(<DictationAudioField id="d1" value="" onChange={vi.fn()} t={t} />);
        expect(
            screen.getByTestId("exercise-ext-dict-audio-upload-d1"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("exercise-ext-dict-audio-d1")).toBeInTheDocument();
        expect(
            screen.queryByTestId("exercise-ext-dict-audio-preview-d1"),
        ).not.toBeInTheDocument();
    });

    it("renders an audio preview + remove for a data-URI value, path cleared", () => {
        render(
            <DictationAudioField id="d1" value={DATA_URI} onChange={vi.fn()} t={t} />,
        );
        const preview = screen.getByTestId(
            "exercise-ext-dict-audio-preview-d1",
        ) as HTMLAudioElement;
        expect(preview).toBeInTheDocument();
        expect(preview.getAttribute("src")).toBe(DATA_URI);
        // The base64 blob never leaks into the plain-text path box.
        const path = screen.getByTestId(
            "exercise-ext-dict-audio-d1",
        ) as HTMLInputElement;
        expect(path.value).toBe("");
    });

    it("clears the audio when Remove is pressed", () => {
        const onChange = vi.fn();
        render(
            <DictationAudioField id="d1" value={DATA_URI} onChange={onChange} t={t} />,
        );
        fireEvent.click(screen.getByTestId("exercise-ext-dict-audio-remove-d1"));
        expect(onChange).toHaveBeenCalledWith("");
    });

    it("keeps the typed path working as an alternative (regression, #1881)", () => {
        const onChange = vi.fn();
        render(<DictationAudioField id="d1" value="" onChange={onChange} t={t} />);
        fireEvent.change(screen.getByTestId("exercise-ext-dict-audio-d1"), {
            target: {value: "assets/audio/clip.mp3"},
        });
        expect(onChange).toHaveBeenCalledWith("assets/audio/clip.mp3");
    });

    it("shows a clear error and does not crash on an unsupported file type", async () => {
        const onChange = vi.fn();
        render(<DictationAudioField id="d1" value="" onChange={onChange} t={t} />);
        const fileInput = screen.getByTestId(
            "exercise-ext-dict-audio-file-d1",
        ) as HTMLInputElement;
        const bad = new File(["x"], "a.mp4", {type: "video/mp4"});
        fireEvent.change(fileInput, {target: {files: [bad]}});
        await waitFor(() =>
            expect(
                screen.getByTestId("exercise-ext-dict-audio-error-d1"),
            ).toBeInTheDocument(),
        );
        expect(onChange).not.toHaveBeenCalled();
    });

    it("processes an accepted upload into a data URI passed to onChange", async () => {
        const onChange = vi.fn();
        render(<DictationAudioField id="d1" value="" onChange={onChange} t={t} />);
        const fileInput = screen.getByTestId(
            "exercise-ext-dict-audio-file-d1",
        ) as HTMLInputElement;
        const good = new File([new Uint8Array([1, 2, 3, 4])], "clip.mp3", {
            type: "audio/mpeg",
        });
        fireEvent.change(fileInput, {target: {files: [good]}});
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect((onChange.mock.calls[0][0] as string).startsWith("data:")).toBe(true);
    });
});

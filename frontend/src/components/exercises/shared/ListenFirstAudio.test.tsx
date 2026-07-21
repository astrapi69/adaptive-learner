/**
 * Listen-first audio control (#1600 Option A): plays the card's authored
 * pronunciation (``card.audio``, one file per card) before the learner
 * answers. Resolution goes through the same ``useAsset`` chain as
 * picture_choice images; when no blob URL can be produced (no source, no
 * cache, missing file) the control renders NOTHING - the exercise stays
 * exactly as before, no broken player.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

interface UseAssetStub {
    url: string | null;
    loading: boolean;
    error: boolean;
}

const useAssetMock = vi.fn<() => UseAssetStub>(() => ({
    url: null,
    loading: false,
    error: true,
}));
vi.mock("../../../hooks/ui/useAsset", () => ({
    useAsset: () => useAssetMock(),
}));

import ListenFirstAudio from "./ListenFirstAudio";

describe("ListenFirstAudio (#1600)", () => {
    beforeEach(() => {
        useAssetMock.mockReset();
    });

    it("renders a play button when the audio blob resolves", () => {
        useAssetMock.mockReturnValue({url: "blob:audio-1", loading: false, error: false});
        render(<ListenFirstAudio source="o/r" setId="s1" audioPath="audio/coffee.mp3" />);
        expect(screen.getByTestId("listen-first")).toBeInTheDocument();
    });

    it("renders nothing while loading, on error, or without a url", () => {
        useAssetMock.mockReturnValue({url: null, loading: true, error: false});
        const {container, rerender} = render(
            <ListenFirstAudio source="o/r" setId="s1" audioPath="audio/coffee.mp3" />,
        );
        expect(container).toBeEmptyDOMElement();
        useAssetMock.mockReturnValue({url: null, loading: false, error: true});
        rerender(<ListenFirstAudio source="o/r" setId="s1" audioPath="audio/coffee.mp3" />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when the card carries no audio path", () => {
        useAssetMock.mockReturnValue({url: null, loading: false, error: false});
        const {container} = render(
            <ListenFirstAudio source="o/r" setId="s1" audioPath={null} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("plays an inline data-URI clip directly, bypassing the asset resolver (#1911)", () => {
        // An uploaded clip is a self-contained data URI; the resolver can't
        // fetch it by path, so it must never be routed through useAsset.
        useAssetMock.mockReturnValue({url: null, loading: false, error: true});
        render(
            <ListenFirstAudio
                source=""
                setId=""
                audioPath="data:audio/mpeg;base64,AAAA"
            />,
        );
        expect(screen.getByTestId("listen-first")).toBeInTheDocument();
    });
});

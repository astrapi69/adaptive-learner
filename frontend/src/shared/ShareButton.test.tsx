import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import ShareButton from "./ShareButton";

const PROPS = {
    text: "I am on a 30-day streak! #AdaptiveLearner",
    url: "https://astrapi69.github.io/adaptive-learner/",
    label: "Share",
};

afterEach(() => {
    vi.unstubAllGlobals();
    // Remove any share/clipboard we attached to the real navigator.
    delete (navigator as unknown as {share?: unknown}).share;
});

describe("ShareButton", () => {
    it("uses navigator.share when available", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        (navigator as Navigator & {share?: unknown}).share = share;
        const onShared = vi.fn();

        render(<ShareButton {...PROPS} onShared={onShared} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() => expect(onShared).toHaveBeenCalledWith("shared"));
        expect(share).toHaveBeenCalledWith({text: PROPS.text, url: PROPS.url});
    });

    it("falls back to the clipboard when navigator.share is absent", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", {clipboard: {writeText}});
        const onShared = vi.fn();

        render(<ShareButton {...PROPS} onShared={onShared} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() => expect(onShared).toHaveBeenCalledWith("copied"));
        expect(writeText).toHaveBeenCalledWith(`${PROPS.text} ${PROPS.url}`);
    });

    it("reports 'unavailable' when neither share nor clipboard works", async () => {
        vi.stubGlobal("navigator", {});
        const onShared = vi.fn();

        render(<ShareButton {...PROPS} onShared={onShared} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() =>
            expect(onShared).toHaveBeenCalledWith("unavailable"),
        );
    });

    it("reports 'cancelled' when the user dismisses the share sheet", async () => {
        const share = vi
            .fn()
            .mockRejectedValue(new DOMException("dismissed", "AbortError"));
        (navigator as Navigator & {share?: unknown}).share = share;
        const onShared = vi.fn();

        render(<ShareButton {...PROPS} onShared={onShared} />);
        fireEvent.click(screen.getByTestId("share-button"));

        await waitFor(() => expect(onShared).toHaveBeenCalledWith("cancelled"));
    });

    it("renders the provided label", () => {
        render(<ShareButton {...PROPS} />);
        expect(screen.getByTestId("share-button")).toHaveTextContent("Share");
    });
});
